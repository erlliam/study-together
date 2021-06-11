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
