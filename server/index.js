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
  // If the server is just starting up, no users are connected.
  // todo: Find a better way to do this?
  db.run('DROP TABLE IF EXISTS roomUser;');
  // db.run('DROP TABLE IF EXISTS roomTimer;');
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
});

let connections = {};
let intervalIds = {};

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

function userInRoom(user, room) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT
        *
      FROM roomUser
      WHERE userId = ? AND roomId = ?
      `, user.id, room.id, (error, roomUser) => {
      if (error) {
        reject(error);
      } else {
        resolve(roomUser !== undefined);
      }
    });
  });
}

function addUserToDatabase() {
  return new Promise(async (resolve, reject) => {
    let token = await generateToken();
    db.run(`
      INSERT INTO user (token)
      VALUES (?);
    `, token, function(error) {
      if (error) {
        reject(error);
      } else {
        resolve({id: this.lastID, token: token});
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
      res.send({id: user.id});
    }
  } catch(error) {
    next(error);
  }
});

router.post('/user/create', async (req, res, next) => {
  try {
    let user = await addUserToDatabase();
    res.cookie('token', user.token, {maxAge: 1000 * 60 * 60 * 24 * 14});
    res.status(201).send({id: user.id});
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

function getUsersConnected(id) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT
        COUNT() AS usersConnected
      FROM roomUser
      WHERE roomId = ?;
    `, id, (error, usersConnected) => {
      if (error) {
        reject(error);
      } else {
        resolve(usersConnected?.usersConnected);
      }
    });
  });
}

