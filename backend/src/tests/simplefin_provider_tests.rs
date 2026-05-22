use crate::providers::simplefin_provider::SimpleFinProvider;
use crate::providers::trait_definition::FinancialDataProvider;

#[test]
fn given_simplefin_provider_when_provider_name_then_returns_simplefin() {
    let provider = SimpleFinProvider::new();

    assert_eq!(provider.provider_name(), "simplefin");
}
