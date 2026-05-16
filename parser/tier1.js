const SCHEMA_VERSION = '1.0';

/**
 * Tier 1 parser: parses a raw Naviance scattergram API response.
 *
 * @param {object} rawData - Parsed JSON from the intercepted network response.
 * @param {object} context - { schoolId, schoolName, scattergramUrl, navianceId }
 * @returns {object|null} Normalized data object, or null if input is invalid.
 */
export function parseFromNetwork(rawData, context) {
  if (!rawData || typeof rawData !== 'object') return null;
  if (!rawData.scattergrams) return null;

  return {
    school: {
      schoolId: context.schoolId,
      name: context.schoolName,
      navianceId: context.navianceId,
      scattergramUrl: context.scattergramUrl,
    },
    meta: {
      capturedAt: new Date().toISOString(),
      parserTier: 1,
      schemaVersion: SCHEMA_VERSION,
    },
    scattergrams: rawData.scattergrams,
    applicationsByYear: rawData.applicationsByYear ?? {},
    userInfo: rawData.userInfo ?? null,
    peerGpaMap: rawData.peerGpaMap ?? [],
  };
}
