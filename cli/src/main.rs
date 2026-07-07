use std::process::ExitCode;

use chrono::{DateTime, Utc};
use clap::{Parser, Subcommand};
use sumurai_cli::{
    create_trial_code, disable_trial_code, list_trial_codes, reset_passkeys,
    PostgresPasskeyResetStore,
};

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
    #[command(about = "Manage SaaS billing trial codes")]
    TrialCodes {
        #[command(subcommand)]
        command: TrialCodeCommands,
    },
}

#[derive(Subcommand)]
enum TrialCodeCommands {
    #[command(about = "Create a single-use trial code")]
    Create {
        #[arg(long)]
        code: String,
        #[arg(long, help = "RFC3339 timestamp")]
        redeem_by: String,
        #[arg(long, env = "TRIAL_CODE_HASH_KEY")]
        hash_key: String,
    },
    #[command(about = "List trial-code metadata without plaintext codes")]
    List,
    #[command(about = "Disable a trial code by ID")]
    Disable { id: uuid::Uuid },
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
        Commands::TrialCodes { command } => {
            let store = connect_store("trial-codes").await?;
            match command {
                TrialCodeCommands::Create {
                    code,
                    redeem_by,
                    hash_key,
                } => {
                    let redeem_by_at = DateTime::parse_from_rfc3339(&redeem_by)
                        .map_err(|error| anyhow::anyhow!("Invalid redeem-by timestamp: {error}"))?
                        .with_timezone(&Utc);
                    let created = create_trial_code(&store, &hash_key, &code, redeem_by_at).await?;
                    println!(
                        "Trial code created: id={} code={} redeem_by={} hash={}",
                        created.id, created.code, created.redeem_by_at, created.code_hash
                    );
                    Ok(())
                }
                TrialCodeCommands::List => {
                    for record in list_trial_codes(&store).await? {
                        println!(
                            "{} hash={} redeem_by={} redeemed_at={} disabled_at={}",
                            record.id,
                            record.code_hash,
                            record.redeem_by_at,
                            record
                                .redeemed_at
                                .map(|value| value.to_rfc3339())
                                .unwrap_or_else(|| "none".to_string()),
                            record
                                .disabled_at
                                .map(|value| value.to_rfc3339())
                                .unwrap_or_else(|| "none".to_string())
                        );
                    }
                    Ok(())
                }
                TrialCodeCommands::Disable { id } => {
                    let message = disable_trial_code(&store, id).await?;
                    println!("{message}");
                    Ok(())
                }
            }
        }
    }
}

async fn connect_store(command: &str) -> Result<PostgresPasskeyResetStore, anyhow::Error> {
    let database_url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL is required to run {command}"))?;
    Ok(PostgresPasskeyResetStore::connect(&database_url).await?)
}
