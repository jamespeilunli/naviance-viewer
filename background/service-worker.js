/**
 * Service worker for Naview.
 * Detects navigation to Naviance scattergram pages and updates the extension badge.
 * Also handles SPA (pushState) navigation by dynamically injecting scripts.
 */

import { initDB, saveSchool, getSchool, getAllSchools, deleteSchool } from '../storage/db.js';

const SCATTERGRAM_PATTERNS = [
  'naviance.com',
];

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url) return;

  const isScattergram = SCATTERGRAM_PATTERNS.some(p => tab.url.includes(p))
    && (tab.url.includes('scattergram') || tab.url.includes('/explore/college/'));

  if (isScattergram) {
    chrome.action.setBadgeText({ text: '●', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#1a73e8', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('ui/viewer.html') });
});

// Naviance is a SPA — clicking a college link changes the URL via History API without
// reloading the document, so content scripts declared in the manifest never re-run.
// Listen for pushState navigation and inject scripts dynamically.
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only

  chrome.action.setBadgeText({ text: '●', tabId: details.tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#1a73e8', tabId: details.tabId });

  // Inject page-script.js into the MAIN world first so it can wrap fetch/XHR
  // before the page makes its scattergram API call.
  await chrome.scripting.executeScript({
    target: { tabId: details.tabId },
    files: ['content/page-script.js'],
    world: 'MAIN',
  });

  // Inject the content script into the ISOLATED world to run the UI + parsing logic.
  await chrome.scripting.executeScript({
    target: { tabId: details.tabId },
    files: ['dist/content.js'],
    world: 'ISOLATED',
  });
}, {
  url: [
    { hostSuffix: 'naviance.com', pathContains: '/explore/college/' },
    { hostSuffix: 'naviance.com', pathContains: 'scattergram' },
    { hostSuffix: 'connection.naviance.com', pathContains: 'scattergram' },
  ],
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DB_ACTION') {
    handleDbAction(message.action, message.payload)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

async function handleDbAction(action, payload) {
  if (action === 'initDB') return initDB();
  if (action === 'saveSchool') return saveSchool(payload);
  if (action === 'getSchool') return getSchool(payload);
  if (action === 'getAllSchools') return getAllSchools();
  if (action === 'deleteSchool') return deleteSchool(payload);
  throw new Error(`Unknown DB action: ${action}`);
}

// Proactively initialize DB on startup
initDB().catch(console.error);
