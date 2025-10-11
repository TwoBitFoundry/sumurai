pub mod trait_definition;
pub mod plaid_provider;

pub use trait_definition::{FinancialDataProvider, InstitutionInfo, ProviderCredentials};
pub use plaid_provider::PlaidProvider;
