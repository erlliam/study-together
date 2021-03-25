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

let apiUrl = 'http://localhost:5000/api'

function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/"><StartingPage /></Route>
        <Route path="/create-room"><CreateRoom /></Route>
        <Route path="/rooms"><JoinRoom /></Route>
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
        <Link to="/rooms">Join a room</Link>
      </nav>
    </div>
  );
}

function CreateRoom() {
  // todo: Don't allow names that only contain spaces
  /* todo: UX
      remove error message when you start typing
      display some state that confirms your request is being processed
      display something in the case of a server error
  */
  let history = useHistory();
  let [name, setName] = useState('');
  let [password, setPassword] = useState('');
  let [capacity, setCapacity] = useState('4');
  let [error, setError] = useState();

  async function handleSubmit(event) {
    event.preventDefault();

    let response = await fetch(apiUrl + '/create-room', {
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
      let json = await response.json();
      history.replace('/room/' + json.id);
    } else {
      setError('Invalid input');
    }
  }

  return (
    <div className="create-room">
      <h1>Create a Room</h1>
      {error && <div className="error">{error}</div>}
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
      let response = await fetch(apiUrl + '/rooms');
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
          rooms.map(({id, password, name, usersConnected, userCapacity}) => (
            <Link to={'/room/' + id} key={id}>
              <span>{password ? 'private' : 'public'}</span>
              {' '}
              <span>{name}</span>
              {' '}
              <span>{usersConnected}/{userCapacity}</span>
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
