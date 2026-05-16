const DB_NAME = 'parse4sg';
const DB_VERSION = 1;
const STORE_NAME = 'schools';

let db = null;

export function initDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'schoolId' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject(new Error(`IndexedDB open failed: ${event.target.error}`));
    };
  });
}

function getStore(mode) {
  if (!db) throw new Error('DB not initialized. Call initDB() first.');
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export function saveSchool(record) {
  return new Promise((resolve, reject) => {
    const request = getStore('readwrite').put(record);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(new Error(`saveSchool failed: ${e.target.error}`));
  });
}

export function getSchool(schoolId) {
  return new Promise((resolve, reject) => {
    const request = getStore('readonly').get(schoolId);
    request.onsuccess = (e) => resolve(e.target.result ?? null);
    request.onerror = (e) => reject(new Error(`getSchool failed: ${e.target.error}`));
  });
}

export function getAllSchools() {
  return new Promise((resolve, reject) => {
    const request = getStore('readonly').getAll();
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(new Error(`getAllSchools failed: ${e.target.error}`));
  });
}

export function deleteSchool(schoolId) {
  return new Promise((resolve, reject) => {
    const request = getStore('readwrite').delete(schoolId);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(new Error(`deleteSchool failed: ${e.target.error}`));
  });
}
