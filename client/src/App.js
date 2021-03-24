import {
  useState,
  useEffect,
} from 'react';

import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useParams,
  useHistory,
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
  let history = useHistory();
  let [name, setName] = useState('');
  let [password, setPassword] = useState('');
  let [capacity, setCapacity] = useState('6');
  let [error, setError] = useState();

  async function handleSubmit(event) {
    event.preventDefault();

    let response = await fetch('http://localhost:5000/api/create-room', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        password: password,
        capacity: capacity
      }),
    });
    if (response.ok) {
      let roomId = await response.text();
      history.replace('/room/' + roomId);
    } else {
      // todo: Start thinking about notifying the user about
      // incorrect fields or errors that have occurred
      // todo: Have two states for invalid user input
      // and server error
      setError('Invalid input');
    }
  }

  return (
    <div className="create-room">
      <h1>Create a Room</h1>
      {/*
        todo: Style the error
        todo: Don't allow user to submit name with only spaces
      */}
      {error && <div>{error}</div>}
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
  let [rooms, setRooms] = useState();

  useEffect(() => {
    let isMounted = true;
    async function fetchRooms() {
      let response = await fetch('http://localhost:5000/api/room-list');
      let json = await response.json();
      if (isMounted) {
        setRooms(json);
      }
    }
    fetchRooms();
    return (() => {
      isMounted = false;
    });
  }, []);

  return (
    <div className="join-room">
      <h1>Join a Room</h1>
      <nav>
        {rooms ? (
          rooms.map(room => (
            <Link to={'/room/' + room.id} key={room.id}>
              <span>{room.passwordProtected ? 'private' : 'public'}</span>
              {' '}
              <span>{room.name}</span>
              {' '}
              <span>{room.usersConnected}/{room.userCapacity}</span>
            </Link>
          ))
        ) : (
          <div>Loading...</div>
        )}
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
