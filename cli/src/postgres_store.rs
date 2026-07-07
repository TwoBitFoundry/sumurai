use async_trait::async_trait;
use chrono::{DateTime, Utc};
use entity::{trial_codes, users, webauthn_credentials};
use sea_orm::{
    sea_query::Expr, sea_query::Func, ActiveValue::Set, ColumnTrait, Database, DatabaseConnection,
    EntityTrait, QueryFilter, QueryOrder,
};
use uuid::Uuid;

use crate::{PasskeyResetStore, TrialCodeRecord, TrialCodeStore, UserRecord};

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

#[async_trait]
impl TrialCodeStore for PostgresPasskeyResetStore {
    async fn insert_trial_code(&self, record: TrialCodeRecord) -> Result<(), anyhow::Error> {
        trial_codes::Entity::insert(trial_codes::ActiveModel {
            id: Set(record.id),
            code_hash: Set(record.code_hash),
            redeem_by_at: Set(to_db_time(record.redeem_by_at)),
            redeemed_at: Set(record.redeemed_at.map(to_db_time)),
            redeemed_by_user_id: Set(record.redeemed_by_user_id),
            disabled_at: Set(record.disabled_at.map(to_db_time)),
            created_at: Set(to_db_time(record.created_at)),
            updated_at: Set(to_db_time(record.updated_at)),
        })
        .exec(&self.db)
        .await?;
        Ok(())
    }

    async fn list_trial_codes(&self) -> Result<Vec<TrialCodeRecord>, anyhow::Error> {
        let rows = trial_codes::Entity::find()
            .order_by_desc(trial_codes::Column::CreatedAt)
            .all(&self.db)
            .await?;

        Ok(rows
            .into_iter()
            .map(|row| TrialCodeRecord {
                id: row.id,
                code_hash: row.code_hash,
                redeem_by_at: from_db_time(row.redeem_by_at),
                redeemed_at: row.redeemed_at.map(from_db_time),
                redeemed_by_user_id: row.redeemed_by_user_id,
                disabled_at: row.disabled_at.map(from_db_time),
                created_at: from_db_time(row.created_at),
                updated_at: from_db_time(row.updated_at),
            })
            .collect())
    }

    async fn disable_trial_code(
        &self,
        id: Uuid,
        disabled_at: DateTime<Utc>,
    ) -> Result<(), anyhow::Error> {
        trial_codes::Entity::update_many()
            .col_expr(
                trial_codes::Column::DisabledAt,
                Expr::value(to_db_time(disabled_at)),
            )
            .col_expr(
                trial_codes::Column::UpdatedAt,
                Expr::value(to_db_time(disabled_at)),
            )
            .filter(trial_codes::Column::Id.eq(id))
            .exec(&self.db)
            .await?;
        Ok(())
    }
}

fn to_db_time(value: DateTime<Utc>) -> DateTime<chrono::FixedOffset> {
    value.with_timezone(&chrono::FixedOffset::east_opt(0).unwrap())
}

fn from_db_time(value: DateTime<chrono::FixedOffset>) -> DateTime<Utc> {
    value.with_timezone(&Utc)
}
