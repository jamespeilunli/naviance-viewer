import { serializeToCSV } from '../../export/csv.js';
import bostonUniv from '../fixtures/boston_univ.json';

const sampleData = {
  school: { name: 'Boston University' },
  meta: { capturedAt: '2026-03-28T12:00:00Z' },
  scattergrams: bostonUniv.scattergrams,
};

describe('serializeToCSV', () => {
  it('returns a string with a header row', () => {
    const result = serializeToCSV(sampleData);
    const lines = result.split('\r\n');
    expect(lines[0]).toContain('schoolName');
    expect(lines[0]).toContain('gpaType');
    expect(lines[0]).toContain('scoreType');
    expect(lines[0]).toContain('outcome');
    expect(lines[0]).toContain('round');
    expect(lines[0]).toContain('gpa');
  });

  it('produces one data row per applicant', () => {
    const result = serializeToCSV(sampleData);
    const lines = result.trim().split('\r\n');
    // header + at least one data row
    expect(lines.length).toBeGreaterThan(1);
  });

  it('includes school name in every data row', () => {
    const result = serializeToCSV(sampleData);
    const dataLines = result.trim().split('\r\n').slice(1);
    dataLines.forEach(line => {
      expect(line).toContain('Boston University');
    });
  });

  it('handles missing and null score fields gracefully', () => {
    const sparse = {
      school: { name: 'Test School' },
      meta: { capturedAt: '2026-01-01T00:00:00Z' },
      scattergrams: {
        weighted: {
          act: {
            apps: {
              acceptedRD: [
                { gpa: 3.5, actComposite: null, highestComboSat: null,
                  highestComboSatWWConvertedTo1600: null, isTestOptional: null }
              ]
            }
          }
        }
      }
    };
    expect(() => serializeToCSV(sparse)).not.toThrow();
    const result = serializeToCSV(sparse);
    const lines = result.trim().split('\r\n');
    expect(lines.length).toBe(2); // header + 1 data row
  });
});
