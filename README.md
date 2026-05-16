# parse4sg_plugin

**Parser for Scattergram from Naviance school page**

A Chrome browser extension that automatically intercepts and parses scattergram data from Naviance college planning pages, displays a summary panel, and exports data to JSON or CSV.

---

## What It Does

When you visit a Naviance scattergram page, the extension:
1. Intercepts the raw API response powering the scattergram
2. Parses and stores the data locally (IndexedDB)
3. Injects a floating summary panel into the page
4. Lets you export the full dataset as JSON or CSV
5. Provides a full-screen interactive **Dashboard Viewer** (click the extension icon) to compare scattergrams side-by-side using your stored database.

---

## Architecture

```
Naviance Page
    └── Content Script
            ├── Page Script → intercepts fetch/XHR API calls
            ├── Parser (3-tier pipeline)
            └── Floating Panel UI
    └── Service Worker (background)
            └── Tab navigation detection, badge updates
```

**Three-tier parser** (each tier is a fallback for the previous):
- **Tier 1** — Parse raw intercepted network response (primary, most reliable)
- **Tier 2** — DOM scraping (fallback if API call was missed)
- **Tier 3** — Gemini Nano / Chrome Built-in AI (future-proof fallback for structural changes)

See full design spec: [`docs/superpowers/specs/2026-03-28-parse4sg-plugin-design.md`](docs/superpowers/specs/2026-03-28-parse4sg-plugin-design.md)

---

## Key Design Decisions

- **Chrome-only (MV3)** — required for Gemini Nano (Chrome Built-in AI)
- **XHR/fetch interception** — captures raw API data, not rendered DOM; most resilient to visual redesigns
- **Floating injected panel** — auto-appears on parse; draggable, minimizable, no extension popup limitations
- **One-time preference prompt** — "Always / Just this once / Never"; saved to `chrome.storage.sync`; reversible
- **Single copy per school in IndexedDB** — ~67MB for 200 schools; no overwrite on parse failure
- **SHA-256 hash + 30-day interval** — avoids redundant saves; only stores when data actually changes
- **Rich schema preserved** — full nested structure (ED/EA/RD rounds, waitlist subtypes, weighted/unweighted GPA, SAT/ACT) kept intact for future visualization

---

## Project Structure

```
parse4sg_plugin/
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   ├── content.js
│   └── page-script.js
├── parser/
│   └── index.js              # Three-tier pipeline
├── ui/
│   ├── naviance_viewer.html  # Standalone College Dashboard Viewer
│   ├── naviance_viewer.js    # Viewer logic (Graphing, UI sync, DB connection)
│   ├── panel.js
│   ├── panel.css
│   └── preference-prompt.js
├── export/
│   ├── json.js
│   └── csv.js
├── storage/
│   ├── db.js                 # IndexedDB wrapper
│   └── hash.js               # SHA-256 content hashing
├── tests/
│   └── fixtures/
│       └── boston_univ.json  # Tier 1 parser fixture
└── docs/
    └── superpowers/specs/
        └── 2026-03-28-parse4sg-plugin-design.md
```

---

## Data Schema

Each school record in IndexedDB:

```json
{
  "schoolId": "boston-university",
  "schoolName": "Boston University",
  "capturedAt": "2026-03-28T12:00:00Z",
  "contentHash": "a3f8c2d1...",
  "parserTier": 1,
  "schemaVersion": "1.0",
  "parseError": null,
  "data": {
    "scattergrams": { "gpa": { "act": {...}, "sat": {...} }, "weightedGpa": {...} },
    "applicationsByYear": { "2024": { "totalApplied": 73, "totalAccepted": 20, "totalEnrolled": 4 } },
    "userInfo": { "academics": { "gpa": 4.0, "sat": 0, "act": 0 } }
  }
}
```

---

## Testing

- **Unit tests**: parser tiers run against JSON fixtures (see `tests/fixtures/`)
- **Integration tests**: HAR file replay for full page load + API interception
- **Capture mode**: developer toggle in options page that saves raw intercepted responses as fixtures

---

## Development Setup

### Prerequisites
- Node.js 19+
- Chrome 114+ / Chrome 127+ (for Gemini Nano, optional)

### Install dependencies
```bash
npm install
```

### Run tests
```bash
npm test
```

### Build (required before loading in Chrome)
```bash
npm run build
# or watch mode during development:
npm run build:watch
```

### Load in Chrome
1. Run `npm run build` first
2. Open `chrome://extensions`
3. Enable Developer Mode
4. Click "Load unpacked" → select this directory

### Capture mode (for test fixtures)
1. Open extension Options page
2. Enable "Capture mode"
3. Visit a Naviance scattergram page — raw API response downloads automatically
4. Move the downloaded file to `tests/fixtures/` for use as a test fixture

---

## Permissions

- `storage` — preferences and session cache
- `activeTab` — inject content script on demand
- `scripting` — inject page script into page JS context
- Host permissions for Naviance domains

---

## Packaging for Release (Fixing the 80MB load)

When loading the plugin via "Load unpacked", Chrome naively counts the size of the entire development directory. This includes the `node_modules/` folder (~80MB of dev dependencies like `jest` and `esbuild`) and the `.git` directory. **These files are completely ignored by the browser at runtime.**

To compile an actual lightweight release build (usually < 1 MB) suitable for distribution:
```bash
npm run package
```
This script will pack only the necessary execution files into `parse4sg-release.zip` directly in your workspace.
