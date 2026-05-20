import { serializeToJSON } from '../../export/json.js';
import bostonUniv from '../fixtures/boston_univ.json';

const sampleData = {
  school: { schoolId: 'boston-university', name: 'Boston University' },
  meta: { capturedAt: '2026-03-28T12:00:00Z', parserTier: 1, schemaVersion: '1.0' },
  scattergrams: bostonUniv.scattergrams,
  applicationsByYear: bostonUniv.applicationsByYear,
  userInfo: null,
  peerGpaMap: [],
};

describe('serializeToJSON', () => {
  it('returns a valid JSON string', () => {
    const result = serializeToJSON(sampleData);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('includes school name in the output', () => {
    const result = serializeToJSON(sampleData);
    const parsed = JSON.parse(result);
    expect(parsed.school.name).toBe('Boston University');
  });

  it('is pretty-printed with 2-space indentation', () => {
    const result = serializeToJSON(sampleData);
    expect(result).toContain('\n  ');
  });
});
