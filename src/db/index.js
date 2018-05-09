// TODO: persistence data store
const db = {};

function getDb(name) {
  if (db[name] == null) {
    db[name] = {};
  }
  return db[name];
}

export function put(dbName, key, value) {
  const db = getDb(dbName);
  if (db) {
    db[key] = value;
  }
}

export function get(dbName, key) {
  const db = getDb(dbName);
  return db[key];
}

export function del(dbName, key) {
  const db = getDb(dbName);
  delete db[key];
}
