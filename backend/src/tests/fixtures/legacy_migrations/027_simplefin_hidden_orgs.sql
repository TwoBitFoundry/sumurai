CREATE TABLE simplefin_hidden_orgs (
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_conn_id TEXT        NOT NULL,
    hidden_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, org_conn_id)
);

ALTER TABLE simplefin_hidden_orgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY simplefin_hidden_orgs_isolation ON simplefin_hidden_orgs
    USING      (user_id::text = current_setting('app.current_user_id', true))
    WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE INDEX idx_simplefin_hidden_orgs_user ON simplefin_hidden_orgs(user_id);
