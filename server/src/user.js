let {generateToken} = require('./utils');
let {db} = require('./database');

exports.getUserFromToken = (token) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM user WHERE token = ?', token, (error, user) => {
      if (error) {
        reject(error);
      }
      resolve(user);
    });
  });
}

exports.userInRoom = (user, room) => {
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

exports.addUserToDatabase = () => {
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

exports.setUsername = (user, name) => {
  return new Promise((resolve, reject) => {
    db.run(`
      REPLACE INTO username (userId, name)
      VALUES (?, ?);
    `, user.id, name, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

exports.getUsername = (user) => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT name
      FROM username
      WHERE userId = ?
    `, user.id, (error, name) => {
      if (error) {
        reject(error);
      } else {
        if (name === undefined) {
          resolve(user.id);
        } else {
          resolve(name?.name);
        }
      }
    });
  });
}

exports.usernameExists = (name) => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT name
      FROM username
      WHERE name = ?
    `, name, (error, name) => {
      if (error) {
        reject(error);
      } else {
        resolve(name !== undefined);
      }
    });
  });
}
