import { hashString } from '../../storage/hash.js';

describe('hashString', () => {
  it('produces the correct SHA-256 hash for a known input', async () => {
    const result = await hashString('hello');
    expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('returns a 64-character hex string', async () => {
    const result = await hashString('hello');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('returns the same hash for the same input', async () => {
    const a = await hashString('test input');
    const b = await hashString('test input');
    expect(a).toBe(b);
  });

  it('returns different hashes for different inputs', async () => {
    const a = await hashString('input A');
    const b = await hashString('input B');
    expect(a).not.toBe(b);
  });

  it('hashes stringified JSON consistently', async () => {
    const data = { scattergrams: { gpa: { gpaCount: 750 } } };
    const h1 = await hashString(JSON.stringify(data));
    const h2 = await hashString(JSON.stringify(data));
    expect(h1).toBe(h2);
  });
});
