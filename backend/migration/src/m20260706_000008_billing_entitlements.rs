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

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared("DROP TABLE IF EXISTS paddle_webhook_events CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS billing_entitlements CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS billing_profiles CASCADE")
            .await?;

        Ok(())
    }
}
