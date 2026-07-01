# FillTheGap — Manual QA Test Cases

Run these against a fresh browser session (clear localStorage/sessionStorage first, or use an incognito window) with the backend and frontend dev servers running. Use a disposable test email for each full run-through.

Legend: **P1** = blocks core functionality, test first. **P2** = important but not blocking. **P3** = edge case / polish.

---

## 1. Authentication (`/auth`)

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| AUTH-1 | Go to `/auth`, fill in name/email/8+ char password, click "Create Account" | Account created, redirected to `/` (Upload page), Navbar shows your first name | P1 |
| AUTH-2 | Sign up again with the same email | Specific error: "Email already registered" (not a generic message) | P1 |
| AUTH-3 | Sign up with a password under 8 characters | Specific error: "Password must be at least 8 characters." | P2 |
| AUTH-4 | Sign up with a malformed email (e.g. `notanemail`) | Specific error: "Please enter a valid email address." (not "Something went wrong") | P2 |
| AUTH-5 | Sign out, then sign in with the correct email/password | Redirected to `/`, session restored | P1 |
| AUTH-6 | Sign in with a wrong password | Specific error: "Invalid email or password" (not generic) | P1 |
| AUTH-7 | Sign in with an email that was never registered | Specific error: "Invalid email or password" | P2 |
| AUTH-8 | Stop the backend server, then attempt to sign in | Specific error: "Can't reach the server right now. Check your connection and try again." | P3 |
| AUTH-9 | Click "Continue without account" | Navigates to `/` without requiring login | P3 |
| AUTH-10 | While logged out, manually navigate to `/history`, `/skills`, `/gap-dashboard`, `/career-progression` | Each redirects to `/auth` (RequireAuth guard) | P1 |
| AUTH-11 | Log in, refresh the browser tab | Still logged in (session persisted via localStorage), lands on last state or `/` | P2 |
| AUTH-12 | Click "Sign out" from the Navbar menu | Logged out, redirected to `/auth`, Navbar no longer shows account menu | P1 |

---

## 2. Resume Upload (`/`)

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| UP-1 | Select "Target role" mode, paste resume text, click Continue | Navigates to `/role-selection` in target mode (role search box visible) | P1 |
| UP-2 | Select "Best fit" mode, paste resume text, click Continue | Navigates to `/role-selection` in auto mode (no role search box) | P1 |
| UP-3 | Drag and drop a real PDF resume onto the drop zone | Resume parses, auto-continues to `/role-selection` | P1 |
| UP-4 | Click the drop zone and browse-select a PDF | Same as UP-3 | P1 |
| UP-5 | Upload a corrupted/non-resume PDF (e.g. a blank or image-only PDF) | Specific parse error surfaced, not a silent failure or crash | P2 |
| UP-6 | Leave the textarea empty and don't select a file | "Continue" button doesn't appear / can't submit | P3 |
| UP-7 | Paste an extremely short resume (e.g. one line: "I like cats") | Either proceeds with minimal skills extracted, or a clear error — verify no crash | P3 |

---

## 3. Role Selection (`/role-selection`)

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| RS-1 | In target mode, type a partial role name (e.g. "data") in the search box | Matching roles list filters live | P1 |
| RS-2 | Type a role that doesn't exist (e.g. "asdkjfh") | "No roles found" shown, Analyse button stays disabled | P2 |
| RS-3 | Select a role, click "Analyse Skills Gap →" | Loading state ("Analysing — this takes ~20 seconds..."), then navigates to `/gap-dashboard` with that role's data | P1 |
| RS-4 | In auto mode, click "Analyse Skills Gap →" without picking a role | Backend infers top 3 roles from resume skills — **verify the roles are actually skill-relevant, not alphabetically first roles** (regression check for the top-3-roles bug) | P1 |
| RS-5 | Navigate directly to `/role-selection` without ever uploading a resume | Redirects back to `/` (no resumeText in session) | P2 |
| RS-6 | Trigger an analysis failure (e.g. stop backend mid-request) | Red "Analysis failed" box with the raw error detail shown | P3 |

---

## 4. Gap Analysis Dashboard (`/gap-dashboard`)

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| GD-1 | Land here after analysis | See Your Skills, Role Requirements, Gap Summary, and a radar chart, all populated | P1 |
| GD-2 | (Auto mode with 3 matched roles) Click "+N other matches" | Dropdown lists the other 2 roles with an "Analyse →" action | P2 |
| GD-3 | Click one of the "other matches" roles | Re-analyses for that role, dashboard updates to show the new role's gaps | P2 |
| GD-4 | Click "View Career Path →" | Navigates to `/career-progression`, ladder loads for the current role | P1 |
| GD-5 | Verify essential/important/nice-to-have gap counts match what's shown in the tiered skill list | Numbers are internally consistent | P2 |

---

## 5. Career Progression / Ladder (`/career-progression`)

