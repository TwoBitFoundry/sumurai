use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "trial_codes"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq, Serialize, Deserialize)]
pub struct Model {
    pub id: Uuid,
    pub code_hash: String,
    pub redeem_by_at: DateTimeWithTimeZone,
    pub redeemed_at: Option<DateTimeWithTimeZone>,
    pub redeemed_by_user_id: Option<Uuid>,
    pub disabled_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    CodeHash,
    RedeemByAt,
    RedeemedAt,
    RedeemedByUserId,
    DisabledAt,
    CreatedAt,
    UpdatedAt,
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
    RedeemedByUsers,
    TrialCodeRedemptions,
}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::CodeHash => ColumnType::Text.def().unique(),
            Self::RedeemByAt => ColumnType::TimestampWithTimeZone.def(),
            Self::RedeemedAt => ColumnType::TimestampWithTimeZone.def().null(),
            Self::RedeemedByUserId => ColumnType::Uuid.def().null(),
            Self::DisabledAt => ColumnType::TimestampWithTimeZone.def().null(),
            Self::CreatedAt => ColumnType::TimestampWithTimeZone.def(),
            Self::UpdatedAt => ColumnType::TimestampWithTimeZone.def(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::RedeemedByUsers => Entity::belongs_to(super::users::Entity)
                .from(Column::RedeemedByUserId)
                .to(super::users::Column::Id)
                .into(),
            Self::TrialCodeRedemptions => {
                Entity::has_many(super::trial_code_redemptions::Entity).into()
            }
        }
    }
}

impl Related<super::trial_code_redemptions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TrialCodeRedemptions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
