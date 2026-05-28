


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE FUNCTION public.update_budgets_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;



CREATE FUNCTION public.update_provider_connections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;



CREATE FUNCTION public.update_transaction_category_overrides_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;



CREATE FUNCTION public.update_user_custom_categories_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;



CREATE FUNCTION public.update_users_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;


CREATE TABLE public._sqlx_migrations (
    version bigint NOT NULL,
    description text NOT NULL,
    installed_on timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    checksum bytea NOT NULL,
    execution_time bigint NOT NULL
);



CREATE TABLE public.accounts (
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
);



CREATE TABLE public.budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category character varying NOT NULL,
    amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



CREATE TABLE public.provider_connections (
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
);



CREATE TABLE public.provider_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id character varying NOT NULL,
    encrypted_access_token bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid
);



CREATE TABLE public.simplefin_hidden_orgs (
    user_id uuid NOT NULL,
    org_conn_id text NOT NULL,
    hidden_at timestamp with time zone DEFAULT now() NOT NULL,
    institution_name text
);



CREATE TABLE public.simplefin_root_credentials (
    user_id uuid NOT NULL,
    encrypted_access_url bytea NOT NULL,
    setup_token_used_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE public.transaction_category_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    normalized_merchant text NOT NULL,
    category_name character varying(64) NOT NULL,
    custom_category_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



CREATE TABLE public.transactions (
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
    normalized_merchant text GENERATED ALWAYS AS (regexp_replace(lower((COALESCE(merchant_name, ''::character varying))::text), '[^a-z]'::text, ''::text, 'g'::text)) STORED
);



CREATE TABLE public.user_custom_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    display_name character varying(30) NOT NULL,
    lookup_key character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying NOT NULL,
    password_hash character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    onboarding_completed boolean DEFAULT false NOT NULL,
    provider character varying(20) DEFAULT 'teller'::character varying NOT NULL
);



ALTER TABLE ONLY public._sqlx_migrations
    ADD CONSTRAINT _sqlx_migrations_pkey PRIMARY KEY (version);



ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_plaid_account_id_key UNIQUE (provider_account_id);



ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_user_id_category_unique UNIQUE (user_id, category);



ALTER TABLE ONLY public.provider_connections
    ADD CONSTRAINT provider_connections_item_id_key UNIQUE (item_id);



ALTER TABLE ONLY public.provider_connections
    ADD CONSTRAINT provider_connections_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.provider_credentials
    ADD CONSTRAINT provider_credentials_item_id_key UNIQUE (item_id);



ALTER TABLE ONLY public.provider_credentials
    ADD CONSTRAINT provider_credentials_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.simplefin_hidden_orgs
    ADD CONSTRAINT simplefin_hidden_orgs_pkey PRIMARY KEY (user_id, org_conn_id);



ALTER TABLE ONLY public.simplefin_root_credentials
    ADD CONSTRAINT simplefin_root_credentials_pkey PRIMARY KEY (user_id);



ALTER TABLE ONLY public.transaction_category_overrides
    ADD CONSTRAINT transaction_category_overrides_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.transaction_category_overrides
    ADD CONSTRAINT transaction_category_overrides_user_id_normalized_merchant_key UNIQUE (user_id, normalized_merchant);



ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_provider_transaction_id_unique UNIQUE (account_id, provider_transaction_id);



ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.user_custom_categories
    ADD CONSTRAINT user_custom_categories_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.user_custom_categories
    ADD CONSTRAINT user_custom_categories_user_id_lookup_key_key UNIQUE (user_id, lookup_key);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);



ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);



CREATE INDEX idx_accounts_connection_type ON public.accounts USING btree (provider_connection_id, account_type);



CREATE INDEX idx_accounts_mask ON public.accounts USING btree (mask);



CREATE INDEX idx_accounts_provider_connection_id ON public.accounts USING btree (provider_connection_id);



CREATE INDEX idx_accounts_provider_id ON public.accounts USING btree (provider_account_id);



CREATE INDEX idx_accounts_subtype ON public.accounts USING btree (subtype);



CREATE INDEX idx_accounts_user_id ON public.accounts USING btree (user_id);



CREATE INDEX idx_accounts_user_name ON public.accounts USING btree (user_id, name);



CREATE INDEX idx_accounts_user_type ON public.accounts USING btree (user_id, account_type);



CREATE INDEX idx_budgets_category ON public.budgets USING btree (category);



CREATE INDEX idx_budgets_user_id ON public.budgets USING btree (user_id);



CREATE INDEX idx_overrides_user_norm ON public.transaction_category_overrides USING btree (user_id, normalized_merchant);



CREATE INDEX idx_provider_connections_connected ON public.provider_connections USING btree (is_connected);



CREATE INDEX idx_provider_connections_institution_id ON public.provider_connections USING btree (institution_id);



CREATE INDEX idx_provider_connections_item_id ON public.provider_connections USING btree (item_id);



