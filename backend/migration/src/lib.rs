pub use sea_orm_migration::prelude::*;

mod m20260528_000001_init;
mod m20260528_000002_webauthn_credentials;
mod m20260604_134107_merchant_normalization;
mod m20260605_000003_transaction_normalization_cutover;
mod m20260613_000006_transaction_keyset_index;
mod m20260622_000007_user_demo_mode_active;
mod m20260706_000008_billing_entitlements;
pub mod merchant_alias_seeds;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260528_000001_init::Migration),
            Box::new(m20260528_000002_webauthn_credentials::Migration),
            Box::new(m20260604_134107_merchant_normalization::Migration),
            Box::new(m20260605_000003_transaction_normalization_cutover::Migration),
            Box::new(m20260613_000006_transaction_keyset_index::Migration),
            Box::new(m20260622_000007_user_demo_mode_active::Migration),
            Box::new(m20260706_000008_billing_entitlements::Migration),
        ]
    }
}
