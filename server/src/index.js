let express = require('express');
let cookieParser = require('cookie-parser');
let sqlite3 = require('sqlite3').verbose();
let bcrypt = require('bcrypt');
let crypto = require('crypto');
let ws = require('ws');
let database = require('./database');

let saltRounds = 12;
let port = 5000;

let router = express.Router();
router.use(express.json());
if (process.env.NODE_ENV !== 'production') {
  router.use((req, res, next) => {
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Origin', 'http://192.168.1.163:3000');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'POST, PUT, GET, DELETE');
    next();
  });
}

let app = express();
app.use(cookieParser());
app.use('/api', router);

let server = app.listen(port);

let webSocket = new ws.Server({server: server});

let db = database.db;

let connections = {};
let timerIntervals = {};

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
      connection.close(1000, 'The room has been deleted.');
    }
    db.serialize(() => {
      db.run('DELETE FROM roomTimer WHERE roomId = ?', room.id, async (error) => {
        if (error) {
          reject(error);
        } else {
          await stopTimer(room);
        }
      });
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
    let roomsToSend = Promise.all(rooms.map(async (room) => {
      return {
        ...room,
        password: room.password !== null,
        usersConnected: await getUsersConnected(room.id)
      };
    }));
    res.send(await roomsToSend);
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

// todo: Implement room updating
router.put('/room/:id', (req, res) => {
});

router.get('/room/:id', async (req, res, next) => {
  try {
    let room = await getRoom(req.params.id);
    if (room === undefined) {
      res.sendStatus(404);
    } else {
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
      await deleteRoom(room);
      res.sendStatus(200);
    }
  } catch(error) {
    next(error);
  }
});

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

function updateOneColumnFromRoomTimer(column, value, room) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE roomTimer
      SET ${column} = ?
      WHERE roomId = ?;
    `, value, room.id, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function getTimerState(room) {
  let column = await selectColumnFromRoomTimer('state', room);
  return column?.state;
}

async function getTimerMode(room) {
  let column = await selectColumnFromRoomTimer('mode', room);
  return column?.mode;
}

async function getTimeElapsed(room) {
  let column = await selectColumnFromRoomTimer('timeElapsed', room);
  return column?.timeElapsed;
}

async function getWorkTimeInterval(room) {
  let column = await selectColumnFromRoomTimer('workLength', room);
  return column?.workLength;
}

async function getBreakTimeInterval(room) {
  let column = await selectColumnFromRoomTimer('breakLength', room);
  return column?.breakLength;
}

async function setTimerState(room, state) {
  return updateOneColumnFromRoomTimer('state', state, room);
}

async function setTimerMode(room, mode) {
  return updateOneColumnFromRoomTimer('mode', mode, room);
}

async function zeroTimeElapsed(room) {
  return updateOneColumnFromRoomTimer('timeElapsed', 0, room);
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

function validTimerLength(length) {
  let result = parseInt(length, 10);
  if (!isNaN(result) && result > 0) {
    return true;
  } else {
    return false;
  }
}

async function startTimer(room) {
  let mode = await getTimerMode(room);
  let modeTimeInterval = (
    mode === 'w'
    ? await getWorkTimeInterval(room)
    : await getBreakTimeInterval(room)
  );

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

    let timeElapsed = await getTimeElapsed(room);
    if (timeElapsed >= modeTimeInterval) {
      roomMessage(room, JSON.stringify({
        operation: 'timerFinished'
      }));
      if (mode === 'w') {
        await breakMode(room);
      } else {
        await workMode(room);
      }
    }
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

async function updateTimerLength(room, length) {
  await restartTimer(room);
  let timerMode = await getTimerMode(room);
  let column = timerMode === 'w' ? 'workLength' : 'breakLength';
  await updateOneColumnFromRoomTimer(column, length, room);
  roomMessage(room, JSON.stringify({
    operation: column + 'Update',
    length:  length
  }));
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

router.post('/timer/:id', async (req, res, next) => {
  try {
    let id = req.params.id;
    let room = await getRoom(id);
    let user = await getUserFromToken(req.cookies.token);
    let body = req.body;
    switch (body?.operation) {
      case 'start':
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
        break;
      case 'stop':
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
        break;
      case 'break':
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
        break;
      case 'work':
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
        break;
      case 'length':
        if (room.ownerId === user.id) {
          let length = req.body?.length;
          if (validTimerLength(length)) {
            await updateTimerLength(room, parseInt(length, 10));
            res.sendStatus(200);
          } else {
            res.sendStatus(400);
          }
        } else {
          res.sendStatus(401);
        }
        break;
      default:
        // respond with 400 or some shit.
        res.sendStatus(400);
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
  // todo: fix bug that occurs when server restarts
  // and user tries to start/stop the timer
  // TypeError: connections[room.id] is not iterable
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
    // todo: Uncomment code when in production
    // if (connections[room.id].length === 0) {
    //   deleteRoom(room);
    // }
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

function validUserMessage(message) {
  if (message === undefined ||
      message.trim() === '') {
    return false;
  } else {
    return true;
  }
}

async function userMessageOperation(ws, json) {
  let room = await getRoom(json.id);
  let user = await getUserFromToken(json.token);
  if (room !== undefined &&
      user !== undefined &&
      validUserMessage(json?.message)) {
    if (userInRoom(user, room)) {
      roomMessage(room, JSON.stringify({
        operation: 'message',
        message: user.id + ': ' + json.message
      }));
    }
  } else {
    ws.send(JSON.stringify({
      operation: 'message',
      message: 'Message not sent'
    }));
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
