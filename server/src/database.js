let sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('study-together.db');
exports.db = db;

db.serialize(() => {
  clearTables();
  createTables();
});

function clearTables() {
  // db.run('DROP TABLE IF EXISTS user;');
  // db.run('DROP TABLE IF EXISTS room;');
  // db.run('DROP TABLE IF EXISTS roomTimer;');
  db.run('DROP TABLE IF EXISTS roomUser;');
  db.run('PRAGMA foreign_keys = ON;');
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY,
      token TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS room (
      id INTEGER PRIMARY KEY,
      ownerId INTEGER NOT NULL,
      name TEXT NOT NULL,
      password TEXT,
      userCapacity INTEGER NOT NULL,
      FOREIGN KEY(ownerId) REFERENCES user(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS roomUser (
      id INTEGER PRIMARY KEY,
      userId INTEGER NOT NULL,
      roomId INTEGER NOT NULL,
      FOREIGN KEY(userId) REFERENCES user(id),
      FOREIGN KEY(roomId) REFERENCES room(id)
    );
  `);

  /*
  roomTimer
    state:
      0 off
      1 on
    mode:
      b for break
      w for work
    workLength, breakLength:
      interval in seconds
      1500seconds = 25minutes
    timeElapsed:
      time in seconds
  */
  db.run(`
    CREATE TABLE IF NOT EXISTS roomTimer (
      id INTEGER PRIMARY KEY,
      state INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT "w",
      timeElapsed INTEGER NOT NULL DEFAULT 0,
      workLength INTEGER NOT NULL DEFAULT 1500,
      breakLength INTEGER NOT NULL DEFAULT 300,
      roomId INTEGER NOT NULL UNIQUE,
      FOREIGN KEY(roomId) REFERENCES room(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS username (
      id INTEGER PRIMARY KEY,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL UNIQUE,
      FOREIGN KEY(userId) REFERENCES user(id)
    );
  `);
}
