use std::collections::HashSet;
use uuid::Uuid;

pub fn generate_cache_key_with_account_filter(
    base_key: &str,
    account_ids: Option<&HashSet<Uuid>>,
) -> String {
    if let Some(account_ids) = account_ids {
        let mut sorted_ids: Vec<_> = account_ids.iter().collect();
        sorted_ids.sort();
        let ids_hash = {
            use std::hash::{Hash, Hasher};
            let mut hasher = std::hash::DefaultHasher::new();
            for id in sorted_ids {
                id.hash(&mut hasher);
            }
            hasher.finish()
        };
        format!("{}_{:x}", base_key, ids_hash)
    } else {
        base_key.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn given_no_account_filter_when_generating_cache_key_then_returns_base_key() {
        let result = generate_cache_key_with_account_filter("test_key", None);
        assert_eq!(result, "test_key");
    }

    #[test]
    fn given_account_filter_when_generating_cache_key_then_returns_extended_key() {
        let account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
        let mut account_ids = HashSet::new();
        account_ids.insert(account_id);

        let result = generate_cache_key_with_account_filter("test_key", Some(&account_ids));
        assert!(result.starts_with("test_key_"));
        assert!(result.len() > "test_key_".len());
    }

    #[test]
    fn given_different_account_filters_when_generating_cache_key_then_returns_different_keys() {
        let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
        let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();

        let mut account_ids_1 = HashSet::new();
        account_ids_1.insert(account_id_1);

        let mut account_ids_2 = HashSet::new();
        account_ids_2.insert(account_id_2);

        let result1 = generate_cache_key_with_account_filter("test_key", Some(&account_ids_1));
        let result2 = generate_cache_key_with_account_filter("test_key", Some(&account_ids_2));

        assert_ne!(result1, result2);
    }

    #[test]
    fn given_same_account_filter_when_generating_cache_key_then_returns_same_key() {
        let account_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
        let mut account_ids = HashSet::new();
        account_ids.insert(account_id);

        let result1 = generate_cache_key_with_account_filter("test_key", Some(&account_ids));
        let result2 = generate_cache_key_with_account_filter("test_key", Some(&account_ids));

        assert_eq!(result1, result2);
    }

    #[test]
    fn given_multiple_accounts_in_different_order_when_generating_cache_key_then_returns_same_key() {
        let account_id_1 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();
        let account_id_2 = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440002").unwrap();

        let mut account_ids_1 = HashSet::new();
        account_ids_1.insert(account_id_1);
        account_ids_1.insert(account_id_2);

        let mut account_ids_2 = HashSet::new();
        account_ids_2.insert(account_id_2);
        account_ids_2.insert(account_id_1);

        let result1 = generate_cache_key_with_account_filter("test_key", Some(&account_ids_1));
        let result2 = generate_cache_key_with_account_filter("test_key", Some(&account_ids_2));

        assert_eq!(result1, result2);
    }
}