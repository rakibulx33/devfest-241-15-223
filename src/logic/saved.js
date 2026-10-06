// Bonus: keep the whole project (requirements, uploaded files, matches, dates) in IndexedDB
// so work survives a page reload. Stays in this browser only. All calls fail silently.
const DB = 'tender-package-builder'
const STORE = 'kv'
const KEY = 'project'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const r = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(r?.result)
    tx.onerror = () => reject(tx.error)
  })
}

export const loadProject = () => run('readonly', (s) => s.get(KEY)).catch(() => null)
export const saveProject = (p) => run('readwrite', (s) => s.put(p, KEY)).catch(() => {})
export const clearProject = () => run('readwrite', (s) => s.delete(KEY)).catch(() => {})
