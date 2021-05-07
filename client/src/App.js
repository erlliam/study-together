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
  useParams
} from 'react-router-dom';

import {
  apiGet,
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
      if (response.status !== 201) {
        throw Error('Failed to create user.');
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

function ListOfRooms() {
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

  return (
    <div className="join-room">
      <h1>Join a Room</h1>
      <nav>
        <Error>{error}</Error>
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
        if (room.current.password) {
          setPasswordRequired(true);
          setLoading(false);
        } else {
          joinRoom();
        }
      }
    }

    return (() => {
      isMounted.current = false;
      ws.close();
    });
  }, []);

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
    <>
      <Error>{error}</Error>
      {loading && (
        <div>Loading...</div>
      )}
      {passwordRequired && (
        <PasswordPage
          roomName={room.current.name}
          joinRoom={joinRoom}
        />
      )}
      {roomJoined && (
        <div className="room">
          <h1>{room.current.name}</h1>
          <Timer ws={webSocket.current} />
          <SendMessage ws={webSocket.current} />
          <Messages ws={webSocket.current} />
        </div>
      )}
    </>
  );
}

function Timer(props) {
  let [timeStamp, setTimeStamp] = useState();

  useEffect(() => {
    function handleMessage(event) {
      let json = JSON.parse(event.data);
      if (json.operation === 'timeStamp') {
        setTimeStamp(json.timeStamp);
      }
    }
    props.ws.addEventListener('message', handleMessage);
    return (() => {
      props.ws.removeEventListener('message', handleMessage);
    });
  }, []);

  return (
    <p>{timeStamp}</p>
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
    props.ws.addEventListener('message', handleMessage);
    return (() => {
      props.ws.removeEventListener('message', handleMessage);
    });
  }, []);

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
      <h1>Password required - {props.roomName}</h1>
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
