use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared(
            "CREATE TABLE billing_profiles (
                user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                paddle_customer_id text UNIQUE,
                paddle_address_id text,
                billing_country_code text,
                billing_postal_code text,
                created_at timestamptz NOT NULL,
                updated_at timestamptz NOT NULL
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE billing_entitlements (
                user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                access_status text NOT NULL,
                source text NOT NULL,
                paddle_subscription_id text UNIQUE,
                paddle_customer_id text,
                paddle_price_id text,
                trial_ends_at timestamptz,
                current_period_ends_at timestamptz,
                canceled_at timestamptz,
                last_event_at timestamptz,
                payment_method_required boolean NOT NULL DEFAULT false,
                created_at timestamptz NOT NULL,
                updated_at timestamptz NOT NULL
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE trial_codes (
                id uuid PRIMARY KEY,
                code_hash text UNIQUE NOT NULL,
                redeem_by_at timestamptz NOT NULL,
                redeemed_at timestamptz,
                redeemed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
                disabled_at timestamptz,
                created_at timestamptz NOT NULL,
                updated_at timestamptz NOT NULL
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE trial_code_redemptions (
                id uuid PRIMARY KEY,
                trial_code_id uuid NOT NULL REFERENCES trial_codes(id) ON DELETE CASCADE,
                user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status text NOT NULL,
                paddle_transaction_id text UNIQUE,
                paddle_subscription_id text UNIQUE,
                created_at timestamptz NOT NULL,
                updated_at timestamptz NOT NULL,
                fulfilled_at timestamptz,
                failed_at timestamptz,
                UNIQUE (trial_code_id),
                UNIQUE (user_id)
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE paddle_webhook_events (
                event_id text PRIMARY KEY,
                event_type text NOT NULL,
                occurred_at timestamptz NOT NULL,
                processed_at timestamptz NOT NULL,
                processing_status text NOT NULL,
                related_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
                related_subscription_id text,
                error_code text,
                created_at timestamptz NOT NULL
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE INDEX idx_billing_entitlements_access_status ON billing_entitlements(access_status)",
        )
        .await?;
        db.execute_unprepared(
            "CREATE INDEX idx_trial_codes_redeem_by_at ON trial_codes(redeem_by_at)",
        )
        .await?;
        db.execute_unprepared(
            "CREATE INDEX idx_trial_code_redemptions_user_status ON trial_code_redemptions(user_id, status)",
        )
        .await?;
        db.execute_unprepared(
            "CREATE INDEX idx_paddle_webhook_events_related_user_type ON paddle_webhook_events(related_user_id, event_type)",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE billing_profiles ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY billing_profiles_user_isolation ON billing_profiles
                USING (user_id = current_setting('app.current_user_id', true)::uuid)
                WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE billing_entitlements ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY billing_entitlements_user_isolation ON billing_entitlements
                USING (user_id = current_setting('app.current_user_id', true)::uuid)
                WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE trial_code_redemptions ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY trial_code_redemptions_user_isolation ON trial_code_redemptions
                USING (user_id = current_setting('app.current_user_id', true)::uuid)
                WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared("DROP TABLE IF EXISTS paddle_webhook_events CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS trial_code_redemptions CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS trial_codes CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS billing_entitlements CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS billing_profiles CASCADE")
            .await?;

        Ok(())
    }
}
