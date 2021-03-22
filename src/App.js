import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from 'react-router-dom';

function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/"><StartingPage /></Route>
        <Route path="/create-room"><CreateRoom /></Route>
        <Route path="/join-room"><JoinRoom /></Route>
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
        <label>Room name</label>
        <input />
        <label>Password (optional)</label>
        <input />
        <label>Room size</label>
        <input />
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
        <div>
          <div>User 1231's room</div>
          <div>01/16</div>
        </div>
        <div>
          <div>Join for fast studies</div>
          <div>16/16</div>
        </div>
      </nav>
    </div>
  );
}

export default App;
