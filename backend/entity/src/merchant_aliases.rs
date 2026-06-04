use sea_orm::entity::prelude::*;

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "merchant_aliases"
    }
}

#[derive(Clone, Debug, PartialEq, DeriveModel, DeriveActiveModel, Eq)]
pub struct Model {
    pub id: Uuid,
    pub match_type: String,
    pub match_key: String,
    pub canonical_name: String,
    pub priority: i32,
    pub is_active: bool,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Id,
    MatchType,
    MatchKey,
    CanonicalName,
    Priority,
    IsActive,
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
pub enum Relation {}

impl ColumnTrait for Column {
    type EntityName = Entity;
    fn def(&self) -> ColumnDef {
        match self {
            Self::Id => ColumnType::Uuid.def(),
            Self::MatchType => ColumnType::Text.def(),
            Self::MatchKey => ColumnType::Text.def(),
            Self::CanonicalName => ColumnType::Text.def(),
            Self::Priority => ColumnType::Integer.def(),
            Self::IsActive => ColumnType::Boolean.def(),
            Self::CreatedAt => ColumnType::TimestampWithTimeZone.def(),
            Self::UpdatedAt => ColumnType::TimestampWithTimeZone.def(),
        }
    }
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        panic!("No RelationDef")
    }
}

impl ActiveModelBehavior for ActiveModel {}
