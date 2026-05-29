use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared(
            "CREATE FUNCTION update_users_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$",
        )
        .await?;

        db.execute_unprepared(
            "CREATE FUNCTION update_provider_connections_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$",
        )
        .await?;

        db.execute_unprepared(
            "CREATE FUNCTION update_budgets_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$",
        )
        .await?;

        db.execute_unprepared(
            "CREATE FUNCTION update_user_custom_categories_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$",
        )
        .await?;

        db.execute_unprepared(
            "CREATE FUNCTION update_transaction_category_overrides_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE users (
                id uuid DEFAULT gen_random_uuid() NOT NULL,
                email character varying NOT NULL,
                password_hash character varying NOT NULL,
                created_at timestamp with time zone DEFAULT now(),
                updated_at timestamp with time zone DEFAULT now(),
                onboarding_completed boolean DEFAULT false NOT NULL,
                provider character varying(20) DEFAULT 'teller' NOT NULL
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY users
                ADD CONSTRAINT users_pkey PRIMARY KEY (id),
                ADD CONSTRAINT users_email_key UNIQUE (email)",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE provider_connections (
                id uuid DEFAULT gen_random_uuid() NOT NULL,
                item_id character varying NOT NULL,
                is_connected boolean DEFAULT false NOT NULL,
                last_sync_at timestamp with time zone,
                connected_at timestamp with time zone DEFAULT now(),
                disconnected_at timestamp with time zone,
                institution_name character varying,
                transaction_count integer DEFAULT 0,
                account_count integer DEFAULT 0,
                created_at timestamp with time zone DEFAULT now(),
                updated_at timestamp with time zone DEFAULT now(),
                user_id uuid,
                institution_logo_url character varying,
                sync_cursor character varying,
                institution_id character varying,
                provider character varying(50) NOT NULL
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY provider_connections
                ADD CONSTRAINT provider_connections_pkey PRIMARY KEY (id),
                ADD CONSTRAINT provider_connections_item_id_key UNIQUE (item_id)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY provider_connections
                ADD CONSTRAINT provider_connections_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE provider_credentials (
                id uuid DEFAULT gen_random_uuid() NOT NULL,
                item_id character varying NOT NULL,
                encrypted_access_token bytea NOT NULL,
                created_at timestamp with time zone DEFAULT now(),
                updated_at timestamp with time zone DEFAULT now(),
                user_id uuid
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY provider_credentials
                ADD CONSTRAINT provider_credentials_pkey PRIMARY KEY (id),
                ADD CONSTRAINT provider_credentials_item_id_key UNIQUE (item_id)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY provider_credentials
                ADD CONSTRAINT provider_credentials_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE accounts (
                id uuid DEFAULT gen_random_uuid() NOT NULL,
                provider_account_id character varying,
                name character varying NOT NULL,
                account_type character varying NOT NULL,
                balance_current numeric(12,2),
                created_at timestamp with time zone DEFAULT now(),
                updated_at timestamp with time zone DEFAULT now(),
                user_id uuid,
                mask character varying(4),
                subtype character varying,
                official_name character varying,
                provider_connection_id uuid
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY accounts
                ADD CONSTRAINT accounts_pkey PRIMARY KEY (id),
                ADD CONSTRAINT accounts_plaid_account_id_key UNIQUE (provider_account_id)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY accounts
                ADD CONSTRAINT accounts_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                ADD CONSTRAINT fk_accounts_provider_connection
                    FOREIGN KEY (provider_connection_id) REFERENCES provider_connections(id) ON DELETE CASCADE",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE transactions (
                id uuid DEFAULT gen_random_uuid() NOT NULL,
                account_id uuid,
                provider_transaction_id character varying,
                amount numeric(12,2) NOT NULL,
                date date NOT NULL,
                merchant_name character varying,
                category_primary character varying NOT NULL,
                category_detailed character varying NOT NULL,
                category_confidence character varying NOT NULL,
                payment_channel character varying,
                pending boolean DEFAULT false,
                created_at timestamp with time zone DEFAULT now(),
                user_id uuid,
                normalized_merchant text GENERATED ALWAYS AS (
                    regexp_replace(lower(coalesce(merchant_name, '')), '[^a-z]', '', 'g')
                ) STORED
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY transactions
                ADD CONSTRAINT transactions_pkey PRIMARY KEY (id),
                ADD CONSTRAINT transactions_account_provider_transaction_id_unique
                    UNIQUE (account_id, provider_transaction_id)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY transactions
                ADD CONSTRAINT transactions_account_id_fkey
                    FOREIGN KEY (account_id) REFERENCES accounts(id),
                ADD CONSTRAINT transactions_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE budgets (
                id uuid DEFAULT gen_random_uuid() NOT NULL,
                user_id uuid NOT NULL,
                category character varying NOT NULL,
                amount numeric NOT NULL,
                created_at timestamp with time zone DEFAULT now(),
                updated_at timestamp with time zone DEFAULT now()
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY budgets
                ADD CONSTRAINT budgets_pkey PRIMARY KEY (id),
                ADD CONSTRAINT budgets_user_id_category_unique UNIQUE (user_id, category)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY budgets
                ADD CONSTRAINT budgets_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE user_custom_categories (
                id uuid DEFAULT gen_random_uuid() NOT NULL,
                user_id uuid NOT NULL,
                display_name character varying(30) NOT NULL,
                lookup_key character varying(30) NOT NULL,
                created_at timestamp with time zone DEFAULT now(),
                updated_at timestamp with time zone DEFAULT now()
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY user_custom_categories
                ADD CONSTRAINT user_custom_categories_pkey PRIMARY KEY (id),
                ADD CONSTRAINT user_custom_categories_user_id_lookup_key_key UNIQUE (user_id, lookup_key)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY user_custom_categories
                ADD CONSTRAINT user_custom_categories_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE transaction_category_overrides (
                id uuid DEFAULT gen_random_uuid() NOT NULL,
                user_id uuid NOT NULL,
                normalized_merchant text NOT NULL,
                category_name character varying(64) NOT NULL,
                custom_category_id uuid,
                created_at timestamp with time zone DEFAULT now(),
                updated_at timestamp with time zone DEFAULT now()
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY transaction_category_overrides
                ADD CONSTRAINT transaction_category_overrides_pkey PRIMARY KEY (id),
                ADD CONSTRAINT transaction_category_overrides_user_id_normalized_merchant_key
                    UNIQUE (user_id, normalized_merchant)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY transaction_category_overrides
                ADD CONSTRAINT transaction_category_overrides_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                ADD CONSTRAINT transaction_category_overrides_custom_category_id_fkey
                    FOREIGN KEY (custom_category_id) REFERENCES user_custom_categories(id) ON DELETE CASCADE",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE simplefin_hidden_orgs (
                user_id uuid NOT NULL,
                org_conn_id text NOT NULL,
                hidden_at timestamp with time zone DEFAULT now() NOT NULL,
                institution_name text
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY simplefin_hidden_orgs
                ADD CONSTRAINT simplefin_hidden_orgs_pkey PRIMARY KEY (user_id, org_conn_id)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY simplefin_hidden_orgs
                ADD CONSTRAINT simplefin_hidden_orgs_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE simplefin_root_credentials (
                user_id uuid NOT NULL,
                encrypted_access_url bytea NOT NULL,
                setup_token_used_at timestamp with time zone DEFAULT now() NOT NULL,
                created_at timestamp with time zone DEFAULT now() NOT NULL,
                updated_at timestamp with time zone DEFAULT now() NOT NULL
            )",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY simplefin_root_credentials
                ADD CONSTRAINT simplefin_root_credentials_pkey PRIMARY KEY (user_id)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE ONLY simplefin_root_credentials
                ADD CONSTRAINT simplefin_root_credentials_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        )
        .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_users_email")
                    .table(Alias::new("users"))
                    .col(Alias::new("email"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_users_onboarding_completed")
                    .table(Alias::new("users"))
                    .col(Alias::new("onboarding_completed"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_users_provider")
                    .table(Alias::new("users"))
                    .col(Alias::new("provider"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_connections_user_id_new")
                    .table(Alias::new("provider_connections"))
                    .col(Alias::new("user_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_connections_item_id")
                    .table(Alias::new("provider_connections"))
                    .col(Alias::new("item_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_connections_connected")
                    .table(Alias::new("provider_connections"))
                    .col(Alias::new("is_connected"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_connections_last_sync")
                    .table(Alias::new("provider_connections"))
                    .col((Alias::new("last_sync_at"), IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_connections_user_active")
                    .table(Alias::new("provider_connections"))
                    .col(Alias::new("user_id"))
                    .col(Alias::new("is_connected"))
                    .col((Alias::new("last_sync_at"), IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_connections_sync_cursor")
                    .table(Alias::new("provider_connections"))
                    .col(Alias::new("sync_cursor"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_connections_institution_id")
                    .table(Alias::new("provider_connections"))
                    .col(Alias::new("institution_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_connections_provider")
                    .table(Alias::new("provider_connections"))
                    .col(Alias::new("provider"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_credentials_item_id")
                    .table(Alias::new("provider_credentials"))
                    .col(Alias::new("item_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_credentials_user_id")
                    .table(Alias::new("provider_credentials"))
                    .col(Alias::new("user_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_provider_credentials_user_item")
                    .table(Alias::new("provider_credentials"))
                    .col(Alias::new("user_id"))
                    .col(Alias::new("item_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_accounts_user_id")
                    .table(Alias::new("accounts"))
                    .col(Alias::new("user_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_accounts_provider_id")
                    .table(Alias::new("accounts"))
                    .col(Alias::new("provider_account_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_accounts_provider_connection_id")
                    .table(Alias::new("accounts"))
                    .col(Alias::new("provider_connection_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_accounts_connection_type")
                    .table(Alias::new("accounts"))
                    .col(Alias::new("provider_connection_id"))
                    .col(Alias::new("account_type"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_accounts_mask")
                    .table(Alias::new("accounts"))
                    .col(Alias::new("mask"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_accounts_subtype")
                    .table(Alias::new("accounts"))
                    .col(Alias::new("subtype"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_accounts_user_name")
                    .table(Alias::new("accounts"))
                    .col(Alias::new("user_id"))
                    .col(Alias::new("name"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_accounts_user_type")
                    .table(Alias::new("accounts"))
                    .col(Alias::new("user_id"))
                    .col(Alias::new("account_type"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_transactions_account_id")
                    .table(Alias::new("transactions"))
                    .col(Alias::new("account_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_transactions_provider_id")
                    .table(Alias::new("transactions"))
                    .col(Alias::new("provider_transaction_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_transactions_date")
                    .table(Alias::new("transactions"))
                    .col((Alias::new("date"), IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_transactions_user_id")
                    .table(Alias::new("transactions"))
                    .col(Alias::new("user_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_transactions_user_date")
                    .table(Alias::new("transactions"))
                    .col(Alias::new("user_id"))
                    .col((Alias::new("date"), IndexOrder::Desc))
                    .col((Alias::new("created_at"), IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_transactions_user_category")
                    .table(Alias::new("transactions"))
                    .col(Alias::new("user_id"))
                    .col(Alias::new("category_primary"))
                    .col((Alias::new("date"), IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_transactions_user_norm_merchant")
                    .table(Alias::new("transactions"))
                    .col(Alias::new("user_id"))
                    .col(Alias::new("normalized_merchant"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_budgets_user_id")
                    .table(Alias::new("budgets"))
                    .col(Alias::new("user_id"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_budgets_category")
                    .table(Alias::new("budgets"))
                    .col(Alias::new("category"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_user_custom_categories_user")
                    .table(Alias::new("user_custom_categories"))
                    .col(Alias::new("user_id"))
                    .col(Alias::new("display_name"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_overrides_user_norm")
                    .table(Alias::new("transaction_category_overrides"))
                    .col(Alias::new("user_id"))
                    .col(Alias::new("normalized_merchant"))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_simplefin_hidden_orgs_user")
                    .table(Alias::new("simplefin_hidden_orgs"))
                    .col(Alias::new("user_id"))
                    .to_owned(),
            )
            .await?;

        db.execute_unprepared(
            "CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_users_updated_at()",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TRIGGER update_provider_connections_updated_at BEFORE UPDATE ON provider_connections FOR EACH ROW EXECUTE FUNCTION update_provider_connections_updated_at()",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_budgets_updated_at()",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TRIGGER update_user_custom_categories_updated_at BEFORE UPDATE ON user_custom_categories FOR EACH ROW EXECUTE FUNCTION update_user_custom_categories_updated_at()",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TRIGGER update_transaction_category_overrides_updated_at BEFORE UPDATE ON transaction_category_overrides FOR EACH ROW EXECUTE FUNCTION update_transaction_category_overrides_updated_at()",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE accounts ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY accounts_user_isolation ON accounts USING (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;
        db.execute_unprepared("CREATE POLICY accounts_user_policy ON accounts USING (true)")
            .await?;

        db.execute_unprepared("ALTER TABLE transactions ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY transactions_user_isolation ON transactions USING (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY provider_credentials_user_isolation ON provider_credentials USING (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY provider_connections_user_isolation ON provider_connections USING (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE budgets ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY budgets_user_isolation ON budgets USING (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE user_custom_categories ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY user_custom_categories_user_isolation ON user_custom_categories USING (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        db.execute_unprepared(
            "ALTER TABLE transaction_category_overrides ENABLE ROW LEVEL SECURITY",
        )
        .await?;
        db.execute_unprepared(
            "CREATE POLICY transaction_category_overrides_user_isolation ON transaction_category_overrides USING (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE simplefin_hidden_orgs ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY simplefin_hidden_orgs_isolation ON simplefin_hidden_orgs
                USING (user_id::text = current_setting('app.current_user_id', true))
                WITH CHECK (user_id::text = current_setting('app.current_user_id', true))",
        )
        .await?;

        db.execute_unprepared("ALTER TABLE simplefin_root_credentials ENABLE ROW LEVEL SECURITY")
            .await?;
        db.execute_unprepared(
            "CREATE POLICY simplefin_root_credentials_user_isolation ON simplefin_root_credentials
                USING (user_id = current_setting('app.current_user_id', true)::uuid)
                WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared("DROP TABLE IF EXISTS simplefin_root_credentials CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS simplefin_hidden_orgs CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS transaction_category_overrides CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS user_custom_categories CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS budgets CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS transactions CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS accounts CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS provider_credentials CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS provider_connections CASCADE")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS users CASCADE")
            .await?;

        db.execute_unprepared("DROP FUNCTION IF EXISTS update_users_updated_at()")
            .await?;
        db.execute_unprepared("DROP FUNCTION IF EXISTS update_provider_connections_updated_at()")
            .await?;
        db.execute_unprepared("DROP FUNCTION IF EXISTS update_budgets_updated_at()")
            .await?;
        db.execute_unprepared("DROP FUNCTION IF EXISTS update_user_custom_categories_updated_at()")
            .await?;
        db.execute_unprepared(
            "DROP FUNCTION IF EXISTS update_transaction_category_overrides_updated_at()",
        )
        .await?;

        Ok(())
    }
}
