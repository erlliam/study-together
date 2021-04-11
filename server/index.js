let express = require('express');
let cookieParser = require('cookie-parser');
let sqlite3 = require('sqlite3').verbose();
let bcrypt = require('bcrypt');
let crypto = require('crypto');
let ws = require('ws');

let saltRounds = 12;
let port = 5000;

let app = express();
let router = express.Router();
let server = app.listen(port);
let webSocket = new ws.Server({server: server});
app.use(cookieParser());
app.use('/api', router);
router.use(express.json());
if (process.env.NODE_ENV !== 'production') {
  router.use((req, res, next) => {
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'POST, PUT, GET, DELETE');
    next();
  });
}

let db = new sqlite3.Database('study-together.db');
db.serialize(() => {
  // db.run('DROP TABLE IF EXISTS user;');
  // db.run('DROP TABLE IF EXISTS room;');
  // db.run('DROP TABLE IF EXISTS roomUser;');
  // Activate foreign_keys after all data is wiped.
  db.run(`PRAGMA foreign_keys = ON;`);
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
      usersConnected INTEGER DEFAULT 0,
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
});

function generateToken() {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (error, bytes) => {
      if (error) {
        reject(error);
      } else {
        resolve(bytes.toString('hex'));
      }
    });
  });
}

function getUserFromToken(token) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM user WHERE token = ?', token, (error, user) => {
      if (error) {
        reject(error);
      }
      resolve(user);
    });
  });
}

function addUserToDatabase() {
  return new Promise(async (resolve, reject) => {
    let token = await generateToken();
    db.run(`
      INSERT INTO user (token)
      VALUES (?);
    `, token, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });
  });
}

router.get('/user', async (req, res, next) => {
  try {
    let user = await getUserFromToken(req.cookies.token);
    if (user === undefined) {
      res.sendStatus(401);
    } else {
      res.sendStatus(200);
    }
  } catch(error) {
    next(error);
  }
});

router.post('/user/create', async (req, res, next) => {
  try {
    let token = await addUserToDatabase();
    res.cookie('token', token);
    res.sendStatus(201);
  } catch(error) {
    next(error);
  }
});

function getRoom(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM room WHERE id = ?', id, (error, room) => {
      if (error) {
        reject(error);
      } else {
        resolve(room);
      }
    });
  });
}

function getRooms() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM room;', (error, rooms) => {
      if (error) {
        reject(error);
      } else {
        resolve(rooms);
      }
    });
  });
}

function deleteRoom(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM room WHERE id = ?', id, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function validRoom(room) {
  // todo: Throw exceptions, pass it to client (so they know which field is wrong)
  // todo: Deal with bcrypt's upper character limit "72", probably restrict passwords?
  let {name, password, capacity} = room;
  if (typeof name !== 'string' ||
      typeof password !== 'string' ||
      typeof capacity !== 'string') {
    return false;
  }
  if (name.trim().length === 0) {
    return false;
  }
  let capacityAsInt = parseInt(capacity, 10);
  if (isNaN(capacityAsInt) ||
      1 > capacityAsInt || capacityAsInt > 16) {
    return false;
  }
  return true;
}

function addRoomToDatabase(ownerId, room) {
  return new Promise((resolve, reject) => {
    let {name, password, capacity} = room;
    if (password === '') {
      password = null;
    } else {
      password = bcrypt.hashSync(password, saltRounds);
    }
    db.run(`
      INSERT INTO room (ownerId, name, password, userCapacity)
      VALUES (?, ?, ?, ?);
    `, ownerId, name, password, parseInt(capacity, 10), function(error) {
      if (error) {
        reject(error);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

function roomWithPasswordAsBool(room) {
  return {...room, password: room.password !== null};
}

function incrementUserCount(room) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE room SET usersConnected = ? WHERE id = ?',
        room.usersConnected + 1, room.id, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve();
      }
    });
  });
}

function decrementUserCount(room) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE room SET usersConnected = ? WHERE id = ?',
        room.usersConnected - 1, room.id, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve();
      }
    });
  });
}

function addUserToRoom(user, room) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO roomUser (userId, roomId)
      VALUES (?, ?);
    `, user.id, room.id, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function removeUserFromRoom(user, room) {
  return new Promise((resolve, reject) => {
    db.run(`
      DELETE FROM roomUser
      WHERE userId = ? AND roomId = ?;
    `, user.id, room.id, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function roomFull(room) {
  return room.usersConnected === room.userCapacity;
}

router.get('/room/all', async (req, res, next) => {
  try {
    let rooms = await getRooms();
    res.send(rooms.map(roomWithPasswordAsBool));
  } catch(error) {
    next(error);
  }
});

router.post('/room/create', async (req, res, next) => {
  try {
    let room = req.body;
    let user = await getUserFromToken(req.cookies.token);
    if (user === undefined) {
      res.sendStatus(401);
    } else if (validRoom(room)) {
      let id = await addRoomToDatabase(user.id, room);
      res.status(201).send({id: id});
    } else {
      res.sendStatus(400);
    }
  } catch(error) {
    next(error)
  }
});

// Update
router.put('/room/:id', (req, res) => {
});

router.get('/room/:id', async (req, res, next) => {
  try {
    let room = await getRoom(req.params.id);
    if (room === undefined) {
      res.sendStatus(404);
    } else {
      res.send(roomWithPasswordAsBool(room));
    }
  } catch(error) {
    next(error)
  }
});

router.delete('/room/:id', async (req, res, next) => {
  try {
    let id = req.params.id;
    let user = await getUserFromToken(req.cookies.token);
    let room = await getRoom(id);
    if (user === undefined || user.id !== room.ownerId) {
      res.sendStatus(401);
    } else if (room === undefined){
      res.sendStatus(404);
    } else {
      await deleteRoom(id);
      res.sendStatus(200);
    }
  } catch(error) {
    next(error);
  }
});

webSocket.on('connection', (ws) => {
  async function connectUser(user, room) {
    await addUserToRoom(user, room);
    await incrementUserCount(room);
    ws.on('close', async () => {
      await removeUserFromRoom(user, room);
      await decrementUserCount(room);
    });
    ws.send(200);
  }

  ws.on('message', async (message) => {
    // todo: wrap json in try catch...
    let json = JSON.parse(message);
    if (json.operation === 'joinRoom') {
      try {
        let id = json.id;
        let password = json.password;
        let room = await getRoom(id);
        let user = await getUserFromToken(json.token);
        if (room === undefined) {
          ws.send(404);
        } else if (user === undefined) {
          ws.send(401);
        } else if (roomFull(room)) {
          ws.send(400);
        } else {
          if (room.password === null) {
            await connectUser(user, room);
          } else {
            if (bcrypt.compareSync(password, room.password)) {
              await connectUser(user, room);
            } else {
              ws.send(401);
            }
          }
        }
      } catch(error) {
        console.error(error);
        ws.send(500);
      }
    }
  });
});
