use std::process::ExitCode;

use clap::{Parser, Subcommand};
use sumurai_cli::{reset_passkeys, PostgresAdminStore};

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

async fn run() -> Result<(), anyhow::Error> {
    let cli = Cli::parse();

    match cli.command {
        Commands::ResetPasskeys { identifier } => {
            let store = connect_store("reset-passkeys").await?;

            let message = reset_passkeys(&store, &identifier).await?;
            println!("{message}");
            Ok(())
        }
    }
}

async fn connect_store(command: &str) -> Result<PostgresAdminStore, anyhow::Error> {
    let database_url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL is required to run {command}"))?;
    Ok(PostgresAdminStore::connect(&database_url).await?)
}
