use async_trait::async_trait;
use entity::{users, webauthn_credentials};
use sea_orm::{
    sea_query::Expr, sea_query::Func, ColumnTrait, Database, DatabaseConnection, EntityTrait,
    QueryFilter,
};
use uuid::Uuid;

use crate::{PasskeyResetStore, UserRecord};

pub struct PostgresPasskeyResetStore {
    db: DatabaseConnection,
}

impl PostgresPasskeyResetStore {
    pub async fn connect(database_url: &str) -> Result<Self, sea_orm::DbErr> {
        let db = Database::connect(database_url).await?;
        Ok(Self { db })
    }
}

#[async_trait]
impl PasskeyResetStore for PostgresPasskeyResetStore {
    async fn find_user_by_identifier(
        &self,
        identifier: &str,
    ) -> Result<Option<UserRecord>, anyhow::Error> {
        let trimmed = identifier.trim();
        if trimmed.is_empty() {
            return Ok(None);
        }

        if let Ok(user_id) = Uuid::parse_str(trimmed) {
            if let Some(model) = users::Entity::find_by_id(user_id).one(&self.db).await? {
                return Ok(Some(UserRecord {
                    id: model.id,
                    email: model.email,
                }));
            }
        }

        let normalized = trimmed.to_lowercase();
        Ok(users::Entity::find()
            .filter(
                Expr::expr(Func::lower(Expr::col(users::Column::Email)))
                    .eq(Expr::value(normalized)),
            )
            .one(&self.db)
            .await?
            .map(|model| UserRecord {
                id: model.id,
                email: model.email,
            }))
    }

    async fn delete_all_passkeys(&self, user_id: Uuid) -> Result<u64, anyhow::Error> {
        let result = webauthn_credentials::Entity::delete_many()
            .filter(webauthn_credentials::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(result.rows_affected)
    }
}
