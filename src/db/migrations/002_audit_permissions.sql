-- 002_audit_permissions.sql
-- Makes the audit trail immutable by PERMISSION, with a guard trigger as backstop
-- (ADR-001; Assignment 2 s2.2.3). The trigger contains no business logic: it only
-- refuses UPDATE/DELETE, so it does not reintroduce the hidden-logic problem that
-- ruled out Approach B.

CREATE OR REPLACE FUNCTION audit_entries_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_entries is append-only (% blocked)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_entries_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_entries
  FOR EACH ROW EXECUTE FUNCTION audit_entries_immutable();

-- Group role the application logs in through. It is created NOLOGIN here so that no
-- password lives in the repo; create the login role manually (docs/deployment/).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'civicconnect_app') THEN
    CREATE ROLE civicconnect_app NOLOGIN;
  END IF;
END $$;

GRANT SELECT ON roles, request_categories, request_statuses TO civicconnect_app;
GRANT SELECT, INSERT, UPDATE ON users, service_requests TO civicconnect_app;
GRANT SELECT, INSERT ON audit_entries TO civicconnect_app;   -- deliberately no UPDATE / DELETE
GRANT USAGE ON SEQUENCE request_reference_seq TO civicconnect_app;
-- identity-column sequences are covered by the INSERT privilege on their tables.
