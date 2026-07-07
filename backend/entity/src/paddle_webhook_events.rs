use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "paddle_webhook_events"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Serialize, Deserialize)]
pub struct Model {
    pub event_id: String,
    pub event_type: String,
    pub occurred_at: DateTimeWithTimeZone,
    pub processed_at: DateTimeWithTimeZone,
    pub processing_status: String,
    pub related_user_id: Option<Uuid>,
    pub related_subscription_id: Option<String>,
    pub error_code: Option<String>,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    EventId,
    EventType,
    OccurredAt,
    ProcessedAt,
    ProcessingStatus,
    RelatedUserId,
    RelatedSubscriptionId,
    ErrorCode,
    CreatedAt,
}

#[derive(Copy, Clone, Debug, EnumIter, DerivePrimaryKey)]
pub enum PrimaryKey {
    EventId,
}

impl PrimaryKeyTrait for PrimaryKey {
    type ValueType = String;
    fn auto_increment() -> bool {
        false
    }
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {
    RelatedUsers,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::EventId => ColumnType::Text.def(),
            Self::EventType => ColumnType::Text.def(),
            Self::OccurredAt => ColumnType::TimestampWithTimeZone.def(),
            Self::ProcessedAt => ColumnType::TimestampWithTimeZone.def(),
            Self::ProcessingStatus => ColumnType::Text.def(),
            Self::RelatedUserId => ColumnType::Uuid.def().null(),
            Self::RelatedSubscriptionId => ColumnType::Text.def().null(),
            Self::ErrorCode => ColumnType::Text.def().null(),
            Self::CreatedAt => ColumnType::TimestampWithTimeZone.def(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::RelatedUsers => Entity::belongs_to(super::users::Entity)
                .from(Column::RelatedUserId)
                .to(super::users::Column::Id)
                .on_delete(ForeignKeyAction::SetNull)
                .into(),
        }
    }
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RelatedUsers.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
