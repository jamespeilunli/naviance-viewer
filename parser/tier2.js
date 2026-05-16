const SCHEMA_VERSION = '1.0';

/**
 * Tier 2 parser: attempts to extract scattergram data from the page DOM.
 *
 * Strategy:
 *   1. Look for <script type="application/json"> tags containing scattergram data.
 *   2. Look for a known global variable injected by Naviance's JS bundle.
 *
 * NOTE: The exact DOM structure of Naviance pages must be verified by inspecting
 * a live page. The script-tag strategy covers apps that inline data as JSON.
 * Adjust selector and global variable names after inspecting the actual page.
 *
 * @param {Document} doc - The page document.
 * @param {object} context - { schoolId, schoolName, scattergramUrl, navianceId }
 * @returns {object|null} Normalized data, or null if extraction fails.
 */
export function parseFromDOM(doc, context) {
  // Strategy 1: inline <script type="application/json"> tags
  const scriptTags = doc.querySelectorAll('script[type="application/json"]');
  for (const tag of scriptTags) {
    try {
      const json = JSON.parse(tag.textContent);
      if (json && json.scattergrams) {
        return buildResult(json, context);
      }
    } catch {
      // malformed JSON — continue to next tag
    }
  }

  // Strategy 2: known Naviance global variable names
  // Adjust these after inspecting a live Naviance page in DevTools → Console
  const globalCandidates = [
    '__NAVIANCE_DATA__',
    '__SCATTERGRAM_DATA__',
    'NavianceApp',
  ];
  for (const varName of globalCandidates) {
    try {
      const val = (typeof window !== 'undefined') ? window[varName] : undefined;
      if (val && val.scattergrams) {
        return buildResult(val, context);
      }
    } catch {
      // access error — skip
    }
  }

  return null;
}

function buildResult(rawData, context) {
  return {
    school: {
      schoolId: context.schoolId,
      name: context.schoolName,
      navianceId: context.navianceId,
      scattergramUrl: context.scattergramUrl,
    },
    meta: {
      capturedAt: new Date().toISOString(),
      parserTier: 2,
      schemaVersion: SCHEMA_VERSION,
    },
    scattergrams: rawData.scattergrams,
    applicationsByYear: rawData.applicationsByYear ?? {},
    userInfo: rawData.userInfo ?? null,
    peerGpaMap: rawData.peerGpaMap ?? [],
  };
}
