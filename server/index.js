let express = require('express');

let port = 5000;
let app = express();
let router = express.Router();

// todo: Use an actual database
let roomIndex = 0;
let rooms = [];

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
  let capacityAsInt = parseInt(capacity, 10);
  if (isNaN(capacityAsInt) ||
      1 > capacityAsInt || capacityAsInt > 16) {
    return false
  }
  return true;
}

function createRoom(room) {
  // todo: Think about location
  // Are we fine with a number?? Perhaps we do fancy paste bin URLs or something
  // todo: Think about password storage in database!
  // todo: Think about room owner
  roomIndex++;
  return {
    location: roomIndex.toString(),
    name: room.name,
    passwordProtected: room.password.length > 0,
    usersConnected: 0,
    userCapacity: parseInt(room.capacity, 10)
  }
}

router.post('/create-room', (req, res) => {
  if (validCreateRoomObject(req.body)) {
    rooms.push(createRoom(req.body));
    res.sendStatus(201);
  } else {
    res.sendStatus(400);
  }
});

router.get('/room-list', (req, res) => {
  res.send(rooms);
});
