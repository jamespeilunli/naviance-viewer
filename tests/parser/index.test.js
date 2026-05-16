/**
 * @jest-environment jsdom
 */
import { parse } from '../../parser/index.js';
import bostonUniv from '../fixtures/boston_univ.json';

const context = {
  schoolId: 'boston-university',
  schoolName: 'Boston University',
  scattergramUrl: 'https://connection.naviance.com/family-connection/college/match/scattergram',
  navianceId: 'boston-university',
};

describe('parse (three-tier pipeline)', () => {
  it('succeeds with Tier 1 when raw network data is provided', async () => {
    const result = await parse({ networkData: bostonUniv, rawText: null }, context);
    expect(result.data).not.toBeNull();
    expect(result.data.meta.parserTier).toBe(1);
    expect(result.error).toEqual([]);
  });

  it('falls back to Tier 2 when raw network data is invalid', async () => {
    document.body.innerHTML = `
      <script type="application/json">
        ${JSON.stringify(bostonUniv)}
      </script>
    `;
    const result = await parse({ networkData: { notScattergram: true }, rawText: null, domDocument: document }, context);
    expect(result.data.meta.parserTier).toBe(2);
    expect(result.error).toBeInstanceOf(Array);
    expect(result.error.some(e => e.includes('Tier 1'))).toBe(true);
  });

  it('returns error when all tiers fail', async () => {
    document.body.innerHTML = '<div>nothing</div>';
    const result = await parse({ networkData: null, rawText: null, domDocument: document }, context);
    expect(result.data).toBeNull();
    expect(Array.isArray(result.error)).toBe(true);
    expect(result.error.length).toBe(3);
  });
});
