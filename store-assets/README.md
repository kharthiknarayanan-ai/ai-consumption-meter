# Store assets

## Icons

| File | Use |
|---|---|
| `../extension/icons/icon16.png` | Toolbar. Arc only — a needle at this size is just noise. |
| `../extension/icons/icon48.png` | Extensions management page. |
| `../extension/icons/icon128.png` | Install dialog. |
| `icon128-store.png` | Chrome Web Store listing. |

Regenerate with the script in the project history if the palette changes; the
mark is drawn at 16× and downsampled for clean edges, and the small size is
tuned separately rather than being the large one scaled down.

## Screenshots

Chrome Web Store requires screenshots at **1280×800** or 640×400. They must show
the *real* extension UI — demo data is fine and normal, mocked-up interfaces
that don't match the shipped product are a rejection risk.

`demo-data.json` is a deterministic five-week history that makes the dashboard
render fully: all four platforms, all four categories, a mature (non-provisional)
profile, and a trend with realistic quiet days.

### Taking the screenshots

**1. Back up your real data first.**
Open the dashboard → *Download my data (JSON)*. Keep that file safe.

**2. Load the demo data.**
Dashboard → *Restore from file* → select `store-assets/demo-data.json`.
Confirm the replace prompt.

**3. Capture.** On macOS, `Cmd+Shift+4` then Space captures a window; or use
DevTools (`Cmd+Option+I` → `Cmd+Shift+P` → "Capture screenshot") for an exact
viewport size. Set the browser window to roughly 1280×800 first.

Worth capturing:

- **The whole dashboard, top of page** — the big aiU reading plus the profile
  card. This is the primary listing image.
- **The profile card close up** — avatar, score, and the three component bars.
- **The two doughnut charts** — platform and category breakdown.
- **The 14-day trend** with the 7-day average line on.
- **"How this works"** expanded — shows the product explains itself and is
  honest about its limits. Reviewers notice this.

**4. Restore your real data.**
Dashboard → *Restore from file* → select the backup from step 1.

### Note

Don't screenshot the empty state or the provisional profile badge for the
listing — both are accurate but make the product look broken to someone who
doesn't yet know what they're looking at.
