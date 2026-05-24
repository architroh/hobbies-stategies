# CV Triage

Automatically sorts incoming CV emails in Gmail using Claude AI. Reads unread emails with attachments, extracts text from PDF/DOCX files, classifies the role via Claude, applies a Gmail label, and archives the email.

## Prerequisites

- Node.js 18+
- A Google Cloud project with the Gmail API enabled
- An Anthropic API key

---

## 1. Google Cloud Console setup

### 1.1 Create a project and enable the Gmail API

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. In the left sidebar go to **APIs & Services → Library**
4. Search for **Gmail API** and click **Enable**

### 1.2 Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (unless you are a Google Workspace user — choose **Internal** then)
3. Fill in the required fields (App name, support email, developer email)
4. On the **Scopes** step, add:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.labels`
5. On the **Test users** step, add the Gmail address you want to triage
6. Click **Save and Continue** through the remaining steps

### 1.3 Create OAuth 2.0 credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Desktop app**
4. Give it a name (e.g. "CV Triage")
5. Click **Create**
6. Click **Download JSON** on the confirmation dialog
7. Rename the downloaded file to `credentials.json` and place it in the `cv-triage/` folder

---

## 2. Anthropic API key

1. Get your key from [console.anthropic.com](https://console.anthropic.com)
2. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
3. Edit `.env` and paste your key:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

---

## 3. Install and run

```bash
cd cv-triage
npm install
node index.js
```

### First run

A browser window will open asking you to sign in with your Google account and grant access. After approving, copy the authorization code shown and paste it into the terminal. The token is saved to `token.json` — subsequent runs use it automatically (and refresh it silently when it expires).

### Subsequent runs

```bash
node index.js
```

---

## Role categories

Emails are classified into one of:

| Label | Description |
|-------|-------------|
| `CV/Project Manager - Civil` | Civil engineering PM roles |
| `CV/Project Manager - Mechanical` | Mechanical engineering PM roles |
| `CV/Project Manager - Electrical` | Electrical engineering PM roles |
| `CV/Planning Lead` | Planning / programme leads |
| `CV/Site Engineer` | Site engineers |
| `CV/Project Manager - General` | PM roles without a specific discipline |
| `CV/Other` | Everything else |

Labels are created in Gmail automatically on first use.

---

## Example terminal output

```
CV Triage — connecting to Gmail...
Authenticated.

Found 5 candidate email(s) to process.

Processing "CV - John Smith - Civil PM"... → CV/Project Manager - Civil (high confidence)
  Candidate: John Smith
Processing "Application for Planning Lead role"... → CV/Planning Lead (high confidence)
  Candidate: Sarah Jones
Processing "RE: Job application"... → CV/Other (low confidence)
  Candidate: Unknown
Processing "Tom Brown - Site Engineer CV"... → CV/Site Engineer (high confidence)
  Candidate: Tom Brown
Processing "CV attached"... ⚠ skipped (no extractable text)

Done. 4 CVs sorted: 1 Project Manager - Civil, 1 Planning Lead, 1 Other, 1 Site Engineer
```

---

## Security notes

- `credentials.json` and `token.json` are in `.gitignore` — never commit them
- `.env` is also ignored — never commit your API key
- The tool only requests `gmail.modify` + `gmail.labels` scopes (no send/delete)
