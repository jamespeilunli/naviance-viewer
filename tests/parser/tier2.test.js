/**
 * @jest-environment jsdom
 */
import { parseFromDOM } from '../../parser/tier2.js';
import bostonUniv from '../fixtures/boston_univ.json';

const context = {
  schoolId: 'boston-university',
  schoolName: 'Boston University',
  scattergramUrl: 'https://connection.naviance.com/family-connection/college/match/scattergram',
  navianceId: 'boston-university',
};

function makeDocWithInlineData(data) {
  document.body.innerHTML = `
    <div id="app">
      <script type="application/json" id="scattergram-data">
        ${JSON.stringify(data)}
      </script>
    </div>
  `;
}

describe('parseFromDOM', () => {
  it('extracts data from an inline <script type="application/json"> tag', () => {
    makeDocWithInlineData(bostonUniv);
    const result = parseFromDOM(document, context);
    expect(result).not.toBeNull();
    expect(result.scattergrams).toBeDefined();
    expect(result.meta.parserTier).toBe(2);
  });

  it('returns null when no scattergram data found in DOM', () => {
    document.body.innerHTML = '<div>No data here</div>';
    const result = parseFromDOM(document, context);
    expect(result).toBeNull();
  });

  it('returns null when inline JSON is malformed', () => {
    document.body.innerHTML = `
      <script type="application/json" id="scattergram-data">
        { not valid json }
      </script>
    `;
    const result = parseFromDOM(document, context);
    expect(result).toBeNull();
  });
});
