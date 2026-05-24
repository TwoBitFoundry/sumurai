#![allow(dead_code)]

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::models::predicted_category::PredictedCategory;
use crate::services::categorization::classifier_labels::{
    classify_logits, deterministic_prediction,
};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use ndarray::{Array2, Ix2};
use ort::ep;
use ort::session::{builder::GraphOptimizationLevel, RunOptions, Session};
use ort::value::Tensor;

use crate::services::categorization::ort_memory_profile;
use serde_json::Value;
use tokenizers::{
    PaddingDirection, PaddingParams, PaddingStrategy, Tokenizer, TruncationDirection,
    TruncationParams, TruncationStrategy,
};
use tokio::task;

const INFERENCE_BATCH_SIZE: usize = 128;
const MAX_INFERENCE_SEQ_LEN: usize = 128;
pub const MODEL_DIR: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/assets/models/distilbert-us-transaction-classifier-v2"
);

pub struct CategorizationService {
    session: Option<Arc<Mutex<Session>>>,
    inference_run_options: Option<Arc<RunOptions>>,
    tokenizer: Option<Arc<Tokenizer>>,
    classifier_labels: Vec<String>,
    max_seq_len: usize,
}

#[async_trait]
pub trait Categorizer: Send + Sync {
    async fn categorize_batch(&self, descriptions: Vec<String>) -> Result<Vec<PredictedCategory>>;
}

impl CategorizationService {
    pub fn model_dir() -> PathBuf {
        PathBuf::from(MODEL_DIR)
    }

    pub async fn new(model_dir: &Path) -> Result<Self> {
        let model_dir = model_dir.to_path_buf();
        task::spawn_blocking(move || Self::new_blocking(&model_dir))
            .await
            .map_err(|err| anyhow!("failed to join categorization model load task: {err}"))?
    }

    fn new_blocking(model_dir: &Path) -> Result<Self> {
        let model_path = model_dir.join("model_quantized.onnx");
        let tokenizer_path = model_dir.join("tokenizer.json");
        let config_path = model_dir.join("config.json");
        let label_mapping_path = model_dir.join("label_mapping.json");

        ort_memory_profile::register_balanced_cpu_arena().map_err(|err| {
            anyhow!("failed to register balanced CPU arena allocator for categorization: {err}")
        })?;

        tracing::info!("creating categorization ONNX session builder");
        let session = Session::builder()
            .map_err(|err| anyhow!("failed to create categorization session builder: {err}"))?
            .with_parallel_execution(false)
            .map_err(|err| anyhow!("failed to configure categorization execution mode: {err}"))?
            .with_intra_threads(4)
            .map_err(|err| anyhow!("failed to configure categorization session threads: {err}"))?
            .with_inter_threads(1)
            .map_err(|err| anyhow!("failed to configure categorization inter-op threads: {err}"))?
            .with_env_allocators()
            .map_err(|err| anyhow!("failed to configure categorization env allocators: {err}"))?
            .with_execution_providers([ep::CPU::default().with_arena_allocator(true).build()])
            .map_err(|err| {
                anyhow!("failed to configure categorization CPU execution provider: {err}")
            })?
            .with_optimization_level(GraphOptimizationLevel::Level1)
            .map_err(|err| anyhow!("failed to configure categorization graph optimization: {err}"))?
            .commit_from_file(&model_path)
            .map_err(|err| {
                anyhow!(
                    "failed to load ONNX model from {}: {err}",
                    model_path.display()
                )
            })?;
        tracing::info!("loaded categorization ONNX session");
        let inference_run_options =
            Arc::new(ort_memory_profile::inference_run_options().map_err(|err| {
                anyhow!("failed to configure categorization inference run options: {err}")
            })?);
        let tokenizer =
            Tokenizer::from_file(tokenizer_path.to_string_lossy().as_ref()).map_err(|err| {
                anyhow!(
                    "failed to load tokenizer from {}: {err}",
                    tokenizer_path.display()
                )
            })?;
        tracing::info!("loaded categorization tokenizer");
        let max_seq_len = read_max_seq_len(&config_path)?.min(MAX_INFERENCE_SEQ_LEN);
        tracing::info!(max_seq_len, "loaded categorization model config");

        let classifier_labels = read_classifier_labels(&label_mapping_path)?;
        tracing::info!(
            labels = classifier_labels.len(),
            "loaded categorization classifier labels"
        );

        Ok(Self {
            session: Some(Arc::new(Mutex::new(session))),
            inference_run_options: Some(inference_run_options),
            tokenizer: Some(Arc::new(tokenizer)),
            classifier_labels,
            max_seq_len,
        })
    }

