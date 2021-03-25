let express = require('express');
let sqlite3 = require('sqlite3').verbose();
let bcrypt = require('bcrypt');

let saltRounds = 12;
let port = 5000;
let app = express();
let router = express.Router();
let db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`
    CREATE TABLE room (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT,
      usersConnected INTEGER DEFAULT 0,
      userCapacity INTEGER NOT NULL
    );
  `);

  db.run(`
    INSERT INTO room (name, password, userCapacity)
    VALUES (?, ?, ?);
  `, 'User 1241\'s room', null, 6);
});

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

function validCreateRoomObject(room) {
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

function createRoom(room) {
  return new Promise((resolve, reject) => {
    // todo: Deal with bcrypt's upper character limit
    // todo: Think about room owner
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

router.post('/create-room', (req, res) => {
  if (validCreateRoomObject(req.body)) {
    // todo: use pretty API responses, JSON maybe?
    createRoom(req.body).then(id => res.status(201).send(id.toString()));
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
