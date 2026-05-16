import { parseFromNetwork } from './tier1.js';
import { parseFromDOM } from './tier2.js';
import { parseFromAI } from './tier3.js';

/**
 * Runs the three-tier parser pipeline.
 *
 * @param {{ networkData: object|null, rawText: string|null, domDocument: Document|null }} input
 *   networkData: parsed JSON from intercepted network response (or null if missed)
 *   rawText: raw string content for AI fallback
 *   domDocument: DOM document for Tier 2 fallback
 * @param {object} context - { schoolId, schoolName, scattergramUrl, navianceId }
 * @returns {Promise<{ data: object|null, tier: number|null, error: string[] }>}
 */
export async function parse(input, context) {
  const errors = [];

  // Tier 1: network response
  try {
    const result = parseFromNetwork(input.networkData, context);
    if (result) return { data: result, tier: 1, error: errors };
    errors.push('Tier 1: invalid or missing network data');
  } catch (e) {
    errors.push(`Tier 1: ${e.message}`);
  }

  // Tier 2: DOM fallback
  try {
    const doc = input.domDocument ?? (typeof document !== 'undefined' ? document : null);
    if (!doc) {
      errors.push('Tier 2: skipped — no document available');
    } else {
      const result = parseFromDOM(doc, context);
      if (result) return { data: result, tier: 2, error: errors };
      errors.push('Tier 2: no scattergram data found in DOM');
    }
  } catch (e) {
    errors.push(`Tier 2: ${e.message}`);
  }

  // Tier 3: AI fallback
  try {
    const result = await parseFromAI(input.rawText ?? '', context);
    if (result) return { data: result, tier: 3, error: errors };
    errors.push('Tier 3: not available or returned no data');
  } catch (e) {
    errors.push(`Tier 3: ${e.message}`);
  }

  return {
    data: null,
    tier: null,
    error: errors,
  };
}
