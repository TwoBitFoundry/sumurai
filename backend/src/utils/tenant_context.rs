use sea_orm::{ConnectionTrait, DbBackend, Statement, Value};
use uuid::Uuid;

pub async fn set_tenant_context<C: ConnectionTrait>(
    conn: &C,
    user_id: Uuid,
) -> Result<(), sea_orm::DbErr> {
    conn.execute(tenant_set_config_statement(user_id)).await?;
    Ok(())
}

pub fn tenant_set_config_statement(user_id: Uuid) -> Statement {
    Statement::from_sql_and_values(
        DbBackend::Postgres,
        "SELECT set_config('app.current_user_id', $1, true)",
        [Value::from(user_id.to_string())],
    )
}
