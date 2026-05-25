# CV Triage — Google Apps Script

Automatically sorts CV emails in Gmail using keyword-based classification.
**No API keys. No installs. Runs entirely inside Google's cloud.**

---

## How to set it up (one time, ~5 minutes)

### Step 1 — Open Google Apps Script

Go to **[script.google.com](https://script.google.com)** and sign in with the Gmail account that receives the CVs.

### Step 2 — Create a new project

Click **New project** (top left).

Rename it to something like `CV Triage` (click "Untitled project" at the top).

### Step 3 — Paste the code

Delete everything in the editor, then paste the entire contents of `Code.gs` into it.

Click the **Save** icon (or press `Ctrl+S`).

### Step 4 — Enable the Drive API service

1. In the left sidebar, click the **+** next to **Services**
2. Find **Google Drive API** in the list
3. Click **Add**

This lets the script convert PDF/DOCX attachments to text.

### Step 5 — Run it

1. Make sure the function dropdown at the top shows **triageCVs**
2. Click **Run**
3. A popup asks for permissions — click **Review permissions → Allow**
4. Watch the **Execution log** at the bottom for progress

---

## What it does

- Finds emails in your inbox that have a PDF/Word attachment **or** have "cv", "resume", or "curriculum vitae" in the subject line — so it doesn't matter whether the sender wrote "CV" or "Resume"
- Skips emails already labelled `CV/...` so nothing gets processed twice
- Extracts text from the email body + any PDF or Word attachments
- Classifies the CV into one of these Gmail labels:

| Label | What it matches |
|-------|----------------|
| `CV/Project Manager - Civil` | Civil engineering, highways, infrastructure, drainage… |
| `CV/Project Manager - Mechanical` | HVAC, piping, rotating equipment, MEP mechanical… |
| `CV/Project Manager - Electrical` | HV/LV, cabling, switchgear, substations, SCADA… |
| `CV/Planning Lead` | Primavera P6, scheduling, programme management… |
| `CV/Site Engineer` | Setting out, surveying, QC, site supervision… |
| `CV/Project Manager - General` | PMP, PRINCE2, contract management, project controls… |
| `CV/Needs Review` | Looks like a CV but discipline couldn't be determined — needs a manual check |

- Creates every label in Gmail automatically on first use
- Archives the email and marks it as read

---

## How to run it regularly (optional)

To have it run automatically (e.g. every morning):

1. In Apps Script, click **Triggers** (clock icon in left sidebar)
2. Click **Add Trigger**
3. Set:
   - Function: `triageCVs`
   - Event source: **Time-driven**
   - Type: **Day timer** → e.g. 8am–9am
4. Click **Save**

It will now run every morning without anyone needing to click anything.

---

## Sharing with someone else

To let another person run this on their own Gmail:

1. Have them go to [script.google.com](https://script.google.com)
2. Follow the same steps above (paste the code, add Drive API service, run)

Each person runs it on their own Google account — there's nothing to share or install.
