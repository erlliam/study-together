let express = require('express');
let sqlite3 = require('sqlite3').verbose();
let bcrypt = require('bcrypt');

let saltRounds = 12;
let port = 5000;
let app = express();
let router = express.Router();
let db = new sqlite3.Database('study-together.db');

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
  // todo: Deal with bcrypt's upper character limit
  return new Promise((resolve, reject) => {
    let passwordValue = null;
    if (room.password.length > 0) {
      passwordValue = bcrypt.hashSync(room.password, saltRounds);
    }
    db.run(`
      INSERT INTO room (name, password, userCapacity)
      VALUES (?, ?, ?);
    `, room.name, passwordValue, parseInt(room.capacity, 10), function(error) {
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
    // todo: use pretty API responses, JSON maybe?
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
    // todo: determine what to do on error
    rooms = rooms.map((room) => {
      if (room.password !== null) {
        return {...room, password: true};
      } else {
        return {...room, password: false};
      }
    })
    res.send(rooms);
  });
});
