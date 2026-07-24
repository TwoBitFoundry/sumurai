use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(BillingEntitlements::Table)
                    .add_column(
                        ColumnDef::new(BillingEntitlements::ScheduledCancelAt)
                            .timestamp_with_time_zone()
                            .null(),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(BillingEntitlements::Table)
                    .drop_column(BillingEntitlements::ScheduledCancelAt)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum BillingEntitlements {
    Table,
    ScheduledCancelAt,
}
