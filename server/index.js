let express = require('express');

let port = 5000;
let app = express();
let router = express.Router();

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

let rooms = [];

router.post('/create-room', (req, res) => {
  if (validCreateRoomObject(req.body)) {
    // todo: Set up data base
    rooms.push(req.body);
    res.sendStatus(201);
  } else {
    res.sendStatus(400);
  }
});
