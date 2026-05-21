use crate::models::predicted_category::Confidence;
use crate::services::categorization::categorization_service::CategorizationService;

fn make_threshold_service() -> CategorizationService {
    CategorizationService::from_refs(vec![
        ("CLEAR".to_string(), vec![1.0, 0.0, 0.0]),
        ("DUMMY".to_string(), vec![0.0, 1.0, 0.0]),
    ])
}

fn make_tight_margin_service() -> CategorizationService {
    CategorizationService::from_refs(vec![
        ("TIGHT".to_string(), vec![1.0, 0.0, 0.0]),
        ("NEAR".to_string(), vec![0.98, 0.199, 0.0]),
    ])
}

#[test]
fn given_clear_winner_when_scoring_then_returns_high_confidence() {
    let service = make_threshold_service();

    let output = service.categorize_batch_sync(vec![vec![0.9, 0.0, 0.43589]]);

    assert_eq!(output.len(), 1);
    assert_eq!(output[0].primary, "CLEAR");
    assert_eq!(output[0].confidence, Confidence::High);
}

#[test]
fn given_mid_match_when_scoring_then_returns_medium_confidence() {
    let service = make_threshold_service();

    let output = service.categorize_batch_sync(vec![vec![0.45, 0.0, 0.89303]]);

    assert_eq!(output.len(), 1);
    assert_eq!(output[0].primary, "CLEAR");
    assert_eq!(output[0].confidence, Confidence::Medium);
}

#[test]
fn given_low_match_when_scoring_then_returns_low_confidence() {
    let service = make_threshold_service();

    let output = service.categorize_batch_sync(vec![vec![0.32, 0.0, 0.94742]]);

    assert_eq!(output.len(), 1);
    assert_eq!(output[0].primary, "CLEAR");
    assert_eq!(output[0].confidence, Confidence::Low);
}

#[test]
fn given_score_below_floor_when_scoring_then_falls_back_to_other() {
    let service = make_threshold_service();

    let output = service.categorize_batch_sync(vec![vec![0.29, 0.0, 0.95709]]);

    assert_eq!(output.len(), 1);
    assert_eq!(output[0].primary, "OTHER");
    assert_eq!(output[0].confidence, Confidence::Low);
}

#[test]
fn given_tight_margin_when_scoring_then_falls_back_to_other() {
    let service = make_tight_margin_service();

    let output = service.categorize_batch_sync(vec![vec![1.0, 0.0, 0.0]]);

    assert_eq!(output.len(), 1);
    assert_eq!(output[0].primary, "OTHER");
    assert_eq!(output[0].confidence, Confidence::Low);
}

#[test]
fn given_empty_input_when_scoring_then_returns_empty_output() {
    let service = make_threshold_service();

    let output = service.categorize_batch_sync(Vec::new());

    assert!(output.is_empty());
}

#[test]
fn given_refs_when_normalized_then_vectors_have_unit_length() {
    let service = CategorizationService::from_refs(vec![
        ("ONE".to_string(), vec![3.0, 4.0]),
        ("TWO".to_string(), vec![5.0, 12.0]),
    ]);

    for (_, vector) in service.category_refs() {
        let norm = vector.iter().map(|value| value * value).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() <= 1e-6);
    }
}
