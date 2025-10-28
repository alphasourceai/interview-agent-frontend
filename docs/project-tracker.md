### 📘 `/docs/project-tracker.md` — Initial Draft

#### 🧠 Project: AI Interview Agent  
**Repository:** `alphasourceai/interview-agent-frontend`  
**Environment:** Render → `prod-frontend-legacy`  
**Owner:** Jason Gardner (`jason@alphasourceai.com`)  

---

## 🗂️ 1. Current Phase
**Phase:** MVP Finalization (Client Dashboard polish → Internal PDF system → Sentry setup)  
**Status:** Completed  
**Last Updated:** _October 21, 2025_

---

## ✅ 2. Recently Completed
| Area | Task | Status | Date |
|------|-------|--------|------|
| Security | 🔐 RLS enabled across clients/roles/members/candidates/interviews/reports; constraints & FKs enforced; role helpers added (admin/manager/member) | ✅ | Oct 21 |
| Client Dashboard | 🔘 Wired 'Download PDF' button to on-demand generator (BE integration + spinner) | ✅ | Oct 20 |
| Client Dashboard | 🧩 Revisited candidate filtering logic and fixed Interview Summary display | ✅ | Oct 21 |
| Monitoring | 📈 Implemented Sentry instrumentation (FE + BE) with DSN, release tagging, source maps, and Slack alerts | ✅ | Oct 20 |
| Client Dashboard | 🪄 Added success/failure toast notifications and a11y styling polish (focus, hover, truncate) | ✅ | Oct 15 |
| PDF Generation | ⚙️ Replace PDFMonkey with internal HTML→PDF generator | ✅ | Oct 15 |
| Client Dashboard | Added **Interview Summary** under score metrics | ✅ | Oct 13 |
| Client Dashboard | Fixed **“Min Overall Score”** label | ✅ | Oct 13 |
| Client Dashboard | 🎨 Apply color/style tweaks (transparent header row, lilac buttons, white text) | ✅ | Oct |
| Admin Portal | Full parity between **Admin** and **Client** sign-in pages | ✅ | Oct 3 |
| Auth | Client dashboard switched from **magic link** to **password-based** login | ✅ | Oct 3 |
| UI | Global polish for button sizing, inputs, spacing | ✅ | Oct 3 |
| General | Supabase + Render deployment pipeline confirmed stable | ✅ | Sept 30 |

---

## 🔧 3. In Process / Upcoming

### In Process
| Area | Task | Status / Notes | Owner | Target |
|------|-------|----------------|--------|--------|
| Deployment | **Subdomain Transition** — Create and configure new subdomain `interviews.alphasourceai.com` for direct interview access (bypassing Wix embed) | Plan approved. Proceeding with subdomain configuration on Render backend, DNS CNAME setup, branded container styling, and link updates in dashboard. Will test camera/mic permissions and routing on the new subdomain before alpha testing. | Jason | Oct 28 |
| Wix Integration | 🔗 Embed cleanup, scaling, and token routing improvements for Admin and Account pages | In Progress —  
**Implemented:** FE and BE edits completed to support Wix embedding (auto-resize observer, removal of scrollbars, scaling fixes). Added CSP header in backend for frame-ancestors (allowing Wix + alphasourceai.com), integrated Sentry across FE/BE, added window.onerror/onunhandledrejection handlers for runtime capture. FE styling updates (alphaTheme.css) to remove nested overflow and stabilize iframe layout. <br><br>  
**Next Steps:** Focus on resolving remaining scrollbar and scaling issues exclusively for Admin and Account dashboards embedded in Wix. Verify consistent height auto-resize and eliminate overflow/clipping across these pages. <br><br>  
**Testing Checklist:** ① Verify Sentry reports FE route/runtime errors. ② Validate autoResize observer triggers on height changes. <br><br>  
**Open Items:**  • Adjust remaining embedded Admin and Account pages for uniform scaling and scrollbar behavior.  • Consider future optimization for dynamic height via postMessage. <br><br>  
**Note:** The Interview page has been removed from Wix embeds and is being transitioned to the standalone subdomain `interviews.alphasourceai.com`. | Jason | Oct 22 |
| Permissions | 🎥 Fix camera/mic permission flow for Interview page within Wix embed (ensure browser prompts propagate and permissions granted to iframe context) | In Progress — Permissions testing for Tavus camera/mic prompts now handled via new subdomain (independent of Wix). | Jason | Oct 24 |
| Token Flow | 🔑 Resolve token-based deep link flow from Wix → Render for Interview access (ensure secure propagation of candidate tokens and route recognition within /interview-access/<token>) | Planned — Confirm Supabase session mapping, handshake, and redirect behavior; implement per Option 3 Token-Based Deep Link & Embed Handshake. Confirm base URL update to interviews.alphasourceai.com after deployment. | Jason | Oct 25 |

---

## 🔜 4. Upcoming
| Area | Task | Status / Notes | Owner | Target |
|------|-------|----------------|--------|--------|
| Database | 🧹 Remove test data; normalize `candidates`/`interviews`; **Investigate Client Dashboard candidate filtering mismatch** (not all DB candidates visible in UI though they appear in Network) — reconcile SQL/API filters & RLS | In Progress — Security improvements (RLS, FKs, role-based hierarchy) complete; cleanup next; candidate filtering issue identified for dashboard (UI vs SQL mismatch); testing required on filters and data consistency | Jason | Oct 22-23 |
| Security Audit | 🛡️ Evaluate application, codebase, database, and hosting configuration to ensure no sensitive data exposure before MVP testing release | In Progress — Sentry instrumentation complete; next step — verify error capture, check environment variable exposure; testing and review phase ongoing | Jason | Oct 23-24 |
| Admin Tools | ✉️ Add admin-initiated password setup/reset email | Jason | Late October- Nov |
| Email Templates | 💌 Finalize branded invite + reset templates | Jason | Late October- Nov |
| Integration Strategy | 🌐 Explore long‑term embedding solutions (Option 1 – Reverse Proxy / Same‑Site Embedding and Option 2 – Pop‑Out Auth Embed) for V2 to improve cross‑origin auth stability and Wix integration scalability | Planned for V2 — to be scoped post‑MVP testing cycle | Jason | November 2025 |

---

## 🧱 5. Deployment Commands (Standardized)
```bash
git checkout prod-frontend-legacy
git pull
git checkout -b feat/<short-description>
git add .
git commit -m "feat(<scope>): <short summary>"
git push origin feat/<short-description>
gh pr create -B prod-frontend-legacy -H feat/<short-description> -t "<Readable Title>" -b "<Detailed Description>"
gh pr merge --merge --delete-branch

## 🧾 6. Notes
	•	All deployments to Render must originate from prod-frontend-legacy (frontend) or prod-backend-legacy (backend).
	•	Maintain consistent commit scope prefixes (e.g., feat(client-dashboard): …, fix(admin): …).
	•	Include screenshots of UI deltas in PR descriptions.
	•	Each PR should update this tracker file as part of the commit if relevant.
