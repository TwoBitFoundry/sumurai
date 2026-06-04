use entity::{merchant_aliases, transactions};
use sea_orm::{DbBackend, Schema};
use sea_orm_migration::prelude::*;

use crate::merchant_alias_seeds::insert_merchant_alias_seeds;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let schema = Schema::new(DbBackend::Postgres);

        manager
            .create_table(schema.create_table_from_entity(merchant_aliases::Entity))
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_merchant_aliases_active_type")
                    .table(merchant_aliases::Entity)
                    .col(merchant_aliases::Column::IsActive)
                    .col(merchant_aliases::Column::MatchType)
                    .to_owned(),
            )
            .await?;

        insert_merchant_alias_seeds(db).await?;

        manager
            .alter_table(
                Table::alter()
                    .table(transactions::Entity)
                    .add_column(
                        ColumnDef::new(transactions::Column::OriginalMerchantName)
                            .string()
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
                    .drop_column(transactions::Column::OriginalMerchantName)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(merchant_aliases::Entity).to_owned())
            .await?;

        Ok(())
    }
}
