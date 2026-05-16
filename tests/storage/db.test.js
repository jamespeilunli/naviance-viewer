import 'fake-indexeddb/auto';

let initDB, saveSchool, getSchool, getAllSchools, deleteSchool;

beforeEach(async () => {
  jest.resetModules();
  const { IDBFactory } = await import('fake-indexeddb');
  globalThis.indexedDB = new IDBFactory();
  // Re-import the module fresh so the module-level `db` variable is reset to null
  const dbModule = await import('../../storage/db.js');
  initDB = dbModule.initDB;
  saveSchool = dbModule.saveSchool;
  getSchool = dbModule.getSchool;
  getAllSchools = dbModule.getAllSchools;
  deleteSchool = dbModule.deleteSchool;
  await initDB();
});

const sampleRecord = {
  schoolId: 'boston-university',
  schoolName: 'Boston University',
  capturedAt: '2026-03-28T12:00:00Z',
  contentHash: 'abc123',
  parserTier: 1,
  schemaVersion: '1.0',
  parseError: null,
  data: { scattergrams: { gpa: { gpaCount: 750 } } },
};

describe('saveSchool / getSchool', () => {
  it('saves and retrieves a school record', async () => {
    await saveSchool(sampleRecord);
    const retrieved = await getSchool('boston-university');
    expect(retrieved.schoolId).toBe('boston-university');
    expect(retrieved.schoolName).toBe('Boston University');
    expect(retrieved.contentHash).toBe('abc123');
  });

  it('overwrites an existing record for the same schoolId', async () => {
    await saveSchool(sampleRecord);
    await saveSchool({ ...sampleRecord, contentHash: 'newHash' });
    const retrieved = await getSchool('boston-university');
    expect(retrieved.contentHash).toBe('newHash');
  });

  it('returns null for a non-existent schoolId', async () => {
    const result = await getSchool('nonexistent');
    expect(result).toBeNull();
  });
});

describe('getAllSchools', () => {
  it('returns all saved school records', async () => {
    await saveSchool(sampleRecord);
    await saveSchool({ ...sampleRecord, schoolId: 'mit', schoolName: 'MIT' });
    const all = await getAllSchools();
    expect(all).toHaveLength(2);
    expect(all.map(r => r.schoolId)).toContain('boston-university');
    expect(all.map(r => r.schoolId)).toContain('mit');
  });

  it('returns empty array when no schools saved', async () => {
    const all = await getAllSchools();
    expect(all).toEqual([]);
  });
});

describe('deleteSchool', () => {
  it('removes a school record', async () => {
    await saveSchool(sampleRecord);
    await deleteSchool('boston-university');
    const result = await getSchool('boston-university');
    expect(result).toBeNull();
  });
});

describe('initDB idempotence', () => {
  it('returns the same connection when called multiple times', async () => {
    const first = await initDB();
    const second = await initDB();
    expect(first).toBe(second);
  });
});
