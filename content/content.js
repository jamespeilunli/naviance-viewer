import { parse } from '../parser/index.js';
import { initDB, saveSchool, getSchool } from '../storage/db-client.js';
import { hashString } from '../storage/hash.js';
import { showPanel } from '../ui/panel.js';
import { showPreferencePrompt } from '../ui/preference-prompt.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

(async function main() {
  // Guard against double-injection (e.g. declarative load + SPA re-injection)
  if (window.__navianceViewerRunning) return;
  window.__navianceViewerRunning = true;

  // 1. Inject page script immediately — must happen before the page's API calls fire
  injectPageScript();

  // 2. Register the message listener immediately so API responses intercepted during
  //    the preference prompt (or any async setup) are not missed.
  //    Messages arriving before the preference decision is made are buffered.
  const buffered = [];
  let preferenceResolved = false;
  let shouldParse = false;
  let captureMode = false;

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'SCATTERGRAM_VIEWER_INTERCEPT') return;

    if (!preferenceResolved) {
      buffered.push(event.data.data);
      return;
    }

    await processIntercepted(event.data.data, { shouldParse, captureMode });
  });

  // 3. Wait for document.body before any UI operations
  await new Promise(resolve => {
    if (document.body) return resolve();
    document.addEventListener('DOMContentLoaded', resolve);
  });

  // 4. Check auto-parse preference
  const { autoParse } = await chrome.storage.sync.get({ autoParse: null });

  if (autoParse === null) {
    const choice = await showPreferencePrompt();
    shouldParse = choice === 'always' || choice === 'once';
  } else if (autoParse === 'always') {
    shouldParse = true;
  } else if (autoParse === 'once') {
    // Reset to null so the prompt appears next time
    await chrome.storage.sync.set({ autoParse: null });
    shouldParse = true;
  }
  // autoParse === 'never': do nothing

  // 5. Capture mode: read setting before the parse gate so it works even if autoParse is 'never'
  ({ captureMode } = await chrome.storage.sync.get({ captureMode: false }));

  if (!shouldParse && !captureMode) {
    preferenceResolved = true; // unblock listener (it will no-op for future messages)
    return;
  }

  // 6. Initialize DB before processing any data (parse mode only)
  if (shouldParse) await initDB();

  // 7. Mark preference as resolved and drain any messages that arrived during setup
  preferenceResolved = true;
  for (const rawData of buffered) {
    await processIntercepted(rawData, { shouldParse, captureMode });
  }
})();

async function processIntercepted(rawData, { shouldParse, captureMode }) {
  if (captureMode) {
    const rawStr = JSON.stringify(rawData, null, 2);
    const blob = new Blob([rawStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capture-${Date.now()}.json`;
    (document.body ?? document.documentElement).appendChild(a);
    a.click();
    a.parentNode.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  if (!shouldParse) return;

  const context = extractSchoolContext();
  await handleParsedData(rawData, context);
}

async function handleParsedData(rawData, context) {
  const rawStr = JSON.stringify(rawData);
  const incomingHash = await hashString(rawStr);

  // Check existing record
  const existing = await getSchool(context.schoolId);
  const lastParsed = existing?.capturedAt ? new Date(existing.capturedAt).getTime() : 0;
  const ageMs = Date.now() - lastParsed;

  if (existing && existing.contentHash === incomingHash && ageMs < THIRTY_DAYS_MS) {
    // No change — show panel with existing data
    showPanel({
      data: existing.data,
      parseError: existing.parseError,
      parserTier: existing.parserTier,
      capturedAt: existing.capturedAt,
    });
    return;
  }

  // Parse
  const { data, tier, error } = await parse({ networkData: rawData, rawText: rawStr }, context);

  if (data) {
    const record = {
      schoolId: context.schoolId,
      schoolName: context.schoolName,
      capturedAt: data.meta.capturedAt,
      contentHash: incomingHash,
      parserTier: tier,
      schemaVersion: '1.0',
      parseError: null,
      data,
    };
    await saveSchool(record);
    showPanel({ data, parseError: null, parserTier: tier, capturedAt: record.capturedAt });
  } else {
    // Parse failed — preserve existing data, show error
    const errorStr = Array.isArray(error) ? error.join('; ') : (error ?? 'Unknown parse error');
    if (existing) {
      await saveSchool({ ...existing, parseError: errorStr });
    }
    showPanel({
      data: existing?.data ?? null,
      parseError: errorStr,
      parserTier: existing?.parserTier ?? null,
      capturedAt: existing?.capturedAt ?? null,
    });
  }
}

function injectPageScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/page-script.js');
  script.onload = () => script.remove();
  (document.head ?? document.documentElement).appendChild(script);
}

function extractSchoolContext() {
  // Extract UUID from path: /explore/college/<uuid>
  const pathMatch = window.location.pathname.match(/\/college\/([a-f0-9-]{36})/i);
  const pathUuid = pathMatch ? pathMatch[1] : null;

  // Fallback: query params (legacy URL styles)
  const urlParams = new URLSearchParams(window.location.search);
  const navianceId = pathUuid
    ?? urlParams.get('college') ?? urlParams.get('cid') ?? urlParams.get('id') ?? null;

  // Extract school name from page title (e.g., "Boston University | Naviance")
  const rawTitle = document.title;
  const name = rawTitle.split(/[|\-–]/)[0].trim() || 'Unknown School';

  // Derive stable schoolId from UUID or slugified name
  const schoolId = navianceId
    ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return { schoolId, schoolName: name };
}
