# First deploy — step-by-step

Target URL after deploy: **https://liujw101.github.io/mom-recipes/**

## What you need

- GitHub account (you are logged in as **liujw101**)
- This folder pushed to a **public** repo named `mom-recipes` (free unlimited GitHub Actions)

---

## Step 1 — Commit the web app (in composer repo)

From the composer repo root:

```powershell
cd c:\Users\ltlt_\00.AI\composer
git add projects/mom_recipes_web
git commit -m "Add Mom Recipes web app for GitHub Pages"
```

---

## Step 2 — Create GitHub repo and push

```powershell
# Create empty public repo on GitHub
gh repo create mom-recipes --public --description "Digitize paper recipes for Mom"

# Split web app into its own branch (app files at repo root)
git subtree split --prefix=projects/mom_recipes_web -b mom-recipes-deploy

# Push to GitHub as main
git push https://github.com/liujw101/mom-recipes.git mom-recipes-deploy:main
```

---

## Step 3 — Enable GitHub Pages

```powershell
gh api repos/liujw101/mom-recipes/pages -X POST -f build_type=workflow
```

Or in the browser:

1. Open https://github.com/liujw101/mom-recipes/settings/pages
2. **Build and deployment → Source:** select **GitHub Actions**

---

## Step 4 — Trigger the first build

The push in Step 2 should already trigger the workflow. To run manually:

```powershell
gh workflow run deploy.yml --repo liujw101/mom-recipes
```

Watch progress:

```powershell
gh run list --repo liujw101/mom-recipes
gh run watch --repo liujw101/mom-recipes
```

When green, open: **https://liujw101.github.io/mom-recipes/**

---

## Step 4 — Enable smart scan for handwritten Chinese (recommended)

Mom's recipes are **handwritten Chinese with English mixed in**. Basic OCR cannot read that well. Smart scan uses **Google Gemini Vision** (free tier).

### 4a. Create a free API key

1. Open https://aistudio.google.com/apikey
2. Click **Create API key**
3. (Recommended) In Google Cloud Console, restrict the key:
   - **Application restrictions** → **Websites**
   - Add: `https://liujw101.github.io/mom-recipes/*`

### 4b. Add key to GitHub Secrets

```powershell
gh secret set VITE_GEMINI_API_KEY --repo liujw101/mom-recipes
# Paste your API key when prompted
```

Or: GitHub → **mom-recipes** repo → **Settings** → **Secrets and variables** → **Actions** → **New secret**
- Name: `VITE_GEMINI_API_KEY`
- Value: your Gemini API key

### 4c. Redeploy

```powershell
gh workflow run deploy.yml --repo liujw101/mom-recipes
```

After deploy, the scan screen shows **"Smart scan on"** in green.

**Cost:** Gemini free tier is generous for family use (typically 1000+ scans/day). No credit card required for AI Studio keys in many regions.

---

## Step 6 — Mom installs on iPhone

1. Send Mom the link: `https://liujw101.github.io/mom-recipes/`
2. She opens it in **Safari** (not Chrome)
3. Tap **Share** (box with arrow) → **Add to Home Screen** → **Add**

---

## Updating the app later

After editing files under `projects/mom_recipes_web/`:

```powershell
cd c:\Users\ltlt_\00.AI\composer
git add projects/mom_recipes_web
git commit -m "Update Mom Recipes"
git subtree split --prefix=projects/mom_recipes_web -b mom-recipes-deploy
git push https://github.com/liujw101/mom-recipes.git mom-recipes-deploy:main --force
```

GitHub Actions rebuilds in ~2 minutes. Mom may need to close and reopen the app.

---

## Backup reminder

Tell Mom to tap **Backup** in the app periodically and save the JSON file (e.g. to Photos or Files). Recipes are stored in the browser — clearing Safari data deletes them.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank white page | Hard-refresh Safari; confirm URL ends with `/mom-recipes/` |
| Workflow failed | `gh run view --repo liujw101/mom-recipes --log-failed` |
| Pages not enabled | Repeat Step 3 |
| Camera not working | Safari → site settings → allow Camera |
