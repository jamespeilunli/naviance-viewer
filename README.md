# Naviance Viewer

Naviance Viewer is a Chrome extension that turns Naviance scattergrams into usable data. It captures the scattergram API response on college pages, saves each school locally, shows a compact in-page summary, and opens a full-screen viewer for comparing colleges side by side.

Built for students who want to understand their school's historical college outcomes without manually copying points from a scattergram.

## Features

- Automatically detects Naviance college scattergram pages.
- Parses applicant outcomes, GPA, SAT, ACT, admission rounds, and yearly application totals.
- Saves one local record per college in IndexedDB.
- Shows a draggable summary panel directly on the Naviance page.
- Exports each college dataset as JSON or CSV.
- Opens a dashboard viewer from the extension icon for loading and comparing saved scattergrams.
- Includes an opt-in capture mode for creating parser fixtures while developing.

## Privacy

Naviance Viewer stores parsed data locally in the browser. It does not upload scattergram data to a server.

The optional Tier 3 parser is designed for Chrome's built-in AI APIs if they are available. The primary parser uses intercepted local network responses and does not require AI.

## How It Works

```text
Naviance page
  -> page script intercepts scattergram fetch/XHR responses
  -> content script parses and stores the data
  -> floating panel shows a quick summary
  -> extension dashboard reads saved schools from IndexedDB
```

The parser uses three tiers:

- Tier 1: parse the raw Naviance API response.
- Tier 2: scrape the page DOM if a network response was missed.
- Tier 3: use Chrome built-in AI as a future fallback for page/API changes.

## Project Structure

```text
naviance-viewer/
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   ├── content.js
│   └── page-script.js
├── parser/
│   ├── index.js
│   ├── tier1.js
│   ├── tier2.js
│   └── tier3.js
├── ui/
│   ├── naviance_viewer.html
│   ├── naviance_viewer.js
│   ├── panel.js
│   ├── panel.css
│   └── preference-prompt.js
├── export/
│   ├── csv.js
│   └── json.js
├── storage/
│   ├── db.js
│   ├── db-client.js
│   └── hash.js
└── tests/
    ├── fixtures/
    ├── export/
    ├── parser/
    └── storage/
```

## Development

Prerequisites:

- Node.js 19+
- Google Chrome with extension developer mode enabled

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build the bundled content script:

```bash
npm run build
```

During development:

```bash
npm run build:watch
```

## Load the Extension

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Click **Load unpacked**.
5. Select this repository folder.
6. Visit a Naviance college scattergram page.

Click the extension icon to open the dashboard viewer.

## Capture Mode

Capture mode saves raw scattergram API responses as JSON files for parser testing.

1. Open the extension options page.
2. Enable **Capture mode**.
3. Visit a Naviance scattergram page.
4. Move the downloaded capture file into `tests/fixtures/`.

## Packaging

Create a lightweight release zip without `node_modules`, test fixtures, or git metadata:

```bash
npm run package
```

The release archive is written to `naviance-viewer-release.zip`.

## Tech Stack

- Chrome Extension Manifest V3
- JavaScript modules
- esbuild
- IndexedDB
- Jest