    fn classify_texts(
        &self,
        session: &mut Session,
        tokenizer: &Tokenizer,
        inputs: Vec<String>,
    ) -> Result<Vec<PredictedCategory>> {
        let inference_run_options = self.inference_run_options.as_ref().ok_or_else(|| {
            anyhow!("categorization service is not initialized with inference run options")
        })?;
        let labels = &self.classifier_labels;
        let max_seq_len = self.max_seq_len;
        if inputs.is_empty() {
            return Ok(Vec::new());
        }

        let mut predictions = vec![None; inputs.len()];
        let mut model_inputs = Vec::new();
        let mut model_indexes = Vec::new();

        for (index, input) in inputs.iter().enumerate() {
            if let Some(prediction) = deterministic_prediction(input) {
                predictions[index] = Some(prediction);
            } else {
                model_indexes.push(index);
                model_inputs.push(input.clone());
            }
        }

        if model_inputs.is_empty() {
            return Ok(predictions.into_iter().flatten().collect());
        }

        let mut tokenizer = tokenizer.clone();
        configure_tokenizer(&mut tokenizer, max_seq_len);
        let encodings = tokenizer
            .encode_batch(
                model_inputs.iter().map(|input| input.as_str()).collect(),
                true,
            )
            .map_err(|err| anyhow!("failed to tokenize classifier inputs: {err}"))?;
        let input_ids = build_tensor(&encodings, |encoding| encoding.get_ids())?;
        let attention_mask = build_tensor(&encodings, |encoding| encoding.get_attention_mask())?;
        let token_type_ids = build_tensor(&encodings, |encoding| encoding.get_type_ids())?;
        let input_names = session
            .inputs()
            .iter()
            .map(|outlet| outlet.name().to_string())
            .collect::<Vec<_>>();

        let mut ort_inputs = Vec::new();
        if input_names.iter().any(|name| name == "input_ids") {
            ort_inputs.push(("input_ids", Tensor::from_array(input_ids)?));
        }
        if input_names.iter().any(|name| name == "attention_mask") {
            ort_inputs.push((
                "attention_mask",
                Tensor::from_array(attention_mask.clone())?,
            ));
        }
        if input_names.iter().any(|name| name == "token_type_ids") {
            ort_inputs.push(("token_type_ids", Tensor::from_array(token_type_ids)?));
        }

        let outputs = session.run_with_options(ort_inputs, inference_run_options.as_ref())?;
        if outputs.len() == 0 {
            return Err(anyhow!("categorization model returned no outputs"));
        }

        let logits = outputs[0]
            .try_extract_array::<f32>()
            .map_err(|err| anyhow!("failed to extract categorization logits: {err}"))?
            .into_dimensionality::<Ix2>()
            .map_err(|err| anyhow!("categorization model output was not 2D: {err}"))?;

        for ((row, input), index) in logits
            .outer_iter()
            .zip(model_inputs.iter())
            .zip(model_indexes)
        {
            predictions[index] = Some(classify_logits(
                labels,
                row.as_slice().unwrap_or(&[]),
                input,
            ));
        }

        Ok(predictions.into_iter().flatten().collect())
    }
}

