# ADR-007: Session Management and Authentication Strategy

| Field | Value |
|---|---|
| Status | Accepted (Milestone 3 Baseline) |
| Date | 2026-10-16 |
| Deciders | Daluvuyo Magagane (Quality & Architecture Lead), Thato Goqo (Technical Lead) |
| Requirements | FR-015, NFR-004; PED v2.0 Section 25.2 (Open Decision) |
| Supersedes | None (Fulfills M2 Deferred Item) |

---

## 1. Context & Problem
In Milestone 2, authentication and password hashing were deferred (PED Section 25.2). To fulfill FR-015 (Role-Based Access Control) and NFR-004 (Credential Confidentiality), CivicConnect requires a secure mechanism to authenticate users, store credentials securely, and maintain user identity across HTTP requests in a server-rendered multi-page web application (ADR-004).

## 2. Decision Drivers
- **ASR-2 (Access Control)**: Must enforce RBAC across Requester, Staff, and Management with zero leakage.
- **NFR-004 (Security & Confidentiality)**: Passwords must never be stored in plaintext; hashing must resist brute-force attacks.
- **ASR-3 (Cost & Free-Tier Fit)**: Must function on Render Free without requiring a paid persistent cache instance (e.g. managed Redis).
- **ASR-5 (Buildable by Two Students)**: Solution must be standard, maintainable, and avoid unnecessary micro-framework complexity.

## 3. Options Considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Stateful Server Sessions in Memory** | Simple to implement with Express session middleware. | Render spins down after 15 min idle; restarting containers destroys all in-memory sessions, forcing users to re-login. | Rejected |
| **B. Stateful Sessions backed by Redis** | Fast, reliable session store. | Requires provisioning an extra managed service, exceeding free-tier resource quotas (ASR-3). | Rejected |
| **C. Stateless Signed HTTP-Only Cookie Session** | Stateless; survives container restarts and spin-downs; no external database roundtrip for session validation; immune to XSS. | Session payload limited to 4 KB; token revocation requires explicit versioning. | **Chosen** |
| **D. Client-side JWT in LocalStorage** | Standards-compliant token handling. | Vulnerable to Cross-Site Scripting (XSS); unsuitable for server-rendered EJS templates (requires client JavaScript on every navigation). | Rejected |

## 4. Decision
1. **Password Hashing**: Adopt **Argon2id** (or `bcrypt` with work factor 12). Plaintext passwords are never logged, exposed, or persisted.
2. **Session Storage**: Implement **signed, encrypted HTTP-Only cookies** containing the minimal user context (`{ id, role, email }`).
3. **Security Flags**: Cookie configuration must enforce `httpOnly: true`, `secure: true` (in production/staging), and `sameSite: 'lax'` to prevent Cross-Site Request Forgery (CSRF).
4. **Integration with Policy Layer**: Express authentication middleware extracts the cookie, validates the cryptographic signature, and populates `req.user`, allowing `authorize(action)` in `src/auth/policies.js` to evaluate permissions cleanly.

## 5. Consequences
- **Benefits**: Zero extra infrastructure cost; survives Render ephemeral container lifecycle; eliminates XSS token-stealing attack vectors; seamless integration with server-rendered EJS views.
- **Costs**: Logout invalidation relies on cookie clearing or an incremental token version counter in the database.
