const CSV_HEADERS = [
  'schoolName',
  'capturedAt',
  'gpaType',
  'scoreType',
  'outcome',
  'round',
  'gpa',
  'actComposite',
  'satHighestCombo',
  'satConverted1600',
  'isTestOptional',
];

/**
 * Flattens normalized scattergram data into CSV rows — one row per applicant.
 *
 * @param {object} data - Normalized scattergram data object.
 * @returns {string} CSV string with header row.
 */
export function serializeToCSV(data) {
  const rows = [CSV_HEADERS.join(',')];

  const schoolName = escapeCSV(data.school?.name ?? '');
  const capturedAt = escapeCSV(data.meta?.capturedAt ?? '');
  const scattergrams = data.scattergrams ?? {};

  for (const [gpaType, gpaData] of Object.entries(scattergrams)) {
    for (const scoreType of ['act', 'sat']) {
      const scoreData = gpaData[scoreType];
      if (!scoreData?.apps) continue;

      for (const [outcomeKey, applicants] of Object.entries(scoreData.apps)) {
        const { outcome, round } = parseOutcomeKey(outcomeKey);

        for (const applicant of applicants) {
          const act = applicant.actComposite ?? '';
          const satHighest = applicant.highestComboSat ?? 0;
          const satConverted = applicant.highestComboSatWWConvertedTo1600
            ?? applicant.studentSATCompositeConvertedTo1600
            ?? 0;

          rows.push([
            schoolName,
            capturedAt,
            escapeCSV(gpaType),
            escapeCSV(scoreType.toUpperCase()),
            escapeCSV(outcome),
            escapeCSV(round),
            applicant.gpa ?? '',
            act,
            satHighest,
            satConverted,
            applicant.isTestOptional ?? '',
          ].join(','));
        }
      }
    }
  }

  return rows.join('\r\n');
}

/**
 * Triggers a CSV file download in the browser.
 *
 * @param {object} data - Normalized scattergram data object.
 * @param {string} filename - e.g. "boston-university.csv"
 */
export function downloadCSV(data, filename) {
  const blob = new Blob([serializeToCSV(data)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Parses an outcome key like "acceptedRD", "waitlistedDeniedRD", "deniedEA"
 * into { outcome, round }.
 */
function parseOutcomeKey(key) {
  const roundMap = { RD: 'RD', EA: 'EA', ED2: 'ED2', ED: 'ED', PRI: 'PRI' };

  const outcomeMatch = key.match(/^(accepted|denied|waitlisted)/i);
  const roundMatch = key.match(/(RD|EA|ED2|ED|PRI)$/);

  return {
    outcome: outcomeMatch ? outcomeMatch[1].toLowerCase() : key,
    round: roundMatch ? roundMap[roundMatch[1]] : 'unknown',
  };
}

function escapeCSV(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
