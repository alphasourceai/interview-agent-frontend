### 📘 `/docs/project-tracker.md` — Initial Draft

#### 🧠 Project: AI Interview Agent  
**Repository:** `alphasourceai/interview-agent-frontend`  
**Environment:** Render → `prod-frontend-legacy`  
**Owner:** Jason Gardner (`jason@alphasourceai.com`)  

---

## 🗂️ 1. Current Phase
**Phase:** MVP Finalization (Client Dashboard polish → Internal PDF system → Sentry setup)  
**Status:** Active  
**Last Updated:** _October 13, 2025_

---

## ✅ 2. Recently Completed
| Area | Task | Status | Date |
|------|-------|--------|------|
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
| Monitoring | 📈 Sentry instrumentation (FE + BE) with DSN + Teams alert routing | Jason | Oct 15-16 |
| Client Dashboard | 🧩 Revisit candidate filtering logic and fix Interview Summary display | Jason | Oct 16-17 |
| Wix Integration | 🔗 Clean up redirects, embeds, and candidate token handling | Jason | Oct 17-20 |
| Security | 🧩 Review & tighten RLS policies for clients/roles/members/interviews | Jason | Oct 21-22 |
| Database | 🧹 Remove test data; normalize `candidates`/`interviews` | Jason | Oct 22-23 |
| Admin Tools | ✉️ Add admin-initiated password setup/reset email | Jason | Late October- Nov |
| Email Templates | 💌 Finalize branded invite + reset templates | Jason | Late October- Nov |
| Client Dashboard | 🔘 Wire 'Download PDF' button to on-demand generator (BE integration + spinner) | Jason | Oct 16 |

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
