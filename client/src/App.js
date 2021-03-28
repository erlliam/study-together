import {
  useState,
  useEffect,
  useRef,
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
  let isMounted = useRef(true);
  let history = useHistory();
  let [name, setName] = useState('');
  let [password, setPassword] = useState('');
  let [capacity, setCapacity] = useState('4');
  let [error, setError] = useState();

  useEffect(() => {
    return (() => {
      isMounted.current = false;
    });
  }, []);

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
    if (isMounted.current) {
      if (response.ok) {
        // todo: There will be a ghost room now...
        // that's probably the server's job to clean it up
        let json = await response.json();
        history.replace('/room/' + json.id);
      } else {
        setError('Invalid input');
      }
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
  let isMounted = useRef(true);
  let [error, setError] = useState(false);
  let [loading, setLoading] = useState(true);
  let [rooms, setRooms] = useState();

  useEffect(() => {
    return (() => {
      isMounted.current = false;
    });
  }, []);

  useEffect(() => {
    async function fetchRooms() {
      let response = await fetch(apiUrl + '/rooms');
      if (response.ok) {
        let json = await response.json();
        if (isMounted.current) {
          setRooms(json);
          setLoading(false);
        }
      } else {
        let text = await response.text();
        if (isMounted.current) {
          setError(text);
          setLoading(false);
        }
      }
    }
    fetchRooms();
  }, []);

  return (
    <div className="join-room">
      <h1>Join a Room</h1>
      <nav>
        {error && (
          <div className="error">{error}</div>
        )}
        {loading && (
          <div>Loading...</div>
        )}
        {rooms && (
          rooms.map(({id, password, name, usersConnected, userCapacity}) => (
            <Link to={'/room/' + id} key={id}>
              <span>{password ? 'private' : 'public'}</span>
              {' '}
              <span>{name}</span>
              {' '}
              <span>{usersConnected}/{userCapacity}</span>
            </Link>
          ))
        )}
      </nav>
    </div>
  );
}

function Room() {
  /*
    todo:
      Show room full status     code: 400
      Show wrong password       code: 401
      Show room not found       code: 404
      Show room joined          code: 200
  */
  /*
    steps:
      Fetch room from id in URL
      If room doesn't exist, tell user
      Check if room has a password
      If room doesn't have a password and it's not full, connect to room
      If room has a password, let user input password, proceed as above
  */
  let isMounted = useRef(true);
  let {id} = useParams();
  let [error, setError] = useState(false);
  let [loading, setLoading] = useState(true);
  let [room, setRoom] = useState();
  let [passwordRequired, setPasswordRequired] = useState();

  useEffect(() => {
    return (() => {
      isMounted.current = false;
    });
  }, []);

  useEffect(() => {
    async function init() {
      let roomResponse = await fetch(apiUrl + '/room/' + id);
      if (roomResponse.ok) {
        let room = await roomResponse.json();
        if (room.password) {
          if (isMounted.current) {
            setPasswordRequired(true);
            setLoading(false);
          }
        } else {
          let joinRoomResponse = await fetch(apiUrl + '/join-room', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: id
            }),
          });
          if (joinRoomResponse.ok) {
            if (isMounted.current) {
              setRoom(room);
              setLoading(false);
            }
          } else {
            // Something went wrong when joining the room
          }
        }
      } else {
        let text = await roomResponse.text();
        if (isMounted.current) {
          setError(text);
          setLoading(false);
        }
      }
    }
    init();
  }, []);

  async function handleSubmit() {
  }

  return (
    <>
      {error && (
        <div className="error">{error}</div>
      )}
      {loading && (
        <div>Loading...</div>
      )}
      {passwordRequired && (
        <form autoComplete="off" onSubmit={handleSubmit}>
          <input />
        </form>
      )}
      {room && (
        <div className="room">
          <h1>{room.name}</h1>
        </div>
      )}
    </>
  );
}

export default App;
