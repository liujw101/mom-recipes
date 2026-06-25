# Mom Recipes — Web App (Free, no Apple fee)

A **Progressive Web App** for Mom to digitize paper recipes on her iPhone — no App Store, no $99/year Apple Developer Program.

Works in **Safari**: open the link → Share → **Add to Home Screen** for an app-like icon on the home screen.

## Features

- Scan recipe photos → OCR (Chinese + English via Tesseract.js)
- Review and edit before saving
- Manual recipe entry
- Search, favorites, tags
- Chinese ↔ English translation (free MyMemory API)
- Share recipe text; print / save as PDF via browser
- Backup & restore (JSON export/import)
- All data stored **locally** on the phone (IndexedDB)

## Cost

| Item | Cost |
|------|------|
| Apple Developer | **$0** |
| Hosting (GitHub Pages) | **$0** |
| Translation API | **$0** (MyMemory free tier, ~1000 words/day) |

## Run locally (Windows)

```bash
cd projects/mom_recipes_web
npm install
npm run dev
```

Open http://localhost:5173 — use Chrome DevTools mobile view or your phone on the same Wi‑Fi.

## Deploy to GitHub Pages (free)

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` — workflow [`.github/workflows/mom-recipes-web.yml`](../../.github/workflows/mom-recipes-web.yml) deploys automatically.
4. Share the Pages URL with Mom (e.g. `https://YOUR_USER.github.io/composer/` — path depends on repo name).

### Add to Home Screen (Mom's iPhone)

1. Open the URL in **Safari** (not Chrome).
2. Tap **Share** (square with arrow).
3. Tap **Add to Home Screen**.
4. Tap **Add** — app icon appears like a native app.

## Daily workflow

```
Edit on Windows → push to main → GitHub Pages updates (~2 min) → Mom refreshes or reopens app
```

No Mac, no Xcode, no TestFlight.

## Limitations vs native iOS app

| Feature | Web app | Native iOS (needs $99/yr) |
|---------|---------|---------------------------|
| Install on iPhone | Safari → Add to Home Screen | TestFlight / App Store |
| Handwritten Chinese OCR | Good enough; often needs editing | Apple Vision (better) |
| Translation | Online API (free tier limits) | On-device Apple Translation |
| iCloud sync | No — use Backup/Restore JSON | CloudKit automatic |
| Offline OCR | Works after first load (cached) | Always |
| Spotlight search | No | Yes |

## Backup reminder

Recipes live in the phone browser storage. If Mom clears Safari data, recipes are lost unless she uses **Backup** (exports JSON). Encourage periodic backups.

## Native iOS version

The native SwiftUI app in [`../mom_recipes/`](../mom_recipes/) is kept for future use if you enroll in Apple Developer later. It is **not required** for the free path.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OCR poor on handwriting | Retake photo with better light; edit manually |
| Translation fails | Daily API limit — try tomorrow or edit translations manually |
| App feels "not full screen" | Must use **Add to Home Screen** from Safari |
| Recipes disappeared | Restore from JSON backup |
| Camera not opening | Use "Choose Image" or check Safari camera permission |
