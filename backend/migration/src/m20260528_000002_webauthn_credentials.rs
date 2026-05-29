use entity::webauthn_credentials;
use sea_orm::{DbBackend, Schema};
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let schema = Schema::new(DbBackend::Postgres);

        manager
            .create_table(schema.create_table_from_entity(webauthn_credentials::Entity))
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_webauthn_credentials_user_id")
                    .table(Alias::new("webauthn_credentials"))
                    .col(Alias::new("user_id"))
                    .to_owned(),
            )
            .await?;

        let db = manager.get_connection();

        db.execute_unprepared("ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY")
            .await?;

        db.execute_unprepared(
            "CREATE POLICY webauthn_credentials_user_isolation ON webauthn_credentials
                USING (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .modify_column(ColumnDef::new(Alias::new("password_hash")).string().null())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared("DROP TABLE IF EXISTS webauthn_credentials CASCADE")
            .await?;

        db.execute_unprepared("UPDATE users SET password_hash = '' WHERE password_hash IS NULL")
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .modify_column(
                        ColumnDef::new(Alias::new("password_hash"))
                            .string()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}
