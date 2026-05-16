import { parseFromNetwork } from '../../parser/tier1.js';
import bostonUniv from '../fixtures/boston_univ.json';

const context = {
  schoolId: 'boston-university',
  schoolName: 'Boston University',
  scattergramUrl: 'https://connection.naviance.com/family-connection/college/match/scattergram?college=boston-university',
  navianceId: 'boston-university',
};

describe('parseFromNetwork', () => {
  it('returns normalized data from a valid Naviance response', () => {
    const result = parseFromNetwork(bostonUniv, context);
    expect(result).not.toBeNull();
    expect(result.school.name).toBe('Boston University');
    expect(result.school.schoolId).toBe('boston-university');
    expect(result.scattergrams).toBeDefined();
    expect(result.scattergrams.gpa).toBeDefined();
    expect(result.applicationsByYear).toBeDefined();
    expect(result.userInfo).toBeDefined();
    expect(result.meta.parserTier).toBe(1);
    expect(result.meta.schemaVersion).toBe('1.0');
  });

  it('preserves raw scattergram structure including gpa and weightedGpa', () => {
    const result = parseFromNetwork(bostonUniv, context);
    expect(result.scattergrams.gpa.gpaCount).toBe(750);
    expect(result.scattergrams.weightedGpa).toBeDefined();
  });

  it('preserves applicationsByYear data', () => {
    const result = parseFromNetwork(bostonUniv, context);
    expect(result.applicationsByYear['2024']).toEqual({
      totalApplied: 73,
      totalAccepted: 20,
      totalEnrolled: 4,
    });
  });

  it('preserves userInfo', () => {
    const result = parseFromNetwork(bostonUniv, context);
    expect(result.userInfo.userId).toBe(71085607);
    expect(result.userInfo.academics.gpa).toBe(4);
  });

  it('returns null when scattergrams key is missing', () => {
    const result = parseFromNetwork({ someOtherData: true }, context);
    expect(result).toBeNull();
  });

  it('returns null for null input', () => {
    const result = parseFromNetwork(null, context);
    expect(result).toBeNull();
  });

  it('returns null for non-object input', () => {
    const result = parseFromNetwork('not an object', context);
    expect(result).toBeNull();
  });
});