#[async_trait]
impl Categorizer for CategorizationService {
    async fn categorize_batch(&self, descriptions: Vec<String>) -> Result<Vec<PredictedCategory>> {
        if descriptions.is_empty() {
            return Ok(Vec::new());
        }

        let session = self
            .session
            .as_ref()
            .cloned()
            .ok_or_else(|| anyhow!("categorization service is not initialized with a model"))?;
        let tokenizer =
            self.tokenizer.as_ref().cloned().ok_or_else(|| {
                anyhow!("categorization service is not initialized with a tokenizer")
            })?;
        let inference = Self {
            session: Some(session),
            inference_run_options: self.inference_run_options.clone(),
            tokenizer: Some(tokenizer),
            classifier_labels: self.classifier_labels.clone(),
            max_seq_len: self.max_seq_len,
        };

        task::spawn_blocking(move || {
            let mut session = inference
                .session
                .as_ref()
                .ok_or_else(|| anyhow!("categorization service is not initialized with a model"))?
                .lock()
                .map_err(|_| anyhow!("categorization session lock was poisoned"))?;
            let tokenizer = inference.tokenizer.as_ref().ok_or_else(|| {
                anyhow!("categorization service is not initialized with a tokenizer")
            })?;
            let mut predictions = Vec::with_capacity(descriptions.len());
            for chunk in descriptions.chunks(INFERENCE_BATCH_SIZE) {
                predictions.extend(inference.classify_texts(
                    &mut session,
                    tokenizer.as_ref(),
                    chunk.to_vec(),
                )?);
            }
            Ok::<_, anyhow::Error>(predictions)
        })
        .await
        .map_err(|err| anyhow!("failed to join categorization inference task: {err}"))?
    }
}

fn configure_tokenizer(tokenizer: &mut Tokenizer, max_seq_len: usize) {
    let pad_id = tokenizer.token_to_id("[PAD]").unwrap_or(0);
    tokenizer
        .with_padding(Some(PaddingParams {
            strategy: PaddingStrategy::Fixed(max_seq_len),
            direction: PaddingDirection::Right,
            pad_to_multiple_of: None,
            pad_id,
            pad_type_id: 0,
            pad_token: "[PAD]".to_string(),
        }))
        .with_truncation(Some(TruncationParams {
            direction: TruncationDirection::Right,
            max_length: max_seq_len,
            strategy: TruncationStrategy::LongestFirst,
            stride: 0,
        }))
        .expect("tokenizer truncation configuration should be valid");
}

fn build_tensor<F>(encodings: &[tokenizers::Encoding], getter: F) -> Result<Array2<i64>>
where
    F: Fn(&tokenizers::Encoding) -> &[u32],
{
    let batch = encodings.len();
    let seq_len = encodings
        .first()
        .map(|encoding| encoding.get_ids().len())
        .unwrap_or(0);
    let values = encodings
        .iter()
        .flat_map(|encoding| getter(encoding).iter().map(|value| *value as i64))
        .collect::<Vec<_>>();

    Ok(Array2::from_shape_vec((batch, seq_len), values)?)
}

fn read_max_seq_len(config_path: &Path) -> Result<usize> {
    let config = fs::read_to_string(config_path)
        .map_err(|err| anyhow!("failed to read {}: {err}", config_path.display()))?;
    let value: Value = serde_json::from_str(&config)
        .map_err(|err| anyhow!("failed to parse {}: {err}", config_path.display()))?;

    Ok(value
        .get("max_position_embeddings")
        .and_then(Value::as_u64)
        .or_else(|| value.get("model_max_length").and_then(Value::as_u64))
        .or_else(|| value.get("max_seq_length").and_then(Value::as_u64))
        .map(|value| value as usize)
        .unwrap_or(128))
}

fn read_classifier_labels(config_path: &Path) -> Result<Vec<String>> {
    let config = fs::read_to_string(config_path)
        .map_err(|err| anyhow!("failed to read {}: {err}", config_path.display()))?;
    let value: Value = serde_json::from_str(&config)
        .map_err(|err| anyhow!("failed to parse {}: {err}", config_path.display()))?;
    let id2label = value
        .get("id2label")
        .and_then(Value::as_object)
        .ok_or_else(|| anyhow!("{} does not contain id2label", config_path.display()))?;
    let mut labels = id2label
        .iter()
        .map(|(key, value)| {
            let index = key.parse::<usize>().map_err(|err| {
                anyhow!(
                    "invalid classifier label index '{}' in {}: {err}",
                    key,
                    config_path.display()
                )
            })?;
            let label = value.as_str().ok_or_else(|| {
                anyhow!(
                    "invalid classifier label value for '{}' in {}",
                    key,
                    config_path.display()
                )
            })?;
            Ok((index, label.to_string()))
        })
        .collect::<Result<Vec<_>>>()?;
    labels.sort_by_key(|(index, _)| *index);

    Ok(labels.into_iter().map(|(_, label)| label).collect())
}
