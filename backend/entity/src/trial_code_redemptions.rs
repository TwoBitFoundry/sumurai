use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "trial_code_redemptions"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub trial_code_id: Uuid,
    pub user_id: Uuid,
    pub status: String,
    pub paddle_transaction_id: Option<String>,
    pub paddle_subscription_id: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    pub fulfilled_at: Option<DateTimeWithTimeZone>,
    pub failed_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    TrialCodeId,
    UserId,
    Status,
    PaddleTransactionId,
    PaddleSubscriptionId,
    CreatedAt,
    UpdatedAt,
    FulfilledAt,
    FailedAt,
}

#[derive(Copy, Clone, Debug, EnumIter, DerivePrimaryKey)]
pub enum PrimaryKey {
    Id,
}

impl PrimaryKeyTrait for PrimaryKey {
    type ValueType = Uuid;
    fn auto_increment() -> bool {
        false
    }
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {
    TrialCodes,
    Users,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::TrialCodeId => ColumnType::Uuid.def(),
            Self::UserId => ColumnType::Uuid.def(),
            Self::Status => ColumnType::Text.def(),
            Self::PaddleTransactionId => ColumnType::Text.def().null().unique(),
            Self::PaddleSubscriptionId => ColumnType::Text.def().null().unique(),
            Self::CreatedAt => ColumnType::TimestampWithTimeZone.def(),
            Self::UpdatedAt => ColumnType::TimestampWithTimeZone.def(),
            Self::FulfilledAt => ColumnType::TimestampWithTimeZone.def().null(),
            Self::FailedAt => ColumnType::TimestampWithTimeZone.def().null(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::TrialCodes => Entity::belongs_to(super::trial_codes::Entity)
                .from(Column::TrialCodeId)
                .to(super::trial_codes::Column::Id)
                .on_delete(ForeignKeyAction::Cascade)
                .into(),
            Self::Users => Entity::belongs_to(super::users::Entity)
                .from(Column::UserId)
                .to(super::users::Column::Id)
                .on_delete(ForeignKeyAction::Cascade)
                .into(),
        }
    }
}

impl Related<super::trial_codes::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TrialCodes.def()
    }
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Users.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
