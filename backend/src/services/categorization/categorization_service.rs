use std::path::Path;

use crate::models::predicted_category::PredictedCategory;
use anyhow::Result;

#[cfg(test)]
use crate::models::predicted_category::Confidence;
#[cfg(not(test))]
use anyhow::anyhow;
#[cfg(test)]
use std::cmp::Ordering;
#[cfg(not(test))]
use std::fs;
#[cfg(not(test))]
use std::sync::{Arc, Mutex};

#[cfg(not(test))]
use crate::services::categorization::classifier_labels::classify_logits;
use async_trait::async_trait;
#[cfg(not(test))]
use ndarray::{Array2, Ix2};
#[cfg(not(test))]
use ort::session::{builder::GraphOptimizationLevel, Session};
#[cfg(not(test))]
use ort::value::Tensor;
#[cfg(not(test))]
use serde_json::Value;
#[cfg(not(test))]
use tokenizers::{
    PaddingDirection, PaddingParams, PaddingStrategy, Tokenizer, TruncationDirection,
    TruncationParams, TruncationStrategy,
};
#[cfg(not(test))]
use tokio::task;

#[cfg(not(test))]
const INFERENCE_BATCH_SIZE: usize = 128;
#[cfg(not(test))]
const MAX_INFERENCE_SEQ_LEN: usize = 128;

pub struct CategorizationService {
    #[cfg(not(test))]
    session: Option<Arc<Mutex<Session>>>,
    #[cfg(not(test))]
    tokenizer: Option<Arc<Tokenizer>>,
    #[cfg(test)]
    category_refs: Vec<(String, Vec<f32>)>,
    #[cfg(not(test))]
    classifier_labels: Vec<String>,
    #[cfg(not(test))]
    max_seq_len: usize,
}

#[async_trait]
pub trait Categorizer: Send + Sync {
    async fn categorize_batch(&self, descriptions: Vec<String>) -> Result<Vec<PredictedCategory>>;
}

impl CategorizationService {
    #[cfg(test)]
    pub fn from_refs(category_refs: Vec<(String, Vec<f32>)>) -> Self {
        Self {
            #[cfg(not(test))]
            session: None,
            #[cfg(not(test))]
            tokenizer: None,
            category_refs: category_refs
                .into_iter()
                .map(|(primary, vector)| (primary, normalize_vector(&vector)))
                .collect(),
            #[cfg(not(test))]
            classifier_labels: Vec::new(),
            #[cfg(not(test))]
            max_seq_len: 128,
        }
    }

    #[cfg(not(test))]
    pub async fn new(model_dir: &Path) -> Result<Self> {
        let model_dir = model_dir.to_path_buf();
        task::spawn_blocking(move || Self::new_blocking(&model_dir))
            .await
            .map_err(|err| anyhow!("failed to join categorization model load task: {err}"))?
    }

    #[cfg(test)]
    pub async fn new(_model_dir: &Path) -> Result<Self> {
        Err(anyhow::anyhow!(
            "categorization model is unavailable in test builds"
        ))
    }

    #[cfg(test)]
    pub(crate) fn categorize_batch_sync(
        &self,
        query_vectors: Vec<Vec<f32>>,
    ) -> Vec<PredictedCategory> {
        query_vectors
            .iter()
            .map(|query| Self::cosine_and_threshold(query, &self.category_refs))
            .collect()
    }

    #[cfg(test)]
    pub(crate) fn category_refs(&self) -> &[(String, Vec<f32>)] {
        &self.category_refs
    }

