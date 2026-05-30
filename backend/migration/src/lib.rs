pub use sea_orm_migration::prelude::*;

mod m20260528_000001_init;
mod m20260528_000002_webauthn_credentials;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260528_000001_init::Migration),
            Box::new(m20260528_000002_webauthn_credentials::Migration),
        ]
    }
}