CREATE INDEX idx_provider_connections_last_sync ON public.provider_connections USING btree (last_sync_at DESC);



CREATE INDEX idx_provider_connections_provider ON public.provider_connections USING btree (provider);



CREATE INDEX idx_provider_connections_sync_cursor ON public.provider_connections USING btree (sync_cursor);



CREATE INDEX idx_provider_connections_user_active ON public.provider_connections USING btree (user_id, is_connected, last_sync_at DESC);



CREATE INDEX idx_provider_connections_user_id_new ON public.provider_connections USING btree (user_id);



CREATE INDEX idx_provider_credentials_item_id ON public.provider_credentials USING btree (item_id);



CREATE INDEX idx_provider_credentials_user_id ON public.provider_credentials USING btree (user_id);



CREATE INDEX idx_provider_credentials_user_item ON public.provider_credentials USING btree (user_id, item_id);



CREATE INDEX idx_simplefin_hidden_orgs_user ON public.simplefin_hidden_orgs USING btree (user_id);



CREATE INDEX idx_transactions_account_id ON public.transactions USING btree (account_id);



CREATE INDEX idx_transactions_date ON public.transactions USING btree (date DESC);



CREATE INDEX idx_transactions_provider_id ON public.transactions USING btree (provider_transaction_id);



CREATE INDEX idx_transactions_user_category ON public.transactions USING btree (user_id, category_primary, date DESC);



CREATE INDEX idx_transactions_user_date ON public.transactions USING btree (user_id, date DESC, created_at DESC);



CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);



CREATE INDEX idx_transactions_user_norm_merchant ON public.transactions USING btree (user_id, normalized_merchant);



CREATE INDEX idx_user_custom_categories_user ON public.user_custom_categories USING btree (user_id, display_name);



CREATE INDEX idx_users_email ON public.users USING btree (email);



CREATE INDEX idx_users_onboarding_completed ON public.users USING btree (onboarding_completed);



CREATE INDEX idx_users_provider ON public.users USING btree (provider);



CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_budgets_updated_at();



CREATE TRIGGER update_provider_connections_updated_at BEFORE UPDATE ON public.provider_connections FOR EACH ROW EXECUTE FUNCTION public.update_provider_connections_updated_at();



CREATE TRIGGER update_transaction_category_overrides_updated_at BEFORE UPDATE ON public.transaction_category_overrides FOR EACH ROW EXECUTE FUNCTION public.update_transaction_category_overrides_updated_at();



CREATE TRIGGER update_user_custom_categories_updated_at BEFORE UPDATE ON public.user_custom_categories FOR EACH ROW EXECUTE FUNCTION public.update_user_custom_categories_updated_at();



CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_users_updated_at();



ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT fk_accounts_provider_connection FOREIGN KEY (provider_connection_id) REFERENCES public.provider_connections(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.provider_connections
    ADD CONSTRAINT provider_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.provider_credentials
    ADD CONSTRAINT provider_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.simplefin_hidden_orgs
    ADD CONSTRAINT simplefin_hidden_orgs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.simplefin_root_credentials
    ADD CONSTRAINT simplefin_root_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.transaction_category_overrides
    ADD CONSTRAINT transaction_category_overrides_custom_category_id_fkey FOREIGN KEY (custom_category_id) REFERENCES public.user_custom_categories(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.transaction_category_overrides
    ADD CONSTRAINT transaction_category_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);



ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE ONLY public.user_custom_categories
    ADD CONSTRAINT user_custom_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;



ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;


CREATE POLICY accounts_user_isolation ON public.accounts USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));



CREATE POLICY accounts_user_policy ON public.accounts USING (true);



ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;


CREATE POLICY budgets_user_isolation ON public.budgets USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));



ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;


CREATE POLICY provider_connections_user_isolation ON public.provider_connections USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));



ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;


CREATE POLICY provider_credentials_user_isolation ON public.provider_credentials USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));



ALTER TABLE public.simplefin_hidden_orgs ENABLE ROW LEVEL SECURITY;


CREATE POLICY simplefin_hidden_orgs_isolation ON public.simplefin_hidden_orgs USING (((user_id)::text = current_setting('app.current_user_id'::text, true))) WITH CHECK (((user_id)::text = current_setting('app.current_user_id'::text, true)));



ALTER TABLE public.simplefin_root_credentials ENABLE ROW LEVEL SECURITY;


CREATE POLICY simplefin_root_credentials_user_isolation ON public.simplefin_root_credentials USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid)) WITH CHECK ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));



ALTER TABLE public.transaction_category_overrides ENABLE ROW LEVEL SECURITY;


CREATE POLICY transaction_category_overrides_user_isolation ON public.transaction_category_overrides USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));



ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;


CREATE POLICY transactions_user_isolation ON public.transactions USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));



ALTER TABLE public.user_custom_categories ENABLE ROW LEVEL SECURITY;


CREATE POLICY user_custom_categories_user_isolation ON public.user_custom_categories USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));




