# Portfolio Analyzer — Vercel Ready

This is the complete version of the Portfolio Analyzer. The original UI is kept, and the missing `/api/analyze` backend is included.

## What it does

- Analyzes a public GitHub profile.
- Reads repositories, README presence/length, descriptions, languages, activity, stars, forks and followers.
- Scores:
  - Documentation — 20%
  - Code Activity — 20%
  - Project Quality — 20%
  - Skills — 15%
  - Portfolio — 15%
  - Community — 10%
- Gives evidence for every score.
- Generates a prioritized roadmap.
- Optional AI review through Anthropic.
- Generates a shareable URL containing the GitHub username, role and portfolio URL.
- Keeps the sample report and Save as PDF buttons.

## Deploy on Vercel

1. Upload this folder to a GitHub repository.
2. Import that repository into Vercel.
3. Deploy. No build command is required.
4. Optional but recommended: add a Vercel Environment Variable:
   - `GITHUB_TOKEN` = your GitHub Personal Access Token
5. Optional AI:
   - `ANTHROPIC_API_KEY` = your Anthropic API key

The app works without either variable. Without `GITHUB_TOKEN`, GitHub's public API rate limit is lower. Without `ANTHROPIC_API_KEY`, the normal rule-based report still works and the AI section displays an informational message.

## GitHub token

Create a GitHub Personal Access Token with the minimum access needed to read public information. Do NOT put the token in `index.html` or any frontend JavaScript. Put it only in Vercel Environment Variables as `GITHUB_TOKEN`.

## Anthropic key

Put the key only in Vercel Environment Variables as `ANTHROPIC_API_KEY`. Never commit it to GitHub.

## Local

Install Vercel CLI if you want to run the same serverless API locally:

```bash
npm install
npx vercel dev
```

Then open the local URL shown by Vercel.

## Important

The `api/analyze.js` file is the backend endpoint used by the frontend. The original HTML was calling `/api/analyze`, but that route did not exist in the single HTML file.