    #[cfg(not(test))]
    fn new_blocking(model_dir: &Path) -> Result<Self> {
        let model_path = model_dir.join("model_quantized.onnx");
        let tokenizer_path = model_dir.join("tokenizer.json");
        let config_path = model_dir.join("config.json");
        let label_mapping_path = model_dir.join("label_mapping.json");

        tracing::info!("creating categorization ONNX session builder");
        let session = Session::builder()
            .map_err(|err| anyhow!("failed to create categorization session builder: {err}"))?
            .with_parallel_execution(false)
            .map_err(|err| anyhow!("failed to configure categorization execution mode: {err}"))?
            .with_intra_threads(4)
            .map_err(|err| anyhow!("failed to configure categorization session threads: {err}"))?
            .with_inter_threads(1)
            .map_err(|err| anyhow!("failed to configure categorization inter-op threads: {err}"))?
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
            tokenizer: Some(Arc::new(tokenizer)),
            classifier_labels,
            max_seq_len,
        })
    }

    #[cfg(not(test))]
    fn classify_texts(
        session: &mut Session,
        tokenizer: &Tokenizer,
        max_seq_len: usize,
        labels: &[String],
        inputs: Vec<String>,
    ) -> Result<Vec<PredictedCategory>> {
        if inputs.is_empty() {
            return Ok(Vec::new());
        }

        let mut tokenizer = tokenizer.clone();
        configure_tokenizer(&mut tokenizer, max_seq_len);
        let encodings = tokenizer
            .encode_batch(inputs.iter().map(|input| input.as_str()).collect(), true)
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

        let outputs = session.run(ort_inputs)?;
        if outputs.len() == 0 {
            return Err(anyhow!("categorization model returned no outputs"));
        }

        let logits = outputs[0]
            .try_extract_array::<f32>()
            .map_err(|err| anyhow!("failed to extract categorization logits: {err}"))?
            .into_dimensionality::<Ix2>()
            .map_err(|err| anyhow!("categorization model output was not 2D: {err}"))?;
        Ok(logits
            .outer_iter()
            .zip(inputs.iter())
            .map(|(row, input)| classify_logits(labels, row.as_slice().unwrap_or(&[]), input))
            .collect())
    }

    #[cfg(test)]
    fn cosine_and_threshold(query: &[f32], refs: &[(String, Vec<f32>)]) -> PredictedCategory {
        if refs.is_empty() {
            return PredictedCategory {
                primary: "OTHER".to_string(),
                confidence: Confidence::Low,
            };
        }

        let normalized_query = normalize_vector(query);
        let mut scored_refs = refs
            .iter()
            .map(|(primary, reference)| {
                (
                    primary.as_str(),
                    cosine_similarity(&normalized_query, reference),
                )
            })
            .collect::<Vec<_>>();
        scored_refs.sort_by(|left, right| right.1.partial_cmp(&left.1).unwrap_or(Ordering::Equal));

        let (best_primary, best_score) = scored_refs[0];
        let second_score = scored_refs
            .get(1)
            .map(|(_, score)| *score)
            .unwrap_or(f32::NEG_INFINITY);
        if best_score < 0.30 || best_score - second_score < 0.04 {
            return PredictedCategory {
                primary: "OTHER".to_string(),
                confidence: Confidence::Low,
            };
        }

        let confidence = if best_score >= 0.55 {
            Confidence::High
        } else if best_score >= 0.40 {
            Confidence::Medium
        } else {
            Confidence::Low
        };

        PredictedCategory {
            primary: best_primary.to_string(),
            confidence,
        }
    }
}

#[cfg(not(test))]
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
        let classifier_labels = self.classifier_labels.clone();
        let max_seq_len = self.max_seq_len;

        task::spawn_blocking(move || {
            let mut session = session
                .lock()
                .map_err(|_| anyhow!("categorization session lock was poisoned"))?;
            let mut predictions = Vec::with_capacity(descriptions.len());
            for chunk in descriptions.chunks(INFERENCE_BATCH_SIZE) {
                predictions.extend(Self::classify_texts(
                    &mut session,
                    tokenizer.as_ref(),
                    max_seq_len,
                    &classifier_labels,
                    chunk.to_vec(),
                )?);
            }
            Ok::<_, anyhow::Error>(predictions)
        })
        .await
        .map_err(|err| anyhow!("failed to join categorization inference task: {err}"))?
    }
}

#[cfg(test)]
#[async_trait]
impl Categorizer for CategorizationService {
    async fn categorize_batch(&self, _descriptions: Vec<String>) -> Result<Vec<PredictedCategory>> {
        Err(anyhow::anyhow!(
            "categorization service is unavailable in test builds"
        ))
    }
}

#[cfg(not(test))]
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

#[cfg(not(test))]
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

#[cfg(test)]
fn cosine_similarity(left: &[f32], right: &[f32]) -> f32 {
    left.iter().zip(right.iter()).map(|(a, b)| a * b).sum()
}

#[cfg(test)]
fn normalize_vector(values: &[f32]) -> Vec<f32> {
    let norm = values.iter().map(|value| value * value).sum::<f32>().sqrt();
    if norm == 0.0 {
        return values.to_vec();
    }

    values.iter().map(|value| value / norm).collect()
}

#[cfg(not(test))]
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

#[cfg(not(test))]
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
