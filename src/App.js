import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useParams,
} from 'react-router-dom';

function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/"><StartingPage /></Route>
        <Route path="/create-room"><CreateRoom /></Route>
        <Route path="/join-room"><JoinRoom /></Route>
        <Route path="/room/:id"><Room /></Route>
        <Route path="*"><h1>404</h1></Route>
      </Switch>
    </Router>
  );
}

function StartingPage() {
  return (
    <div className="starting-page">
      <h1>Study Together</h1>
      <nav>
        <Link to="/create-room">Create a room</Link>
        <Link to="/join-room">Join a room</Link>
      </nav>
    </div>
  );
}

function CreateRoom() {
  return (
    <div className="create-room">
      <h1>Create a Room</h1>
      <form>
        <div>
          <label>Room name</label>
          <input />
        </div>
        <div>
          <label>Password (optional)</label>
          <input />
        </div>
        <div>
          <label>Room size</label>
          <input />
        </div>
        <button>Create room</button>
      </form>
    </div>
  );
}

function JoinRoom() {
  return (
    <div className="join-room">
      <h1>Join a Room</h1>
      <nav>
        <Link to="/room/123">User 1231's room 01/16</Link>
        <Link to="/room/sh1">Join for fast studies 16/16</Link>
      </nav>
    </div>
  );
}

function Room() {
  let params = useParams();
  console.log(params);
  return (
    <div className="room">
      <h1>Room {params.id}</h1>
    </div>
  );
}

export default App;
