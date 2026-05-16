const SCHEMA_VERSION = '1.0';

/**
 * Tier 3 parser: uses Chrome's Built-in AI (Gemini Nano) to extract
 * scattergram data from raw page content.
 *
 * STUBBED — returns null until window.ai is available (Chrome 127+ with
 * Built-in AI enabled). Activate by replacing the stub body with the
 * implementation below once the API is stable.
 *
 * To enable: chrome://flags/#optimization-guide-on-device-model → Enabled
 *            chrome://flags/#prompt-api-for-gemini-nano → Enabled
 *
 * @param {string} text - Raw API response string or page HTML.
 * @param {object} context - { schoolId, schoolName }
 * @returns {object|null} Normalized data, or null if unavailable/failed.
 */
export async function parseFromAI(text, context) {
  /* Uncomment when Chrome AI API is stable:

  try {
    const session = await window.ai.languageModel.create({
      systemPrompt: `You extract structured college application data from Naviance scattergram API responses.
Return ONLY valid JSON matching this schema:
{
  "scattergrams": { "gpa": {...}, "weightedGpa": {...} },
  "applicationsByYear": {},
  "userInfo": null,
  "peerGpaMap": []
}
If you cannot extract valid data, return the string "null".`,
    });

    const response = await session.prompt(
      'Extract scattergram data from this content:\n\n' + text.slice(0, 8000)
    );
    session.destroy();

    const parsed = JSON.parse(response.trim());
    if (!parsed || !parsed.scattergrams) return null;

    return {
      school: {
        schoolId: context.schoolId,
        name: context.schoolName,
      },
      meta: {
        capturedAt: new Date().toISOString(),
        parserTier: 3,
        schemaVersion: SCHEMA_VERSION,
      },
      scattergrams: parsed.scattergrams,
      applicationsByYear: parsed.applicationsByYear ?? {},
      userInfo: parsed.userInfo ?? null,
      peerGpaMap: parsed.peerGpaMap ?? [],
    };
  } catch {
    return null;
  }
  */

  return null;
}
