/**
 * Database client for content scripts.
 * Forwards requests to the background service worker where the actual DB lives.
 */

export async function initDB() {
  return sendBgAction('initDB');
}

export async function saveSchool(record) {
  return sendBgAction('saveSchool', record);
}

export async function getSchool(schoolId) {
  return sendBgAction('getSchool', schoolId);
}

export async function getAllSchools() {
  return sendBgAction('getAllSchools');
}

export async function deleteSchool(schoolId) {
  return sendBgAction('deleteSchool', schoolId);
}

function sendBgAction(action, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'DB_ACTION', action, payload }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response) {
        return reject(new Error('No response received from background script for ' + action));
      }
      if (!response.success) {
        return reject(new Error(response.error));
      }
      resolve(response.result);
    });
  });
}
