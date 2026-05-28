use sea_orm::{Database, DatabaseConnection, EntityTrait, QuerySelect, Related};

async fn connect() -> Option<DatabaseConnection> {
    let url = match std::env::var("DATABASE_URL") {
        Ok(u) => u,
        Err(_) => {
            eprintln!("[entity_smoke_tests] Skipping: DATABASE_URL not set");
            return None;
        }
    };
    match Database::connect(&url).await {
        Ok(db) => Some(db),
        Err(e) => {
            eprintln!("[entity_smoke_tests] Skipping: cannot connect: {e}");
            None
        }
    }
}

#[tokio::test]
async fn transactions_entity_compiles_and_queries() {
    let Some(db) = connect().await else { return };
    entity::transactions::Entity::find()
        .limit(1)
        .all(&db)
        .await
        .expect("transactions query failed");
}

#[tokio::test]
async fn accounts_entity_compiles_and_queries() {
    let Some(db) = connect().await else { return };
    entity::accounts::Entity::find()
        .limit(1)
        .all(&db)
        .await
        .expect("accounts query failed");
}

#[tokio::test]
async fn budgets_entity_compiles_and_queries() {
    let Some(db) = connect().await else { return };
    entity::budgets::Entity::find()
        .limit(1)
        .all(&db)
        .await
        .expect("budgets query failed");
}

#[tokio::test]
async fn user_custom_categories_entity_compiles_and_queries() {
    let Some(db) = connect().await else { return };
    entity::user_custom_categories::Entity::find()
        .limit(1)
        .all(&db)
        .await
        .expect("user_custom_categories query failed");
}

#[tokio::test]
async fn provider_credentials_entity_compiles_and_queries() {
    let Some(db) = connect().await else { return };
    entity::provider_credentials::Entity::find()
        .limit(1)
        .all(&db)
        .await
        .expect("provider_credentials query failed");
}

#[tokio::test]
async fn users_to_accounts_relation_traversable() {
    let Some(db) = connect().await else { return };
    entity::users::Entity::find()
        .find_with_related(entity::accounts::Entity)
        .all(&db)
        .await
        .expect("users -> accounts relation failed");
}

#[tokio::test]
async fn accounts_to_transactions_relation_traversable() {
    let Some(db) = connect().await else { return };
    entity::accounts::Entity::find()
        .find_with_related(entity::transactions::Entity)
        .all(&db)
        .await
        .expect("accounts -> transactions relation failed");
}

#[tokio::test]
async fn transactions_to_accounts_relation_traversable() {
    let Some(db) = connect().await else { return };
    entity::transactions::Entity::find()
        .find_also_related(entity::accounts::Entity)
        .limit(5)
        .all(&db)
        .await
        .expect("transactions -> accounts relation failed");
}

#[tokio::test]
async fn transactions_category_override_relation_compiles() {
    fn _assert_related() {
        fn _check<E: Related<entity::transaction_category_overrides::Entity>>() {}
        _check::<entity::users::Entity>();
    }
}
