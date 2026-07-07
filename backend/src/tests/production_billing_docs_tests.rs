use std::fs;
use std::path::PathBuf;

#[test]
fn given_production_billing_docs_when_read_then_covers_rollout_requirements() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../docs/PRODUCTION_BILLING.md");
    let contents = fs::read_to_string(path).expect("production billing doc should exist");

    for phrase in [
        "docker-compose.prod.yml",
        "billing_enabled",
        "must not show billing",
        "diy,plaid",
        "PADDLE_WEBHOOK_SECRET",
        "trial-codes create",
        "transaction.completed",
        "subscription.canceled",
        "cardless trials",
        "read, export, disconnect, and account deletion",
    ] {
        assert!(
            contents.contains(phrase),
            "expected production billing doc to mention {phrase}"
        );
    }
}
