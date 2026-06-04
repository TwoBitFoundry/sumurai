pub use sea_orm_migration::prelude::*;

mod m20260528_000001_init;
mod m20260528_000002_webauthn_credentials;
mod m20260604_134107_merchant_normalization;
mod merchant_alias_seeds;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260528_000001_init::Migration),
            Box::new(m20260528_000002_webauthn_credentials::Migration),
            Box::new(m20260604_134107_merchant_normalization::Migration),
        ]
    }
}
