use sea_orm::DatabaseConnection;

pub struct RepositoryPool(sea_orm::sqlx::PgPool);

impl RepositoryPool {
    pub fn from_database(db: &DatabaseConnection) -> Self {
        Self(db.get_postgres_connection_pool().clone())
    }

    pub fn from_pg_pool(pool: sea_orm::sqlx::PgPool) -> Self {
        Self(pool)
    }

    pub fn connection(&self) -> DatabaseConnection {
        self.0.clone().into()
    }
}
