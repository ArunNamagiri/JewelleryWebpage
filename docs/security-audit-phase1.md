# Security Audit — Phase 1

**Repository:** JewelleryWebpage  
**Scope:** Static review of Docker, Compose, GitHub Actions, backend security configuration, and secret-handling patterns.  
**Status:** Initial static review; runtime tests and registry scanning have not yet been performed.

## Existing controls observed

- Root and backend ignore rules exclude .env files; Docker build contexts also exclude .env.
- Backend container uses the official Node Alpine image and switches to the non-root node user.
- Backend sets NODE_ENV=production, uses Helmet, disables x-powered-by, configures CORS origins, and applies API, enquiry, and admin-login rate limits.
- Database queries shown in reviewed handlers use parameterized values.
- Admin authentication verifies JWTs and uses bcrypt password comparison.
- Uploads are size/count limited and the code validates detected image type after upload.
- Compose has health checks, a restart policy, and waits for backend health before starting the frontend.
- GitHub Actions builds both linux/amd64 and linux/arm64 images.

## Findings and actions

### F1 — Container ports are published on all host interfaces by default
**Risk:** Medium for a laptop/development host on untrusted networks.
Compose currently publishes backend port 5000 and frontend port 8080 without a loopback IP. They may be reachable through host network interfaces, subject to host firewall rules.

**Decision:** Do not silently bind ports to localhost because the same Compose file may be used for deployment. For local-only development, use a local override with 127.0.0.1:5000:5000 and 127.0.0.1:8080:80. For a real deployment, expose only intended public endpoints behind a firewall/reverse proxy and TLS.

### F2 — CI publishes mutable tags only
**Risk:** Medium for traceability and rollback.
The existing workflow publishes backend and frontend tags. These tags can be overwritten, making it harder to identify the exact image used by a release.

**Action on this branch:** Retain compatibility tags and also publish commit-specific tags (backend-<commit SHA>, frontend-<commit SHA>). Enable BuildKit provenance and SBOM attestations. This improves traceability but does not itself scan for vulnerabilities or cryptographically sign images.

### F3 — Workflow permissions were implicit
**Risk:** Low to medium.
Explicit least-privilege permissions make the workflow's intended GitHub token access clearer.

**Action on this branch:** Set explicit read-only repository contents permission. Docker Hub credentials remain stored in GitHub Actions secrets.

### F4 — Automated tests are not yet configured
**Risk:** Medium for change safety.
The backend package currently has a placeholder test script that exits with an error. The current image workflow builds and pushes images but does not run application tests.

**Next action:** Add meaningful backend/frontend tests and a validation job before making image publication depend on tests. Do not label the pipeline fully tested until tests exist and pass.

### F5 — Runtime exposure and TLS depend on deployment topology
**Risk:** Deployment-dependent.
The backend port is published and the frontend is served by Nginx. A production deployment should define TLS termination, firewall rules, allowed origins, trusted proxy configuration, and health endpoint exposure explicitly.

**Next action:** Review the target deployment environment before changing port mappings or TRUST_PROXY.

### F6 — Image vulnerability scanning is not yet in the workflow
**Risk:** Medium.
SBOM/provenance metadata helps with inventory and traceability, but does not replace vulnerability scanning or patch management.

**Next action:** Add a scanner with a documented severity policy and exception process, then review findings before blocking releases.

## Secret-handling checklist

- Never commit backend/.env, database URLs, JWT secrets, admin hashes/passwords, or Supabase service keys.
- Never print secret values in CI logs or paste them into issue reports.
- If a secret is exposed, revoke/rotate it first; removing a file alone does not invalidate the credential or erase Git history.
- Confirm Docker Hub credentials use a scoped access token.
- Treat public repository content and public image layers as publicly inspectable.

## Verification plan (not yet run)

1. Review Git diff and workflow YAML on this branch.
2. Confirm no secret values were added.
3. Run a secret scanner locally or in a dedicated workflow.
4. Validate Compose configuration without printing interpolated secret values.
5. Build both images and inspect health status.
6. Confirm the registry contains both compatibility tags and commit-specific tags.
7. Test admin login, product CRUD with a disposable record, and image upload/display.
8. Record image digests and rollback references.

## Scope guardrails

No database migrations, data deletion, volume pruning, credential rotation, deployment, or production traffic changes are included in this audit branch. Those require a separate, deliberate step.