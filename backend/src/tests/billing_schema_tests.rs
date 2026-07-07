#[test]
fn given_billing_migration_when_read_then_defines_required_tables_and_rls() {
    let migration = include_str!("../../migration/src/m20260706_000008_billing_entitlements.rs");

    for table in [
        "billing_profiles",
        "billing_entitlements",
        "trial_codes",
        "trial_code_redemptions",
        "paddle_webhook_events",
    ] {
        assert!(migration.contains(&format!("CREATE TABLE {table}")));
    }

    for table in [
        "billing_profiles",
        "billing_entitlements",
        "trial_code_redemptions",
    ] {
        assert!(migration.contains(&format!("ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")));
        assert!(migration.contains(&format!("{table}_user_isolation")));
    }

    assert!(migration.contains("code_hash text UNIQUE NOT NULL"));
    assert!(!migration.contains(" code text"));
    assert!(migration.contains("UNIQUE (trial_code_id)"));
    assert!(migration.contains("UNIQUE (user_id)"));
    assert!(migration.contains("event_id text PRIMARY KEY"));
    assert!(migration.contains("processing_status text NOT NULL"));
    assert!(migration.contains("related_user_id uuid REFERENCES users(id) ON DELETE SET NULL"));
    assert!(!migration.contains("payload jsonb"));
}