**Setup note:** to test the "locked" states below, analyse a role and do **not** go complete its gaps in History first.

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| CP-1 | From Gap Dashboard, view career path with gaps still open in current role | "Start now" button shows a lock icon and reads "Locked"; amber note: "Close all essential and important skill gaps in [role] first — you're closer than you think! 💪" | P1 |
| CP-2 | Click the locked "Start now" button | Nothing happens (click is a no-op) — button is genuinely disabled, not just styled | P1 |
| CP-3 | Go to History, tick off every essential/important next step for the current role until readiness hits 100% | "You're role-ready for [role]!" banner appears with "What's next?" button | P1 |
| CP-4 | Click "What's next? See your career path" | Navigates to Career Path; "Start now" is now enabled (no lock) | P1 |
| CP-5 | Click "Start now" on the enabled button | Loading overlay ("Analysing skills gap for [role]..."), then redirects to `/history` with a new entry for the next-stage role | P1 |
| CP-6 | After starting the next stage, go back to History and confirm the *previous* stage's card no longer shows "What's next?" | Button is hidden once advanced (no duplicate-advance prompt) | P2 |
| CP-7 | From Navbar → "Career Path", before completing the newly-started stage | Ladder reflects the TRUE current (in-progress) stage, "Start now" is locked again | P1 (regression: stale-cache bug) |
| CP-8 | Attempt to advance again to the same stage you already started (e.g. via double-click or revisiting) | Silently redirects to History (no duplicate entry created), or a clear message — no crash, no duplicate row | P2 |
| CP-9 | Click "← Back" from Career Path | Returns to Gap Dashboard or History depending on entry point | P3 |
| CP-10 | Inspect the "Future roles" section (roles beyond immediate next) | Shown as informational only, greyed out, no "Start now" button available on them | P2 |

---

## 6. History (`/history`)

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| HI-1 | Open History with at least one analysis done | Entries listed newest-first, each showing role, date, essential/important counts, readiness bar | P1 |
| HI-2 | Click "Next steps" on an entry | Expands to show required + optional (nice-to-have) steps as separate sections | P1 |
| HI-3 | Tick a required step's checkbox | Optimistic UI update (instant), skill gets tagged "+added to skills", readiness % increases | P1 |
| HI-4 | Un-tick the same step | Skill removed from "added" state, readiness % decreases back | P2 |
| HI-5 | Toggle a step while the network is down / backend stopped | UI reverts to previous state (rollback on failure), no permanent inconsistent state | P2 |
| HI-6 | Click "learn more" on a step with long text | Expands to show full text; "less" collapses it back | P3 |
| HI-7 | Reach 100% readiness on a role that has NOT yet been advanced from | Green celebration banner + "What's next?" button appears | P1 |
| HI-8 | Reach 100% readiness on a role that HAS already been advanced from | No "What's next?" button (already advanced) | P2 |
| HI-9 | Click "+ New Analysis" | Navigates to `/` to start a fresh upload | P3 |
| HI-10 | Navigate away and back to History | Data re-fetches fresh (not stale from cache) | P2 |

---

## 7. My Skills (`/skills`, via Navbar)

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| SK-1 | Open "My Skills" with history present | Alphabetical list of all skills across resume + completed next-steps, no duplicates | P1 |
| SK-2 | Open "My Skills" with zero history | "No skills recorded yet" empty state with a "Start Analysis" button | P2 |
| SK-3 | Tick off a new step in History, then check My Skills | The newly-acquired skill appears in the list without needing a manual refresh mid-session (or after navigating) | P2 |
| SK-4 | Check "Last updated" date matches the most recent history entry's date | Date is correct and human-readable | P3 |

---

## 8. Navbar & Cross-Page Behavior

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| NAV-1 | Click account menu → each of My Skills / History / Career Path / Sign out | Each navigates correctly and closes the dropdown | P1 |
| NAV-2 | Click outside an open dropdown menu | Dropdown closes | P3 |
| NAV-3 | With zero history, click "Career Path" from Navbar | Redirects to `/history` (no ladder to show) rather than erroring | P2 |
| NAV-4 | Click the "FillTheGap" logo/title | Navigates to `/` | P3 |

---

## 9. Data Integrity / Security Checks

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| SEC-1 | Log in as User A, note their History. Log out, register/log in as User B | User B's History is empty / independent — no cross-user data leakage | P1 |
| SEC-2 | Try calling a protected API endpoint (e.g. `/api/auth/history`) with no `Authorization` header (via browser devtools/curl) | 401 Unauthorized | P1 |
| SEC-3 | Try calling `/api/auth/history/career-stage` directly with a role that is NOT your immediate next stage | 403 rejected | P1 |
| SEC-4 | Try advancing to a career stage while your current stage still has open essential/important gaps (direct API call, bypassing UI) | 403 "Close all essential and important skill gaps..." | P1 |
| SEC-5 | Expired/tampered JWT sent with a request | 401 "Invalid or expired token" | P2 |

---

## 10. Cross-Browser / Responsive Sanity

| ID | Steps | Expected Result | Priority |
|----|-------|------------------|----------|
| RESP-1 | Load the app at mobile width (~375px) | Key pages (Upload, Gap Dashboard, History) remain usable, no horizontal overflow | P3 |
| RESP-2 | Load in a second browser (e.g. Firefox if primary testing was Chrome) | App behaves identically | P3 |

---

## Known regression areas (test these every release)

These map to bugs found and fixed in past sessions — regress them explicitly before shipping:

1. **Top-3 role matching** (RS-4) — must be skill-relevant, never alphabetically-biased or nonsense titles.
2. **Career-stage locking** (CP-1, CP-2, CP-7, SEC-3, SEC-4) — "Start now" must be genuinely blocked (UI-disabled AND server-enforced) until the current stage is 100% cleared, even via the Navbar shortcut.
3. **Duplicate career-stage entries** (CP-8) — revisiting Career Path after already starting a stage must not create a second entry.
4. **Auth error specificity** (AUTH-2, AUTH-3, AUTH-4, AUTH-6, AUTH-8) — never show a bare "Something went wrong"; always a specific, actionable message.
5. **Session/date fields** — History and Skills pages must show valid, correctly formatted dates (past bug: `created_at` vs `timestamp` mismatch).
