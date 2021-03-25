let express = require('express');
let sqlite3 = require('sqlite3').verbose();
let bcrypt = require('bcrypt');

let saltRounds = 12;
let port = 5000;
let app = express();
let router = express.Router();
let db = new sqlite3.Database('study-together.db');

// todo: Remove database init from this file
// todo: Think about room owner
// todo: Uniquely identify users, no sign up required

db.run(`
  CREATE TABLE IF NOT EXISTS room (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT,
    usersConnected INTEGER DEFAULT 0,
    userCapacity INTEGER NOT NULL
  );
`);

app.listen(port);
app.use('/api', router);

router.use(express.json());
if (process.env.NODE_ENV !== 'production') {
  router.use((req, res, next) => {
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    next();
  });
}

function validRoomUserInput(room) {
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

function addRoomToDatabase(room) {
  return new Promise((resolve, reject) => {
    let {name, password, capacity} = room;
    if (password === '') {
      password = null;
    } else {
      password = bcrypt.hashSync(password, saltRounds);
    }
    db.run(`
      INSERT INTO room (name, password, userCapacity)
      VALUES (?, ?, ?);
    `, name, password, parseInt(capacity, 10), function(error) {
      if (error) {
        reject(error);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

router.post('/create-room', async (req, res) => {
  let room = req.body;
  if (validRoomUserInput(room)) {
    let id = await addRoomToDatabase(room);
    res.status(201).send({id: id});
  } else {
    res.sendStatus(400);
  }
});

router.get('/room-list', (req, res) => {
  db.all(`
    SELECT * FROM room;
  `, (error, rooms) => {
    if (error) {
      res.sendStatus(500);
    } else {
      rooms = rooms.map((room) => {
        if (room.password !== null) {
          return {...room, password: true};
        } else {
          return {...room, password: false};
        }
      })
      res.send(rooms);
    }
  });
});
