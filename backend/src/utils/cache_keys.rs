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

