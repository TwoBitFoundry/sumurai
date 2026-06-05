use entity::transactions;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(transactions::Entity)
                    .drop_column(transactions::Column::NormalizedMerchant)
                    .add_column(
                        ColumnDef::new(transactions::Column::NormalizedMerchant)
                            .text()
                            .null(),
                    )
                    .add_column(
                        ColumnDef::new(transactions::Column::NormalizationSource)
                            .text()
                            .null(),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(transactions::Entity)
                    .drop_column(transactions::Column::NormalizationSource)
                    .drop_column(transactions::Column::NormalizedMerchant)
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "ALTER TABLE transactions
                 ADD COLUMN normalized_merchant text GENERATED ALWAYS AS (
                     regexp_replace(lower(coalesce(merchant_name, '')), '[^a-z]', '', 'g')
                 ) STORED",
            )
            .await?;

        Ok(())
    }
}
