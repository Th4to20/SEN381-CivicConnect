-- 001_initial_schema.sql
-- CivicConnect initial schema (PED v2.0, ADR-001).
-- Database owns STRUCTURAL rules: FKs, NOT NULL, CHECK, controlled reference values.
-- Workflow rules (which transition is legal, who may perform it) live in the
-- service layer (Approach A, Assignment 2 s2.3-2.4). Traces: FR-010, NFR-005, NFR-006.

-- ---------- Controlled reference data (NFR-006: only predefined values) ----------
CREATE TABLE roles (
  id   smallint PRIMARY KEY,
  name text NOT NULL UNIQUE
);
INSERT INTO roles (id, name) VALUES (1, 'requester'), (2, 'staff'), (3, 'management');

CREATE TABLE request_categories (
  id   smallint PRIMARY KEY,
  name text NOT NULL UNIQUE
);
INSERT INTO request_categories (id, name) VALUES
  (1, 'Facility Fault'), (2, 'Damaged Equipment'), (3, 'Security Concern'),
  (4, 'IT Support'), (5, 'Maintenance'), (6, 'Lost Property'), (7, 'Other');

CREATE TABLE request_statuses (
  id         smallint PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  sort_order smallint NOT NULL UNIQUE
);
INSERT INTO request_statuses (id, name, sort_order) VALUES
  (1, 'Submitted', 1), (2, 'Assigned', 2), (3, 'In Progress', 3),
  (4, 'Resolved', 4), (5, 'Closed', 5);

-- ---------- Users (FR-015) ----------
CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name  text NOT NULL CHECK (length(btrim(display_name)) > 0),
  password_hash text NOT NULL,                -- NFR-004: hashed, never plaintext
  role_id       smallint NOT NULL REFERENCES roles (id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- ServiceRequest (FR-001, FR-009, FR-010) ----------
CREATE SEQUENCE request_reference_seq START 1;

CREATE TABLE service_requests (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference_no   text NOT NULL UNIQUE DEFAULT
                 ('CC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('request_reference_seq')::text, 6, '0')),
  requester_id   bigint   NOT NULL REFERENCES users (id),
  category_id    smallint NOT NULL REFERENCES request_categories (id),
  description    text     NOT NULL CHECK (length(btrim(description)) > 0),
  location       text     NOT NULL CHECK (length(btrim(location)) > 0),
  attachment_url text,
  status_id      smallint NOT NULL DEFAULT 1 REFERENCES request_statuses (id),
  assigned_to    bigint   REFERENCES users (id),
  -- Optimistic concurrency token (ADR-001). Compared in the UPDATE predicate and
  -- incremented by the service layer on every change. Postgres has no SQL Server
  -- style rowversion type, so this is an explicit counter.
  row_version    bigint   NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_service_requests_requester ON service_requests (requester_id, created_at DESC);
CREATE INDEX ix_service_requests_status    ON service_requests (status_id);
CREATE INDEX ix_service_requests_assigned  ON service_requests (assigned_to);

-- ---------- AuditEntry (NFR-005) ----------
-- Append-only. Written in the SAME transaction as the change it records.
CREATE TABLE audit_entries (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_request_id bigint NOT NULL REFERENCES service_requests (id),
  actor_user_id      bigint NOT NULL REFERENCES users (id),
  action_type        text   NOT NULL
                     CHECK (action_type IN ('REQUEST_CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'COMMENT_ADDED')),
  old_value          text,
  new_value          text,
  comment            text,
  occurred_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entries_request ON audit_entries (service_request_id, occurred_at);
