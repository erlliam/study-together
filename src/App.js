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
  let rooms = [
    {
      location: '123',
      name: 'User 1231\'s room',
      passwordProtected: false,
      usersConnected: 1,
      userCapacity: 16,
    },
    {
      location: 'sh1',
      name: 'Join for fast studies',
      passwordProtected: true,
      usersConnected: 12,
      userCapacity: 16,
    },
  ];
  let roomElements = rooms.map((room) =>
    <Link to={'/room/' + room.location} key={room.location}>
      <span>{room.passwordProtected ? 'private' : 'public'}</span>
      <span>{room.name}</span>
      <span>{room.usersConnected}/{room.userCapacity}</span>
    </Link>
  );
  return (
    <div className="join-room">
      <h1>Join a Room</h1>
      <nav>
        {roomElements}
      </nav>
    </div>
  );
}

function Room() {
  let params = useParams();
  return (
    <div className="room">
      <h1>Room {params.id}</h1>
    </div>
  );
}

export default App;
