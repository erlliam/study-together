import {
  useState
} from 'react';
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
      <h1>study-together</h1>
      <nav>
        <Link to="/create-room">Create a room</Link>
        <Link to="/join-room">Join a room</Link>
      </nav>
    </div>
  );
}

function CreateRoom() {
  let [name, setName] = useState('');
  let [password, setPassword] = useState('');
  let [capacity, setCapacity] = useState('6');

  function handleSubmit(event) {
    event.preventDefault();

    // todo: POST form data to server
    console.log(`
      name: ${name}
      password: ${password}
      capacity: ${capacity}
    `);
  }

  return (
    <div className="create-room">
      <h1>Create a Room</h1>
      <form autoComplete="off" onSubmit={handleSubmit}>
        <label htmlFor="create-room-name">Room name</label>
        <input
          id="create-room-name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
        <label htmlFor="create-room-password">Password (optional)</label>
        <input
          id="create-room-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <label htmlFor="create-room-capacity">Room capacity (16 max)</label>
        <input
          id="create-room-capacity"
          type="number"
          min="1" max="16"
          value={capacity}
          onChange={e => setCapacity(e.target.value)}
          required
        />
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
      {' '}
      <span>{room.name}</span>
      {' '}
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
