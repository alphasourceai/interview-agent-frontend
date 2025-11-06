Auth Redirect URLs & Admin Reset/Invite – Implementation Guide

Updated: now

This doc captures the root cause, the Supabase settings you need, and drop-in server changes so admin-triggered password reset and member invite links work across QA / Staging / Prod (and later in Prod) without hard-wiring a single domain.

⸻

1) Root Cause (QA)

supabase.auth.admin.generateLink() only returns an action link if the redirectTo URL is allowed in that project’s Authentication → URL Configuration.
In QA we passed a production domain:

https://www.alphasourceai.com/account?password_reset=1

QA didn’t allow that origin → Supabase returned no_action_link → backend responded 500 generate_link_failed.

⸻

2) Supabase settings (each environment)

In each Supabase project (QA, Staging, Prod):

Authentication → URL Configuration → Redirect URLs (use /* suffix):

https://ia-frontend-qa.onrender.com/*
https://ia-frontend-staging.onrender.com/*
https://ia-frontend-prod.onrender.com/*
https://www.alphasourceai.com/*
https://alphasourceai.com/*
http://localhost:5173/*

(OK to include all; Supabase matches by prefix.)

⸻

3) Server logic: environment-aware redirects

Compute a safe default redirectTo instead of hard-coding one domain. Use this for:
	•	Admin reset password (recovery link)
	•	Admin add member (magic link invite)

Redirect resolution (server)
	•	If REDIRECT_BASE_URL is set, use it.
	•	Else infer from env (SENTRY_ENV/NODE_ENV) and fall back to FRONTEND_URL or http://localhost:5173.
	•	Append the path and flag:
	•	Reset: /account?password_reset=1
	•	Invite: /account?auth_callback=1

Render env vars per backend service:

# QA
REDIRECT_BASE_URL=https://ia-frontend-qa.onrender.com

# Staging
REDIRECT_BASE_URL=https://ia-frontend-staging.onrender.com

# Prod
REDIRECT_BASE_URL=https://www.alphasourceai.com


⸻

4) Drop-in changes (Backend)

File: app.js (admin routes section)

Add:

function resolveRedirectBase() {
  const explicit = process.env.REDIRECT_BASE_URL && process.env.REDIRECT_BASE_URL.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const env = (process.env.SENTRY_ENV || process.env.NODE_ENV || '').toLowerCase();
  if (env.includes('qa')) return 'https://ia-frontend-qa.onrender.com';
  if (env.includes('stag')) return 'https://ia-frontend-staging.onrender.com';
  if (env.includes('prod')) return 'https://ia-frontend-prod.onrender.com';

  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

Use it in Reset Password:

const base = resolveRedirectBase();
const redirectTo = `${base}/account?password_reset=1`;
const linkResp = await supabaseAdmin.auth.admin.generateLink({
  type: 'recovery',
  email,
  options: { redirectTo }
});

Use it in Add Member (magic link):

const base = resolveRedirectBase();
const redirectTo = `${base}/account?auth_callback=1`;
const { userId, actionLink } = await ensureUserIdAndMagicLink(email, redirectTo);

Keep SendGrid HTML as is; it will render the computed actionLink.

⸻

5) Deploy commands

Backend (QA → Staging → Prod)

# QA backend
cd interview-agent-backend-qa
git add -A
git commit -m "auth: env-aware redirectTo for reset/invite; Supabase-friendly"
git push origin qa-backend

# Staging backend
cd ../interview-agent-backend-staging
git pull
git cherry-pick <commit-from-qa>
git push origin staging-backend

# Prod backend (after validation)
cd ../interview-agent-backend
git pull
git cherry-pick <commit-from-qa>
git push origin prod-backend-legacy

Frontend (only if you changed UI text/UX)

# QA frontend
cd interview-agent-frontend-qa
git add -A
git commit -m "admin: clarify reset/invite UX; QA env tweaks"
git push origin qa-frontend

# Staging frontend
cd ../interview-agent-frontend-staging
git pull
git cherry-pick <commit-from-qa>
git push origin staging-frontend

# Prod frontend (after validation)
cd ../interview-agent-frontend
git pull
git cherry-pick <commit-from-qa>
git push origin prod-frontend-legacy



⸻

6) QA checklist
	•	Supabase Redirect URLs updated in all envs.
	•	REDIRECT_BASE_URL set in Render for each backend.
	•	Backend deployed with env-aware redirects.
	•	In QA Admin:
	•	Add member sends SendGrid invite; button works; raw link non-null.
	•	Reset password sends SendGrid mail; button works; raw link non-null.
	•	Links land on the correct FE per environment.

⸻

7) Notes & gotchas
	•	{ data: null } from generateLink is almost always a disallowed redirect URL.
	•	Use the correct Service Role Key for the environment calling auth.admin.*.
	•	CORS allowlist already includes QA FE.

⸻

8) Rollback

If needed, force QA using:

REDIRECT_BASE_URL=https://ia-frontend-qa.onrender.com

Redeploy; then iterate.

⸻

Owner: Jason / alphaSource
Next: Add the helper to app.js, redeploy QA backend, test Reset + Invite, then promote to Staging/Prod.

🧭 AlphaSource Interview Agent — Admin Invite & Password Reset System

Comprehensive Handoff Summary (November 2025)

⸻

🧩 Context and Objective

The goal of this development cycle was to:
	•	Replace Supabase’s default auth invite/reset emails with branded SendGrid-based emails.
	•	Ensure that admin users can:
	•	Add client members via the Admin Dashboard → triggers a branded SendGrid invite.
	•	Reset passwords for existing members via the Admin Dashboard → triggers a branded SendGrid password reset email.
	•	Achieve environment-safe routing (Prod, QA, Staging).
	•	Ensure Supabase Auth + Database consistency.
	•	Remove Supabase-branded emails entirely from the user experience.

All work was performed in the QA environment and will later propagate to staging and production.

⸻

🧱 Core Components Updated

1. Backend
	•	File modified: app.js
	•	Purpose: Consolidated all Admin Routes (/admin/...) into a single Express router (adminRouter) that:
	•	Manages clients, roles, and members.
	•	Handles invites and password resets via SendGrid.
	•	Added SendGrid HTML templates for both:
	•	Invite emails (Your alphaSource invite)
	•	Reset emails (Reset your alphaSource password)
	•	Integrated Supabase Auth Admin API for link generation.

⸻

2. Frontend
	•	File modified: src/pages/Admin.jsx
	•	Functionality verified for:
	•	Adding members (POST /admin/client-members)
	•	Deleting members (DELETE /admin/client-members/:id)
	•	Resetting passwords (POST /admin/reset-password)
	•	Confirmed network calls and console logs correspond to backend endpoints.

⸻

3. Email Templates (SendGrid)

We used your existing visual style from the frontend and replicated it in pure inline HTML for SendGrid:

📨 Invite Email
File: HTML template in SendGrid (alphaSource Invite)
Key visual elements:
	•	Dark navy background (#0A1547)
	•	Soft lavender button (#C3B4F3)
	•	White alphaSource logo (now hosted at:
https://www.alphasourceai.com/alpha-logo.png)
	•	Call-to-action button:

Accept invite & sign in

	•	Fallback plain link if the button doesn’t work.
	•	Support contact: info@alphasourceai.com
	•	Link target (in production): https://www.alphasourceai.com/account

✅ Working in QA: Yes
🚨 Minor issues identified:
	•	Logo initially failed to load (fixed by switching from http:// → https://)
	•	Button click did nothing because action_link returned null (fixed in next steps)
	•	“Paste link” line displayed null when Supabase didn’t generate a link

⸻

🔒 Password Reset Email
Defined in app.js → adminRouter.post(’/users/:userId/reset-password’)andadminRouter.post(’/reset-password’)`

Visual styling: same brand theme as the invite template.
Button text: Reset password
CTA URL dynamically filled by action_link generated via Supabase.
Fallback link shown below the button.

✅ Deployed: Yes
🚨 Pending validation: generate_link_failed errors (detailed below)

⸻

⚙️ Backend Route Architecture

Admin Router Endpoints Implemented

HTTP Method
Endpoint
Description
Status
GET
/admin/clients
List all clients
✅ Working
POST
/admin/clients
Create client + seed admin
✅ Working
DELETE
/admin/clients/:id
Delete client
✅ Working
GET
/admin/roles
List roles (optional client filter)
✅ Working
POST
/admin/roles
Create new role
✅ Working
DELETE
/admin/roles
Delete role
✅ Working
GET
/admin/client-members
List client members
✅ Working
POST
/admin/client-members
Add member + SendGrid invite
✅ Working
DELETE
/admin/client-members/:id
Remove member
✅ Working
POST
/admin/users/:userId/reset-password
Reset password (ID-based)
⚠️ Partial (fails due to no_action_link)
POST
/admin/reset-password
Reset password (email-based)
⚠️ Partial (same issue)


🧠 Technical Summary of Major Changes in app.js

✅ Added or Modified:
	•	_sendgridSend() utility:
	•	Wraps SendGrid API calls.
	•	Uses process.env.SENDGRID_API_KEY and SENDGRID_FROM.
	•	Handles all outbound email delivery.
	•	ensureUserIdAndMagicLink():
	•	Creates a Supabase Auth user if needed.
	•	Generates a magic link manually (without Supabase’s default emails).
	•	Used by the add member flow.
	•	adminRouter.post('/client-members'):
	•	Creates the client_members record.
	•	Calls _sendgridSend() with the invite HTML.
	•	Verifies invite link (action_link) exists before sending.
	•	adminRouter.post('/users/:userId/reset-password'):
	•	Uses supabaseAdmin.auth.admin.generateLink({ type: 'recovery' }).
	•	Sends a password reset email via _sendgridSend().
	•	Redirect URL default: https://www.alphasourceai.com/account?password_reset=1
	•	Logs all failures.
	•	adminRouter.post('/reset-password'):
	•	Same as above, but accepts { email } instead of userId.
	•	Logs diagnostic messages for missing action links.
	•	This route is intended for the frontend key icon.

🧾 Logging Added

New log lines to aid debugging:

[admin.reset-password] generating recovery link for <email> redirectTo=<url>
[admin.reset-password] generateLink error: <message>
reset_password_admin_failed: <message>

These now appear in Render’s server logs.

⸻

🧪 Testing & QA Results

Function
Status
Outcome
Add member (Invite)
✅ Success
SendGrid email delivered, logo visible, link null (fixed in later test)
Delete member
✅ Success
Record removed immediately
Reset password
⚠️ Partial
generate_link_failed: no_action_link
Add member email branding
✅
Matches alphaSource brand styling
Supabase default emails suppressed
✅
All invites now originate from SendGrid
Reset email branding
✅
Styled correctly when triggered manually
Env consistency check
✅
.env.prod / .env.qa / .env.staging created


🧰 Diagnosis of Reset Failure (generate_link_failed)

Observation:

Supabase responded with:

{
  "error": "generate_link_failed",
  "detail": "no_action_link"
}

Root Cause:

Supabase Auth’s generateLink('recovery') fails if the redirectTo domain is not listed under Authentication → Redirect URLs.

Fix:

Add all these to QA’s Redirect URLs in Supabase:

https://ia-frontend-qa.onrender.com/*
https://ia-frontend-staging.onrender.com/*
https://ia-frontend-prod.onrender.com/*
https://www.alphasourceai.com/*
https://alphasourceai.com/*

Optional Code Improvement:

We can make the backend automatically select the correct redirect URL per environment:

const env = process.env.NODE_ENV;
const redirectTo =
  env === 'production'
    ? 'https://www.alphasourceai.com/account?password_reset=1'
    : (process.env.FRONTEND_URL || 'https://ia-frontend-qa.onrender.com') + '/account?password_reset=1';

🧩 Environment Files (.env)

All three environment files were created and synced:

.env.prod

NODE_ENV=production
FRONTEND_URL=https://ia-frontend-prod.onrender.com
SENDGRID_API_KEY=...
SENDGRID_FROM=info@alphasourceai.com
SUPABASE_URL=https://lrhenpoqkkcueadeeay.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

.env.qa

NODE_ENV=qa
FRONTEND_URL=https://ia-frontend-qa.onrender.com
SENDGRID_API_KEY=...
SENDGRID_FROM=info@alphasourceai.com
SUPABASE_URL=https://lrhenpoqkkcueadeeay.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

.env.staging

Similar structure.


✅ Confirmed stored in Render securely for all environments.

⸻

🚀 Deployment Status

Environment
Git Branch
Render Service
Status
QA
qa-backend / qa-frontend
ia-backend-qa / ia-frontend-qa
Active
Staging
staging-backend / staging-frontend
Connected
Idle
Prod
prod-backend-legacy / prod-frontend-legacy
Live
No changes deployed yet


Push/Commit Workflow Reminder

Always commit to the active QA or staging branch, then merge into prod legacy to trigger Render auto-deploy:

# Backend QA
git add -A
git commit -m "admin: finalize SendGrid invite + reset email system"
git push origin qa-backend

# Frontend QA
git add -A
git commit -m "admin: integrate reset & invite UI with new endpoints"
git push origin qa-frontend

When ready for production deployment:

# Merge QA → Prod Legacy
git fetch origin
git checkout prod-backend-legacy
git merge qa-backend
git push origin prod-backend-legacy

🧾 Current QA Console Behavior

✅ Add Member

POST /admin/client-members 200 OK
Email: jasonmgardner@comcast.net
Result: SendGrid invite delivered (no Supabase default)

⚠️ Reset Password

POST /admin/reset-password 500 Internal Server Error
Response:
{ "error": "generate_link_failed", "detail": "no_action_link" }
Backend Logs:
[admin.reset-password] generating recovery link for jasonmgardner79@yahoo.com redirectTo= https://www.alphasourceai.com/account?password_reset=1

📋 Outstanding Tasks

Task   Description    Status
Supabase redirect URL whitelist
Add all app domains under Auth → Redirect URLs
🚧 Pending
Dynamic redirect URLs
Switch based on environment (QA, Staging, Prod)
🚧 Pending
Test reset after whitelist update
Confirm action_link is generated
🚧 Pending
Frontend button action
Ensure Accept Invite and Reset buttons open target link
✅ Confirmed visually; awaiting final link test
Push to staging and prod branches
Merge QA changes once stable
🔜 Next


🧩 Optional Next Enhancements
	1.	Centralize Email Templates
	•	Move SendGrid HTML into /templates/invite.html and /templates/reset.html.
	•	Add environment-based placeholders (e.g., logo, redirect URL).
	2.	Add audit logging
	•	Log to Supabase table email_logs with { user_id, email, type, status, error }.
	3.	Introduce fallback for generateLink
	•	If link generation fails, create a “manual” password reset token stored in a reset_tokens table.
	4.	Admin UX
	•	Add toast confirmations for reset success/failure.
	•	Auto-refresh member list after deletion or creation.

⸻

🧾 Summary

✅ Completed:
	•	SendGrid integrated and tested for invites
	•	Reset route wired up to Supabase + SendGrid
	•	QA backend and frontend synced and deployed
	•	Full Sentry instrumentation retained
	•	.env and CORS verified for all environments

⚠️ Pending:
	•	Supabase redirect URL fix for reset flow
	•	Environment-aware redirect logic
	•	Final validation in QA → then promote to staging/prod