function deleteRoom(room) {
  return new Promise((resolve, reject) => {
    for (connection of connections[room.id]) {
      connection.close(1000, 'Room has been deleted');
    }
    db.serialize(() => {
      db.run('DELETE FROM roomUser WHERE roomId = ?', room.id, (error) => {
        if (error) {
          reject(error);
        }
      });
      db.run('DELETE FROM room WHERE id = ?', room.id, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
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
  // note: Should we only delete one entry?
  // It should be impossible to have more than one roomUser
  // per room/user pair
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

async function roomFull(room) {
  let usersConnected = await getUsersConnected(room.id);
  return usersConnected === room.userCapacity;
}

router.get('/room/all', async (req, res, next) => {
  try {
    let rooms = await getRooms();
    // todo: Perhaps use map with an async function
    // and Promise.all
    for (let i = 0; i < rooms.length; i++) {
      let room = rooms[i];
      // todo: Create a function for room with password as bool
      // and usersConnected
      rooms[i] = {
        ...room,
        password: room.password !== null,
        usersConnected: await getUsersConnected(room.id)
      }
    }
    res.send(rooms);
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
      await createTimer({id: id});
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
      // todo: Create a function for room with password as bool
      // and usersConnected
      res.send({
        ...room,
        password: room.password !== null,
        usersConnected: await getUsersConnected(room.id)
      });
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
      await deleteTimer(room);
      await deleteRoom(room);
      res.sendStatus(200);
    }
  } catch(error) {
    next(error);
  }
});

function createTimer(room) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO roomTimer (roomId) VALUES (?);', room.id, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function deleteTimer(room) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM roomTimer WHERE roomId = ?', room.id, async (error) => {
      if (error) {
        reject(error);
      } else {
        await stopTimer(room);
        resolve();
      }
    });
  });
}

function selectColumnFromRoomTimer(column, room) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT ${column}
      FROM roomTimer
      WHERE roomId = ?;
    `, room.id, (error, column) => {
      if (error) {
        reject(error);
      } else {
        resolve(column);
      }
    });
  });
}

async function getTimerState(room) {
  let state = await selectColumnFromRoomTimer('state', room);
  return state?.state;
}

async function getTimerMode(room) {
  let mode = await selectColumnFromRoomTimer('mode', room);
  return mode?.mode;
}

async function getTimeElapsed(room) {
  let timeElapsed = await selectColumnFromRoomTimer('timeElapsed', room);
  return timeElapsed?.timeElapsed;
}

function setTimerState(room, state) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE roomTimer
      SET state = ?
      WHERE roomId = ?;
    `, state, room.id, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function setTimerMode(room, mode) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE roomTimer
      SET mode = ?
      WHERE roomId = ?;
    `, mode, room.id, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function incrementTimer(room) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE roomTimer
      SET timeElapsed = timeElapsed + 1
      WHERE roomId = ?;
    `, room.id, function(error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function zeroTimeElapsed(room) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE roomTimer
      SET timeElapsed = 0
      WHERE roomId = ?;
    `, room.id, function(error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

timerIntervals = {};

async function startTimer(room) {
  await setTimerState(room, 1);
  roomMessage(room, JSON.stringify({
    operation: 'stateUpdate',
    state: 1
  }));
  let interval = setInterval(async () => {
    await incrementTimer(room);
    roomMessage(room, JSON.stringify({
      operation: 'timerUpdate',
      timeElapsed: await getTimeElapsed(room)
    }));
  }, 1000);
  timerIntervals[room.id] = interval;
}

async function stopTimer(room) {
  await setTimerState(room, 0);
  roomMessage(room, JSON.stringify({
    operation: 'stateUpdate',
    state: 0
  }));
  if (timerIntervals[room.id] !== undefined) {
    clearInterval(timerIntervals[room.id]);
    timerIntervals[room.id] = undefined;
  }
}

async function restartTimer(room) {
  await stopTimer(room);
  await zeroTimeElapsed(room);
  roomMessage(room, JSON.stringify({
    operation: 'timerUpdate',
    timeElapsed: 0
  }));
}

async function breakMode(room) {
  await restartTimer(room);
  await setTimerMode(room, 'b');
  roomMessage(room, JSON.stringify({
    operation: 'modeUpdate',
    mode: 'b'
  }));
}

async function workMode(room) {
  await restartTimer(room);
  await setTimerMode(room, 'w');
  roomMessage(room, JSON.stringify({
    operation: 'modeUpdate',
    mode: 'w'
  }));
}

async function getTimer(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM roomTimer WHERE roomId = ?', id, (error, timer) => {
      if (error) {
        reject(error);
      } else {
        resolve(timer);
      }
    });
  });
}


router.get('/timer/:id', async (req, res, next) => {
  try {
    let id = req.params.id;
    let timer = await getTimer(id);
    res.send(timer);
  } catch(error) {
    next(error);
  }
});

router.get('/timer/:id/start', async (req, res, next) => {
  try {
    let id = req.params.id;
    let room = await getRoom(id);
    let user = await getUserFromToken(req.cookies.token);
    if (room.ownerId === user.id) {
      let timerState = await getTimerState(room);
      if (timerState === 1) {
        res.sendStatus(400);
      } else {
        await startTimer(room);
        res.sendStatus(200);
      }
    } else {
      res.sendStatus(401);
    }
  } catch(error) {
    next(error);
  }
});

router.get('/timer/:id/stop', async (req, res, next) => {
  try {
    let id = req.params.id;
    let room = await getRoom(id);
    let user = await getUserFromToken(req.cookies.token);
    if (room.ownerId === user.id) {
      let timerState = await getTimerState(room);
      if (timerState === 0) {
        res.sendStatus(400);
      } else {
        await stopTimer(room);
        res.sendStatus(200);
      }
    } else {
      res.sendStatus(401);
    }
  } catch(error) {
    next(error);
  }
});

router.get('/timer/:id/break', async (req, res, next) => {
  try {
    let id = req.params.id;
    let room = await getRoom(id);
    let user = await getUserFromToken(req.cookies.token);
    if (room.ownerId === user.id) {
      let timerMode = await getTimerMode(room);
      if (timerMode === 'b') {
        res.sendStatus(400);
      } else {
        await breakMode(room);
        res.sendStatus(200);
      }
    } else {
      res.sendStatus(401);
    }
  } catch(error) {
    next(error);
  }
});

router.get('/timer/:id/work', async (req, res, next) => {
  try {
    let id = req.params.id;
    let room = await getRoom(id);
    let user = await getUserFromToken(req.cookies.token);
    if (room.ownerId === user.id) {
      let timerMode = await getTimerMode(room);
      if (timerMode === 'w') {
        res.sendStatus(400);
      } else {
        await workMode(room);
        res.sendStatus(200);
      }
    } else {
      res.sendStatus(401);
    }
  } catch(error) {
    next(error);
  }
});

function updateTimerInterval(room, interval) {
  return new Promise(async (resolve, reject) => {
    let timerMode = await getTimerMode(room);
    let column = timerMode === 'w' ? 'workLength' : 'breakLength';
    db.run(`
      UPDATE roomTimer
      SET ${column} = ?
      WHERE roomId = ?;
    `, interval, room.id, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

router.post('/timer/:id/interval', async (req, res, next) => {
  try {
    let id = req.params.id;
    let room = await getRoom(id);
    let user = await getUserFromToken(req.cookies.token);
    if (room.ownerId === user.id) {
      let interval = req.body?.interval;
      if (interval) {
        // todo: Validate the contents of interval
        // todo: Broadcast active mode's interval has changed!
        updateTimerInterval(room, interval);
        res.sendStatus(200);
      } else {
        res.sendStatus(400);
      }
    } else {
      res.sendStatus(401);
    }
  } catch(error) {
    next(error);
  }
});

function storeConnection(room, ws) {
  let roomId = room.id;
  if (connections[roomId] === undefined) {
    connections[roomId] = [ws];
  } else {
    connections[roomId].push(ws);
  }
}

function removeConnection(room, ws) {
  let roomId = room.id;
  let indexOfWs = connections[roomId].indexOf(ws);
  connections[roomId].splice(indexOfWs, 1);
}

function roomMessage(room, message) {
  for (let connection of connections[room.id]) {
    connection.send(message);
  }
}

async function connectUser(ws, user, room) {
  addUserToRoom(user, room);
  storeConnection(room, ws);
  ws.send(200);
  ws.on('close', async () => {
    removeUserFromRoom(user, room);
    removeConnection(room, ws);
    roomMessage(room, JSON.stringify({
      operation: 'message',
      message: user.id + ' left.'
    }))
  });
  roomMessage(room, JSON.stringify({
    operation: 'message',
    message: user.id + ' joined.'
  }))
}

async function joinRoomOperation(ws, json) {
  let id = json.id;
  let password = json.password;
  let room = await getRoom(id);
  let user = await getUserFromToken(json.token);
  if (room === undefined) {
    ws.send(404);
  } else if (user === undefined) {
    ws.send(401);
  } else if (await roomFull(room)) {
    ws.send(400);
  } else if (await userInRoom(user, room)) {
    ws.send(405);
  } else {
    if (room.ownerId === user.id ||
        room.password === null) {
      await connectUser(ws, user, room);
    } else {
      if (bcrypt.compareSync(password, room.password)) {
        await connectUser(ws, user, room);
      } else {
        ws.send(401);
      }
    }
  }
}

async function userMessageOperation(ws, json) {
  let room = await getRoom(json.id);
  let user = await getUserFromToken(json.token);
  if (room !== undefined && user !== undefined) {
    if (userInRoom(user, room)) {
      roomMessage(room, JSON.stringify({
        operation: 'message',
        message: user.id + ': ' + json.message
      }))
    }
  }
  // todo: Don't allow empty messages...
  // todo: Have some basic restrictions on messages?
  // note: If the user's message doesn't go through, they won't know.
}

function parseJson(json) {
  try {
    return JSON.parse(json);
  } catch(error) {
    return undefined;
  }
}

webSocket.on('connection', (ws) => {
  ws.on('message', async (message) => {
    try {
      let json = JSON.parse(message);
      switch (json.operation) {
        case 'joinRoom':
          joinRoomOperation(ws, json);
          break;
        case 'userMessage':
          userMessageOperation(ws, json);
          break;
        default:
          throw Error('Operation not found');
      }
    } catch(error) {
      console.error(error);
      ws.send(400);
    }
  });
});
