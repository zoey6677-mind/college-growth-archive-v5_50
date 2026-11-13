/* =========================================================
   成长档案 v5 · db.js
   职责：IndexedDB 连接 + 通用 CRUD（Promise 封装）
   ========================================================= */

import { DB_NAME, DB_VERSION, STORES } from './schema.js';

// 已打开的连接（单例）
let _db = null;
// 打开中的 Promise（防止并发重复初始化）
let _openPromise = null;

/**
 * 把单个 IndexedDB request 包装成 Promise（供事务内部使用）。
 * 注意：只能在事务存活期间调用。
 */
export function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB 请求失败'));
  });
}

/**
 * 建库 / 升级：按 schema 创建缺失的 store 与索引。
 * - 已存在的 store 不会重复创建；
 * - 已存在的索引不会重复创建；
 * - 仅在 onupgradeneeded（versionchange 事务）中调用。
 */
function upgrade(db, tx) {
  Object.keys(STORES).forEach((name) => {
    const def = STORES[name];
    let store;
    if (db.objectStoreNames.contains(name)) {
      store = tx.objectStore(name);
    } else {
      store = db.createObjectStore(name, { keyPath: def.keyPath });
    }
    (def.indexes || []).forEach((idx) => {
      if (!store.indexNames.contains(idx.name)) {
        store.createIndex(idx.name, idx.keyPath, { unique: !!idx.unique });
      }
    });
  });
}

/**
 * 打开数据库（幂等：已打开直接复用；打开中返回同一 Promise）。
 */
export function open() {
  if (_db) return Promise.resolve(_db);
  if (_openPromise) return _openPromise;

  _openPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }

    req.onupgradeneeded = (e) => {
      try {
        upgrade(e.target.result, e.target.transaction);
      } catch (err) {
        reject(err);
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      // 其他标签页请求升级时，主动关闭本连接，允许对方升级
      _db.onversionchange = () => {
        try { _db.close(); } catch (_) { /* ignore */ }
        _db = null;
        _openPromise = null;
      };
      resolve(_db);
    };

    req.onerror = (e) => {
      reject(e.target.error || new Error('数据库打开失败'));
    };

    req.onblocked = () => {
      // blocked 表示有旧连接未关闭、升级被阻塞；不视为立即失败，
      // 仅记录日志，等待旧连接关闭后 onsuccess 继续。
      console.warn('[db] 数据库升级被其他连接阻塞，等待其关闭…');
    };
  });

  // 失败后重置，允许下次重试
  _openPromise.catch(() => { _openPromise = null; });
  return _openPromise;
}

/**
 * 关闭连接并重置单例（用于测试清理 / 版本升级）。
 */
export function close() {
  if (_db) {
    try { _db.close(); } catch (_) { /* ignore */ }
    _db = null;
  }
  _openPromise = null;
}

/**
 * 单 store 事务的通用封装。
 * fn(store) 返回一个 request；事务成功提交（oncomplete）后 resolve 其结果。
 * 事务失败 / 中止时 reject。
 */
function _run(storeName, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(storeName, mode);
    } catch (e) {
      reject(e);
      return;
    }
    const store = tx.objectStore(storeName);
    let req;
    try {
      req = fn(store);
    } catch (e) {
      // 同步执行出错，事务对象不再使用
      reject(e);
      return;
    }
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error || new Error('事务失败'));
    tx.onabort = () => reject(tx.error || new Error('事务中止'));
  }));
}

/**
 * 多 store 事务（供迁移等需要跨表原子性的场景）。
 * fn(stores, tx) 可返回普通值或 Promise；事务提交后 resolve 其最终值。
 * 若 fn 抛错或返回的 Promise reject，则 abort 事务并 reject。
 */
export function transaction(storeNames, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    let tx;
    try {
      tx = db.transaction(names, mode);
    } catch (e) {
      reject(e);
      return;
    }
    const stores = {};
    names.forEach((n) => { stores[n] = tx.objectStore(n); });

    let result;
    let settled = false;
    const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
    const fail = (err) => { if (!settled) { settled = true; reject(err); } };

    tx.oncomplete = () => finish(result);
    tx.onerror = () => fail(tx.error || new Error('事务失败'));
    tx.onabort = () => fail(tx.error || new Error('事务中止'));

    try {
      result = fn(stores, tx);
    } catch (e) {
      try { tx.abort(); } catch (_) { /* ignore */ }
      fail(e);
      return;
    }

    if (result && typeof result.then === 'function') {
      result.then(
        (val) => { result = val; },
        (err) => { try { tx.abort(); } catch (_) { /* ignore */ } fail(err); }
      );
    }
  }));
}

// ---------- 便捷 CRUD 方法 ----------

export function get(storeName, key) {
  return _run(storeName, 'readonly', (s) => s.get(key));
}

export function getAll(storeName) {
  return _run(storeName, 'readonly', (s) => s.getAll());
}

// 按单值索引查询，返回全部匹配记录（数组）
export function getByIndex(storeName, indexName, key) {
  return _run(storeName, 'readonly', (s) => s.index(indexName).getAll(key));
}

// 按索引 + 范围查询（range 为 IDBKeyRange 或 IDBValidKey）
export function getByIndexRange(storeName, indexName, range) {
  return _run(storeName, 'readonly', (s) => s.index(indexName).getAll(range));
}

export function count(storeName) {
  return _run(storeName, 'readonly', (s) => s.count());
}

export function countByIndex(storeName, indexName, key) {
  return _run(storeName, 'readonly', (s) => s.index(indexName).count(key));
}

export function add(storeName, value) {
  return _run(storeName, 'readwrite', (s) => s.add(value));
}

export function put(storeName, value) {
  return _run(storeName, 'readwrite', (s) => s.put(value));
}

export function del(storeName, key) {
  return _run(storeName, 'readwrite', (s) => s.delete(key));
}

export function clear(storeName) {
  return _run(storeName, 'readwrite', (s) => s.clear());
}

// ---------- 对外统一出口 ----------

export const db = {
  open,
  close,
  get,
  getAll,
  getByIndex,
  getByIndexRange,
  count,
  countByIndex,
  add,
  put,
  del,
  clear,
  transaction
};

export { DB_NAME, DB_VERSION, STORES };
