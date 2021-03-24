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
  let [name, setName] = useState('todo: Make this string empty');
  let [password, setPassword] = useState('');
  let [capacity, setCapacity] = useState('6');

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
    // todo: Start thinking about notifying the user about
    // incorrect fields or errors that have occurred
    // everything is fine: 201
    // bad input: 400
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
  let [rooms, setRooms] = useState();

  useEffect(() => {
    async function fetchRooms() {
      let response = await fetch('http://localhost:5000/api/room-list');
      let json = await response.json();
      setRooms(json);
    }
    fetchRooms();
    // there should be an easy "isMounted" function or some shit
    // todo: Can't perform a React state update on an unmounted component
    // return cleanup function to useEffect that sets a variable.
    // if that variable is true, do not set data...
    // https://stackoverflow.com/questions/53949393/cant-perform-a-react-state-update-on-an-unmounted-component
  }, []);

  return (
    <div className="join-room">
      <h1>Join a Room</h1>
      {rooms ? (
        <nav>
          {rooms.map(room => (
            <Link to ={'/room/' + room.location} key={room.location}>
              <span>{room.passwordProtected ? 'private' : 'public'}</span>
              {' '}
              <span>{room.name}</span>
              {' '}
              <span>{room.usersConnected}/{room.userCapacity}</span>
            </Link>
          ))}
        </nav>
      ) : (
        <div>Loading...</div>
      )}
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
