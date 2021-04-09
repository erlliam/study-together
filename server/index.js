let express = require('express');
let cookieParser = require('cookie-parser');
let sqlite3 = require('sqlite3').verbose();
let bcrypt = require('bcrypt');
let crypto = require('crypto');

let saltRounds = 12;
let port = 5000;

let app = express();
let router = express.Router();
app.listen(port);
app.use(cookieParser());
app.use('/api', router);
router.use(express.json());
if (process.env.NODE_ENV !== 'production') {
  router.use((req, res, next) => {
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', 'true');
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

router.get('/', async (req, res) => {
  let {token} = req.cookies;
  try {
    let user = await getUserFromToken(token);
    if (user === undefined) {
      res.sendStatus(401);
    } else {
      res.sendStatus(200);
    }
  } catch(error) {
    console.error(error);
    res.sendStatus(500);
  }
});

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

function addUserToDatabase(token) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO user (token)
      VALUES (?);
    `, token, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

router.post('/create-user', (req, res) => {
  crypto.randomBytes(16, async (error, bytes) => {
    if (error) {
      res.sendStatus(500);
    } else {
      let token = bytes.toString('hex');
      try {
        await addUserToDatabase(token);
        res.cookie('token', token);
        res.sendStatus(201);
      } catch(error) {
        console.error(error);
        res.sendStatus(500);
      }
    }
  });
});

function getRoomFromId(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM room WHERE id = ?', id, (error, room) => {
      if (error) {
        reject(error);
      }
      resolve(room);
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

router.post('/create-room', async (req, res) => {
  try {
    let room = req.body;
    let isValidRoom = validRoom(room);
    let {token} = req.cookies;
    let user = await getUserFromToken(token);
    // todo: respond with unauthorized if user is undefined...
    if (user !== undefined && isValidRoom) {
      let id = await addRoomToDatabase(user.id, room);
      res.status(201).send({id: id});
    } else {
      res.sendStatus(400);
    }
  } catch(error) {
    console.error(error);
    res.sendStatus(500);
  }
});

router.delete('/room/:id', async (req, res) => {
  // todo: start off here
  let user = await getUserFromToken(req.cookies.token);
  let room = await getRoomFromId(req.params.id);
  if (user === undefined || room === undefined) {
    console.log('user or room undefined');
  } else if (room.ownerId === user.id) {
    console.log('room shall be deleteed');
  } else {
    console.log('the user is not the owner, dont dlete room');
  }
  res.sendStatus(500);
});

router.get('/rooms', (req, res) => {
  db.all(`
    SELECT * FROM room;
  `, (error, rooms) => {
    if (error) {
      console.error(error);
      res.sendStatus(500);
    } else {
      rooms = rooms.map(r => roomWithPasswordAsBool(r));
      res.send(rooms);
    }
  });
});

router.get('/room/:id', (req, res) => {
  let {id} = req.params;
  db.get('SELECT * FROM room WHERE id = ?', id, (error, room) => {
    if (error) {
      console.error(error);
      res.sendStatus(500);
    } else {
      if (room !== undefined) {
        res.send(roomWithPasswordAsBool(room));
      } else {
        res.sendStatus(404);
      }
    }
  });
});

router.post('/join-room', (req, res) => {
  let {id = '', password = ''} = req.body;

  function incrementUserCount(room) {
    db.run(`UPDATE room SET usersConnected = ? WHERE id = ?`,
        room.usersConnected + 1, room.id, (error) => {
      if (error) {
        console.error(error);
        res.sendStatus(500);
      } else {
        res.sendStatus(200);
      }
    });
  }

  db.get(`SELECT * FROM room WHERE id = ?`, id, (error, room) => {
    if (error) {
      console.error(error);
      res.sendStatus(500);
    } else {
      if (room === undefined) {
        res.sendStatus(404);
      } else {
        if (room.usersConnected < room.userCapacity) {
          if (room.password === null) {
            incrementUserCount(room);
          } else {
            if (bcrypt.compareSync(password, room.password)) {
              incrementUserCount(room);
            } else {
              res.sendStatus(401);
            }
          }
        } else {
          res.sendStatus(400);
        }
      }
    }
  });
});
