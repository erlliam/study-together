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

router.post('/create-room', (req, res) => {
  // todo: Validate incoming data
  // todo: Set up data base
  res.send(req.body);
});
