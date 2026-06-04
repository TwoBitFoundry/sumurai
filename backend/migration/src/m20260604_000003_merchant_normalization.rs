use entity::merchant_aliases;
use sea_orm::{DbBackend, Schema};
use sea_orm_migration::prelude::*;

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
                    .table(Alias::new("merchant_aliases"))
                    .col(Alias::new("is_active"))
                    .col(Alias::new("match_type"))
                    .to_owned(),
            )
            .await?;

        db.execute_unprepared(
            "INSERT INTO merchant_aliases (match_type, match_key, canonical_name, priority) VALUES
                ('contains', 'COSTCO WHSE', 'Costco', 10),
                ('contains', 'COSTCO', 'Costco', 5),
                ('contains', 'WINCO', 'WinCo', 10),
                ('exact', 'BOKF', 'BOKF', 10),
                ('contains', 'INSTACART', 'Instacart', 10),
                ('contains', 'TESLA MOTORS', 'Tesla Motors', 10),
                ('contains', 'TESLA', 'Tesla', 5),
                ('contains', 'CITY OF TULSA', 'City of Tulsa', 10),
                ('contains', 'WALMART', 'Walmart', 10),
                ('contains', 'WAL-MART', 'Walmart', 10),
                ('contains', 'TARGET', 'Target', 5),
                ('contains', 'AMAZON', 'Amazon', 10),
                ('contains', 'AMZN', 'Amazon', 10),
                ('contains', 'WHOLE FOODS', 'Whole Foods', 10),
                ('contains', 'TRADER JOES', 'Trader Joe''s', 10),
                ('contains', 'TRADER JOE', 'Trader Joe''s', 10),
                ('contains', 'KROGER', 'Kroger', 10),
                ('contains', 'SAFEWAY', 'Safeway', 10),
                ('contains', 'WALGREENS', 'Walgreens', 10),
                ('contains', 'CVS', 'CVS', 10),
                ('contains', 'STARBUCKS', 'Starbucks', 10),
                ('contains', 'MCDONALDS', 'McDonald''s', 10),
                ('contains', 'MCDONALD', 'McDonald''s', 10),
                ('contains', 'CHIPOTLE', 'Chipotle', 10),
                ('contains', 'CHICK-FIL-A', 'Chick-fil-A', 10),
                ('contains', 'CHICK FIL A', 'Chick-fil-A', 10),
                ('contains', 'NETFLIX', 'Netflix', 10),
                ('contains', 'SPOTIFY', 'Spotify', 10),
                ('contains', 'APPLE', 'Apple', 5),
                ('contains', 'GOOGLE', 'Google', 5),
                ('contains', 'MICROSOFT', 'Microsoft', 10),
                ('contains', 'ADOBE', 'Adobe', 10),
                ('contains', 'UBER EATS', 'Uber Eats', 10),
                ('contains', 'DOORDASH', 'DoorDash', 10),
                ('contains', 'GRUBHUB', 'Grubhub', 10),
                ('contains', 'VENMO', 'Venmo', 10),
                ('contains', 'PAYPAL', 'PayPal', 10),
                ('contains', 'ZELLE', 'Zelle', 10),
                ('contains', 'CASH APP', 'Cash App', 10),
                ('contains', 'SHELL', 'Shell', 5),
                ('contains', 'CHEVRON', 'Chevron', 10),
                ('contains', 'EXXON', 'Exxon', 10),
                ('contains', 'BP', 'BP', 10),
                ('contains', 'MARATHON', 'Marathon', 5),
                ('contains', 'HOME DEPOT', 'Home Depot', 10),
                ('contains', 'LOWES', 'Lowe''s', 10),
                ('contains', 'LOWE''S', 'Lowe''s', 10),
                ('contains', 'BEST BUY', 'Best Buy', 10),
                ('contains', '7-ELEVEN', '7-Eleven', 10),
                ('contains', '7 ELEVEN', '7-Eleven', 10),
                ('contains', 'DOLLAR GENERAL', 'Dollar General', 10),
                ('contains', 'DOLLAR TREE', 'Dollar Tree', 10),
                ('contains', 'FAMILY DOLLAR', 'Family Dollar', 10),
                ('contains', 'ALDI', 'Aldi', 10),
                ('contains', 'PUBLIX', 'Publix', 10),
                ('contains', 'MEIJER', 'Meijer', 10),
                ('contains', 'HEB', 'H-E-B', 10),
                ('contains', 'H-E-B', 'H-E-B', 10),
                ('contains', 'T-MOBILE', 'T-Mobile', 10),
                ('contains', 'TMOBILE', 'T-Mobile', 10),
                ('contains', 'VERIZON', 'Verizon', 10),
                ('contains', 'ATT', 'AT&T', 10),
                ('contains', 'AT&T', 'AT&T', 10)",
        )
        .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("transactions"))
                    .add_column(
                        ColumnDef::new(Alias::new("original_merchant_name"))
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
                    .table(Alias::new("transactions"))
                    .drop_column(Alias::new("original_merchant_name"))
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(Alias::new("merchant_aliases")).to_owned())
            .await?;

        Ok(())
    }
}
