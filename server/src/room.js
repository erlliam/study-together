let {db} = require('./database');

exports.getRoom = (id) => {
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

exports.getRooms = () => {
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

exports.getUsersConnected = (id) => {
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

exports.validRoom = (room) => {
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

exports.roomFull = async (room) => {
  let usersConnected = await exports.getUsersConnected(room.id);
  return usersConnected === room.userCapacity;
}
