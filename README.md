# New Business Dashboard (Google Sheets → Web App)

This is a lightweight Next.js dashboard that reads your Google Sheet and shows **MTD / QTD / YTD** performance with:
- **Team view** + **Advisor view**
- Unit filter (uses the `Unit Manager` column as the unit)
- Producing / Pending / Non‑Producing advisor panel
- KPIs, leaderboards, and a simple daily approved trend

## 1) Setup (Google Sheets)

### Option A (recommended): Service account (private sheet)
1. Create a Google Cloud project + enable **Google Sheets API**.
2. Create a **Service Account** and download the JSON key.
3. Share the Google Sheet to the service account email (Viewer access is enough).
4. Copy these values into `.env.local` (see `.env.local.example`):
   - `GOOGLE_SHEETS_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

> Tip: for `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, keep the `\n` escapes (literal) when pasting into Vercel.

## 2) Run locally

```bash
npm i
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## 3) Deploy to Vercel

1. Push to GitHub.
2. Import repo in Vercel.
3. Add environment variables from `.env.local.example`.
4. Deploy.

## How the Producing / Pending / Non‑Producing logic works

For the selected range:
- **Producing** = advisor has at least 1 approved case (Date Approved in range, or Month Approved fallback)
- **Pending** = no approved, but has Submitted and/or Paid records
- **Non‑Producing** = no approved/submitted/paid records

**Roster sheet** is used so people with no transactions still show up as Non‑Producing (Team view).

## Notes / next improvements
- If you want accurate unit filtering for non‑producing advisors, add a `Unit` column to the roster sheet.
- Add consistency tracking (e.g., 3+ consecutive producing months) once Month Approved is reliable.
