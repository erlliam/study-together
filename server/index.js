let express = require('express');

let port = 5000;
let app = express();
let router = express.Router();

app.listen(port);
app.use('/api', router);

router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  next();
});

router.get('/create-room', (req, res) => {
  res.send('Hey');
});
