use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared("DROP TABLE IF EXISTS paddle_webhook_events CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS billing_entitlements CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS billing_profiles CASCADE")
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        crate::m20260706_000008_billing_entitlements::Migration
            .up(manager)
            .await?;
        crate::m20260722_000009_billing_scheduled_cancel_at::Migration
            .up(manager)
            .await
    }
}
