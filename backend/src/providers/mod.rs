pub mod credential_resolver;
pub mod diy_provider;
pub mod paddle_provider;
pub mod plaid_credential_resolver;
pub mod plaid_provider;
pub mod registry;
pub mod simplefin_credential_resolver;
pub mod simplefin_provider;
pub mod trait_definition;

pub use credential_resolver::ProviderCredentialResolver;
pub use diy_provider::DiyProvider;
#[cfg(test)]
pub use paddle_provider::MockPaddleHttpClient;
pub use paddle_provider::{NoOpPaddleClient, PaddleClient, PaddleHttpClient};
pub use plaid_credential_resolver::PlaidCredentialResolver;
pub use plaid_provider::PlaidProvider;
pub use registry::ProviderRegistry;
pub use simplefin_credential_resolver::SimpleFinCredentialResolver;
pub use simplefin_provider::SimpleFinProvider;
#[cfg(test)]
pub use trait_definition::MockFinancialDataProvider;
pub use trait_definition::{FinancialDataProvider, InstitutionInfo, ProviderCredentials};
