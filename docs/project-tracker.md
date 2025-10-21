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

## 🔧 3. In Progress / Upcoming
| Area | Task | Owner | Target |
|------|-------|--------|--------|
| Wix Integration | 🔗 Clean up redirects, embeds, and candidate token handling | Jason | Oct 17-20 |
| Database | 🧹 Remove test data; normalize 
`candidates`/`interviews`; **Investigate Client Dashboard candidate filtering mismatch** (not all DB candidates visible in UI though they appear in Network) — reconcile SQL/API filters & RLS | Jason | Oct 22-23 |
| Security Audit | 🛡️ Evaluate application, codebase, database, and hosting configuration to ensure no sensitive data exposure before MVP testing release | Jason | Oct 23-24 |
| Admin Tools | ✉️ Add admin-initiated password setup/reset email | Jason | Late October- Nov |
| Email Templates | 💌 Finalize branded invite + reset templates | Jason | Late October- Nov |

---

## 🧱 4. Deployment Commands (Standardized)
```bash
git checkout prod-frontend-legacy
git pull
git checkout -b feat/<short-description>
git add .
git commit -m "feat(<scope>): <short summary>"
git push origin feat/<short-description>
gh pr create -B prod-frontend-legacy -H feat/<short-description> -t "<Readable Title>" -b "<Detailed Description>"
gh pr merge --merge --delete-branch

## 🧾 5. Notes
	•	All deployments to Render must originate from prod-frontend-legacy (frontend) or prod-backend-legacy (backend).
	•	Maintain consistent commit scope prefixes (e.g., feat(client-dashboard): …, fix(admin): …).
	•	Include screenshots of UI deltas in PR descriptions.
	•	Each PR should update this tracker file as part of the commit if relevant.
