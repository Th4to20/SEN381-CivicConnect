# ADR-008: Attachment Storage and Ephemeral Filesystem Strategy

| Field | Value |
|---|---|
| Status | Accepted (Milestone 3 Baseline) |
| Date | 2026-10-16 |
| Deciders | Daluvuyo Magagane (Quality & Architecture Lead), Thato Goqo (Technical Lead) |
| Requirements | FR-001, NFR-009; PED v2.0 Section 25.2 (Open Decision) |
| Supersedes | None (Fulfills M2 Deferred Item) |

---

## 1. Context & Problem
Requirement FR-001 allows citizens lodging a service request to provide an optional attachment (e.g., photo of a pothole, leaking pipe, or damaged equipment).
However, vendor documentation for Render Free web services establishes that **Render’s local filesystem is ephemeral**: whenever the application container hibernates after 15 minutes of inactivity or redeploys, any files saved to local disk storage (`/uploads`) are permanently wiped (PED Section 18.1). Storing attachments on local disk would result in severe data loss for citizen evidence.

## 2. Decision Drivers
- **ASR-1 (Data Integrity)**: Attachments linked to service requests must remain permanently accessible for the duration of the ticket lifecycle.
- **ASR-3 (Cost & Free-Tier Fit)**: Must incur zero infrastructure cost ($0 budget, NFR-009).
- **Security & Privacy (NFR-004)**: Untrusted citizen file uploads must not compromise the server (risk of arbitrary code execution).

## 3. Options Considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Local container disk storage (`/uploads`)** | Trivial to implement. | Ephemeral; all files deleted on spin-down; immediate data loss. | Rejected |
| **B. PostgreSQL BLOB (`bytea`) storage** | Centralised inside PostgreSQL backup; durable. | Rapidly exhausts Neon Free 0.5 GB storage quota; inflates database backup size; degrades query performance. | Rejected |
| **C. External S3-Compatible Object Storage with Presigned URLs** | Durable, independent of container lifecycle; offloads upload bandwidth; files served directly from CDN; free tier available (Cloudinary or AWS S3). | Requires managing external storage API credentials. | **Chosen** |
| **D. Public image hosting links (URL-only)** | Zero server storage required; user pastes a link. | Unusable for non-technical citizens; links can expire or become broken. | Rejected |

## 4. Decision
1. **Decoupled Object Storage**: CivicConnect adopts external object storage for ticket attachments.
2. **Schema Baseline**: The database table `service_requests.attachment_url` persists a durable HTTPS URL pointing to the external object store, keeping the database footprint minimal.
3. **Upload Flow**: For Milestone 3/4 implementation, the client requests a secure presigned upload URL from the server; the file is uploaded directly to the object store; the resulting sanitized URL is submitted with the intake payload.
4. **Validation Boundary**: The server validates allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) and enforces a maximum file size boundary of 5 MB.

## 5. Consequences
- **Benefits**: Citizen photos survive container spin-downs; database storage remains comfortably within Neon’s 0.5 GB quota; web server is insulated from processing large binary payloads.
- **Costs**: Adds one external cloud dependency to configure before live public production onboarding (recorded in Release Evidence Summary).
