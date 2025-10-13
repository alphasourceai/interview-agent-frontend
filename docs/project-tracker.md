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
| Client Dashboard | Added **Interview Summary** under score metrics | ✅ | Oct 13 |
| Client Dashboard | Fixed **“Min Overall Score”** label | ✅ | Oct 13 |
| Admin Portal | Full parity between **Admin** and **Client** sign-in pages | ✅ | Oct 3 |
| Auth | Client dashboard switched from **magic link** to **password-based** login | ✅ | Oct 3 |
| UI | Global polish for button sizing, inputs, spacing | ✅ | Oct 3 |
| General | Supabase + Render deployment pipeline confirmed stable | ✅ | Sept 30 |

---

## 🔧 3. In Progress / Upcoming
| Area | Task | Owner | Target |
|------|-------|--------|--------|
| Client Dashboard | 🎨 Apply color/style tweaks (transparent header row, lilac buttons, white text) | Jason | Oct |
| PDF Generation | ⚙️ Replace PDFMonkey with internal HTML→PDF generator | Jason | Oct |
| Monitoring | 📈 Sentry instrumentation (FE + BE) with DSN + Teams alert routing | Jason | Oct |
| Wix Integration | 🔗 Clean up redirects, embeds, and candidate token handling | Jason | Nov |
| Security | 🧩 Review & tighten RLS policies for clients/roles/members/interviews | Jason | Nov |
| Database | 🧹 Remove test data; normalize `candidates`/`interviews` | Jason | Nov |
| Admin Tools | ✉️ Add admin-initiated password setup/reset email | Jason | Nov |
| Email Templates | 💌 Finalize branded invite + reset templates | Jason | Nov |

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
