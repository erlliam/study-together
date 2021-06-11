let crypto = require('crypto');

exports.generateToken = () => {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (error, bytes) => {
      if (error) {
        reject(error);
      } else {
        resolve(bytes.toString('hex'));
      }
    });
  });
}
