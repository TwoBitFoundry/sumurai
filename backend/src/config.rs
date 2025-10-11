use anyhow::Result;

#[derive(Clone)]
pub struct Config {
    #[allow(dead_code)]
    pub database_url: String,
    default_provider: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenv::dotenv().ok();

        let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgresql://postgres:password@localhost:5432/accounting".to_string()
        });

        let default_provider = std::env::var("DEFAULT_PROVIDER")
            .unwrap_or_else(|_| "teller".to_string());

        Ok(Self {
            database_url,
            default_provider,
        })
    }

    #[allow(dead_code)]
    pub fn default() -> Self {
        Self {
            database_url: "postgresql://postgres:password@localhost:5432/accounting".to_string(),
            default_provider: "teller".to_string(),
        }
    }

    pub fn get_default_provider(&self) -> &str {
        &self.default_provider
    }
}
