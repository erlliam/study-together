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

  // useEffect(() => {
  //   let webSocket = new WebSocket('ws://localhost:5000');
  //   webSocket.addEventListener('message', (event) => {
  //     console.log(JSON.parse(event.data));
  //   });
  // }, []);
function App() {
  useEffect(() => {
    async function init() {
      if (!(await userExists())) {
        createUser();
      }
    }

    async function userExists() {
      let response = await fetch(apiUrl + '/user', {
        credentials: 'include'
      });
      switch (response.status) {
        case 200:
          return true;
        case 401:
          return false;
        default:
          throw Error('Unhandled status code');
      }
    }

    async function createUser() {
      let response = await fetch(apiUrl + '/user/create', {
        method: 'POST',
        credentials: 'include'
      });
      if (response.status !== 201) {
        throw Error('Fatal error, failed to create user');
      }
    }

    init();
  }, []);

  return (
    <Router>
      <Switch>
        <Route exact path="/"><StartingPage /></Route>
        <Route path="/create-room"><CreateRoom /></Route>
        <Route path="/rooms"><ListOfRooms /></Route>
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

    let response = await fetch(apiUrl + '/room/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        password: password,
        capacity: capacity
      }),
      credentials: 'include'
    });
    if (isMounted.current) {
      if (response.ok) {
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

function ListOfRooms() {
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
    async function init() {
      let response = await fetch(apiUrl + '/room/all');
      if (isMounted.current) {
        if (response.ok) {
          setRooms(await response.json());
        } else {
          setError(await response.text());
        }
        setLoading(false);
      }
    }
    init();
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
  let isMounted = useRef(true);
  let roomData = useRef();
  let {id} = useParams();
  let [error, setError] = useState('');
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
      await setRoomData();

      if (isMounted.current && roomData.current !== undefined) {
        if (roomData.current.password) {
          setPasswordRequired(true);
          setLoading(false);
        } else {
          joinRoom();
        }
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function setRoomData() {
    let response = await fetch(apiUrl + '/room/' + id);
    if (response.ok) {
      roomData.current = await response.json();
    } else {
      if (isMounted.current) {
        switch (response.status) {
          case 404:
            setError('The room does not exist.');
            setLoading(false);
            break;
          default:
            setError('Something went wrong.');
            setLoading(false);
        }
      }
    }
  }

  async function joinRoom(password) {
    let response = await fetch(apiUrl + '/room/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: id,
        password: password
      }),
      credentials: 'include'
    });
    if (isMounted.current) {
      switch (response.status) {
        case 200:
          setPasswordRequired(false);
          setRoom(roomData.current);
          setError('');
          break;
        case 400:
          setError('The room is full.');
          break;
        case 401:
          setError('Wrong credentials');
          break;
        case 404:
          setError('The room does not exist.');
          break;
        default:
          setError('Something went wrong.');
      }

      setLoading(false);
      return (response.status === 200);
    }
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
        <PasswordScreen joinRoom={joinRoom} />
      )}
      {room && (
        <div className="room">
          <h1>{room.name}</h1>
        </div>
      )}
    </>
  );
}

function PasswordScreen(props) {
  let [password, setPassword] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    props.joinRoom(password);
  }

  return (
    <div className="password-room">
      <h1>Password required</h1>
      <form autoComplete="off" onSubmit={handleSubmit}>
        <label htmlFor="join-room-password">Enter password</label>
        <input
          id="join-room-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button>Join room</button>
      </form>
    </div>
  );
}

export default App;
