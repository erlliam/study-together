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
  useHistory
} from 'react-router-dom';

import {
  apiGet,
  apiDelete,
  apiPost,
  getToken,
  Error
} from './utils';

import CreateRoom from './CreateRoom';

function App() {
  useEffect(() => {
    async function init() {
      if (!(await userExists())) {
        createUser();
      }
    }

    async function userExists() {
      let response = await apiGet('/user');
      switch (response.status) {
        case 200:
          let json = await response.json();
          localStorage.setItem('id', json.id);
          return true;
        case 401:
          return false;
        default:
          throw Error('Unknown status code.');
      }
    }

    async function createUser() {
      let response = await apiPost('/user/create');
      if (response.status === 201) {
        let json = await response.json();
        localStorage.setItem('id', json.id);
      } else {
        throw Error('Failed to create user.');
      }
    }

    init();
  }, []);

  return (
    <Router>
      <nav className="top-nav">
        <Link to="/">Home</Link>
        <Link to="/create-room">Create a room</Link>
        <Link to="/rooms">Join a room</Link>
      </nav>
      <Switch>
        <Route exact path="/"><StartingPage /></Route>
        <Route path="/create-room"><CreateRoom /></Route>
        <Route path="/rooms"><RoomList /></Route>
        <Route path="/room/:id"><RoomMiddleMan /></Route>
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

function RoomList() {
  let isMounted = useRef(true);
  let [error, setError] = useState('');
  let [loading, setLoading] = useState(true);
  let [rooms, setRooms] = useState();

  useEffect(() => {
    return (() => {
      isMounted.current = false;
    });
  }, []);

  useEffect(() => {
    async function init() {
      let response = await apiGet('/room/all');
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

  let roomsInnerHtml;
  if (!loading && Array.isArray(rooms)) {
    if (rooms.length === 0) {
      // todo: Don't use default link styling for this link...
      // (remove padding and display block)
      roomsInnerHtml = <>
        <p>No rooms found. <Link
          to='/create-room'
        >You should create one.</Link></p>
      </>
    } else {
      roomsInnerHtml = rooms.map(({id, password, name, usersConnected, userCapacity}) => (
        <Link to={'/room/' + id} key={id}>
          <span>{password ? 'private' : 'public'}</span>
          {' '}
          <span>{name}</span>
          {' '}
          <span>{usersConnected}/{userCapacity}</span>
        </Link>
      ))
    }
  }

  return (
    <div className="join-room">
      <h1>Join a Room</h1>
      <nav>
        <Error>{error}</Error>
        {loading && (
          <div>Loading...</div>
        )}
        {roomsInnerHtml}
      </nav>
    </div>
  );
}

function RoomMiddleMan() {
  let isMounted = useRef(true);
  let room = useRef();
  let webSocket = useRef();
  let params = useParams();
  let id = params.id;
  let [error, setError] = useState('');
  let [loading, setLoading] = useState(true);
  let [roomJoined, setRoomJoined] = useState();
  let [passwordRequired, setPasswordRequired] = useState();

  useEffect(() => {
    let ws = new WebSocket('ws://localhost:5000');
    ws.addEventListener('open', (event) => {
      webSocket.current = ws;
      init();
    });
    async function init() {
      await setRoomData();
      if (isMounted.current && room.current !== undefined) {
        if (isRoomOwner() || !room.current.password) {
          joinRoom();
        } else {
          setPasswordRequired(true);
          setLoading(false);
        }
      }
    }

    return (() => {
      isMounted.current = false;
      ws.close();
    });
  }, []);

  function isRoomOwner() {
    let userId = parseInt(localStorage.getItem('id'), 10);
    return userId === room.current.ownerId;
  }

  async function setRoomData() {
    let response = await apiGet('/room/' + id);
    if (isMounted.current) {
      switch (response.status) {
        case 200:
          room.current = await response.json();
          break;
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

  async function joinRoom(password) {
    webSocket.current.addEventListener('message', (event) => {
      if (isMounted.current) {
        switch (parseInt(event.data, 10)) {
          case 200:
            handleRoomJoined();
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
          case 405:
            setError('You are already in this room.');
            break;
          default:
            setError('Something went wrong.');
        }
        setLoading(false);
      }
    }, {once: true});
    webSocket.current.send(JSON.stringify({
      operation: 'joinRoom',
      token: getToken(),
      id: id,
      password: password,
    }));
  }

  function handleRoomJoined() {
    setPasswordRequired(false);
    setRoomJoined(true);
    setError('');
  }

  return (
    <div className="room">
      <h1>{room.current ? room.current.name : ' '}</h1>
      <Error>{error}</Error>
      {loading && (
        <div>Loading...</div>
      )}
      {passwordRequired && (
        <PasswordPage
          joinRoom={joinRoom}
        />
      )}
      {roomJoined && (
        <Room
          setError={setError}
          room={room.current}
          ws={webSocket.current}
          isRoomOwner={isRoomOwner()}
        />
      )}
    </div>
  );
}

function Room(props) {
  let setError = props.setError;
  let history = useHistory();

  async function handleDeleteClick(event) {
    let response = await apiDelete('/room/' + props.room.id);
    if (response.ok) {
      history.replace('/rooms');
    } else {
      setError('failed to delete room');
    }
  }

  async function handleStartTimerClick(event) {
    let response = await apiGet(
      '/timer/' +
      props.room.id +
      '/start');
    if (!response.ok) {
      setError('failed to start timer');
    }
  }

  async function handleStopTimerClick(event) {
    let response = await apiGet(
      '/timer/' +
      props.room.id +
      '/stop');
    if (!response.ok) {
      setError('failed to stop timer');
    }
  }

  return (
    <>
      {props.isRoomOwner && (
        <nav>
          <button onClick={handleDeleteClick}>Delete room</button>
          <button onClick={handleStartTimerClick}>Start timer</button>
          <button onClick={handleStopTimerClick}>Stop timer</button>
        </nav>
      )}
      <Timer ws={props.ws} />
      <SendMessage ws={props.ws} />
      <Messages ws={props.ws} />
    </>
  );
}

function Timer(props) {
  let [timeElapsed, setTimeElapsed] = useState();
  let [state, setState] = useState();

  useEffect(() => {
    function handleMessage(event) {
      let json = JSON.parse(event.data);
      switch (json.operation) {
        case 'timerUpdate':
          setTimeElapsed(json.timeElapsed);
          break;
        case 'stateUpdate':
          setState(json.state);
          break;
        default:
          // nothing
      }
    }
    props.ws.addEventListener('message', handleMessage);
    return (() => {
      props.ws.removeEventListener('message', handleMessage);
    });
  }, [props.ws]);

  return (
    <>
      <p>{timeElapsed}</p>
      <p>{state}</p>
    </>
  );
}

function SendMessage(props) {
  let params = useParams();
  let id = params.id;
  let [message, setMessage] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    props.ws.send(JSON.stringify({
      operation: 'userMessage',
      id: id,
      token: getToken(),
      message: message
    }));
    setMessage('');
  }

  return (
    <form autoComplete="off" onSubmit={handleSubmit}>
      <label htmlFor="chat-message">Send a message</label>
      <input
        id="chat-message"
        value={message}
        onChange={e => setMessage(e.target.value)}
      />
    </form>
  );
}

function Messages(props) {
  let [messages, setMessages] = useState([]);
  let divElement = useRef();

  useEffect(() => {
    function handleMessage(event) {
      let json = JSON.parse(event.data);
      if (json.operation === 'message') {
        setMessages((prevMessages) => {
          return [
            ...prevMessages,
            {
              data: json.message,
              key: event.timeStamp + event.data
            }
          ]
        });
      }
    }
    function handleClose(event) {
      // todo: Normal close is error code 1000
      // make this a switch statement
      setMessages((prevMessages) => {
        return [
          ...prevMessages,
          {
            data: event.reason,
            key: event.timeStamp + event.reason
          }
        ]
      });
    }
    props.ws.addEventListener('message', handleMessage);
    props.ws.addEventListener('close', handleClose);
    return (() => {
      props.ws.removeEventListener('message', handleMessage);
      props.ws.removeEventListener('close', handleClose);
    });
  }, [props.ws]);

  useEffect(() => {
    let d = divElement.current;
    d.scrollTop = d.scrollHeight - d.clientHeight;
  }, [messages]);

  return (
    <div ref={divElement} className="messages">
      {messages.map((message) => (
        <p key={message.key}>{message.data}</p>
      ))}
    </div>
  );
}

function PasswordPage(props) {
  let [password, setPassword] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    props.joinRoom(password);
  }

  return (
    <div className="password-page">
      <h2>Password required</h2>
      <form autoComplete="off" onSubmit={handleSubmit}>
        <label htmlFor="join-room-password">Enter password</label>
        <input
          id="join-room-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          required
        />
        <button>Join room</button>
      </form>
    </div>
  );
}

export default App;
