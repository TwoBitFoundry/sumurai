use std::process::ExitCode;

use clap::{Parser, Subcommand};
use sumurai_cli::{reset_passkeys, PostgresPasskeyResetStore, ResetPasskeysError};

#[derive(Parser)]
#[command(name = "sumurai", about = "Sumurai operator CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    #[command(about = "Clear all passkeys for a user so they can enroll again")]
    ResetPasskeys {
        #[arg(help = "User email or UUID")]
        identifier: String,
    },
}

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::from(1)
        }
    }
}

async fn run() -> Result<(), ResetPasskeysError> {
    let cli = Cli::parse();

    match cli.command {
        Commands::ResetPasskeys { identifier } => {
            let database_url = std::env::var("DATABASE_URL").map_err(|_| {
                ResetPasskeysError::Database(anyhow::anyhow!(
                    "DATABASE_URL is required to run reset-passkeys"
                ))
            })?;

            let store = PostgresPasskeyResetStore::connect(&database_url)
                .await
                .map_err(|error| ResetPasskeysError::Database(error.into()))?;

            let message = reset_passkeys(&store, &identifier).await?;
            println!("{message}");
            Ok(())
        }
    }
}
