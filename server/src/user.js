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
