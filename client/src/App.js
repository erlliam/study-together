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
  useLocation
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
      <TopNav />
      <Switch>
        <Route exact path="/"><StartingPage /></Route>
        <Route path="/create-room"><CreateRoom /></Route>
        <Route path="/rooms"><RoomList /></Route>
        <Route path="/room/:id"><Room /></Route>
        <Route path="*"><h1>404</h1></Route>
      </Switch>
    </Router>
  );
}

function TopNav() {
  let location = useLocation();
  if (location.pathname === '/') {
    return null;
  } else {
    return (
      <nav className="top-nav">
        <Link to="/">Home</Link>
        <Link to="/create-room">Create a room</Link>
        <Link to="/rooms">Join a room</Link>
      </nav>
    );
  }
}

function StartingPage() {
  return (
    <div className="starting-page">
      <h1>study-together</h1>
      <p className="about">Study/cowork with others and chat!</p>
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
      }
    }
    init();
  }, []);

  let roomsInnerHtml;
  if (Array.isArray(rooms)) {
    if (rooms.length === 0) {
      roomsInnerHtml = (
        <tr>
          <td id="no-rooms-found" colSpan="4">
            There are no rooms. <
              Link to="/create-room"
            >Create a room.</Link>
          </td>
        </tr>
      );
    } else {
      roomsInnerHtml = rooms.map(({id, password, name, usersConnected, userCapacity}) => {
        function TdLink(props) {
          return (
            <td><Link to={'/room/' + id}>{props.children}</Link></td>
          );
        }
        return (
          <tr key={id}>
            <TdLink>{password ? 'Private' : 'Public'}</TdLink>
            <TdLink>{name}</TdLink>
            <TdLink>{usersConnected}</TdLink>
            <TdLink>{userCapacity}</TdLink>
          </tr>
        );
      });
    }
  }

  return (
    <div className="join-room">
      <h1>Join a Room</h1>
      <Error setError={setError}>{error}</Error>
      <nav>
        <table>
          <thead>
            <tr>
              <th>Public/Private</th>
              <th>Room name</th>
              <th>Users connected</th>
              <th>User capacity</th>
            </tr>
          </thead>
          <tbody>
            {roomsInnerHtml}
          </tbody>
        </table>
      </nav>
    </div>
  );
}

function Room() {
  let isMounted = useRef(true);
  let room = useRef();
  let webSocket = useRef();
  let params = useParams();
  let history = useHistory();
  let id = params.id;
  let [error, setError] = useState('');
  let [roomJoined, setRoomJoined] = useState();
  let [passwordRequired, setPasswordRequired] = useState();

  useEffect(() => {
    let ws = new WebSocket('ws://localhost:5000');
    ws.addEventListener('open', (event) => {
      webSocket.current = ws;
      init();
    });
    ws.addEventListener('close', (event) => {
      // todo: Figure out when to display such an error.
      setError('Connection lost. Please refresh the page.');
    });

    async function init() {
      await setRoomData();
      if (isMounted.current && room.current !== undefined) {
        if (isRoomOwner() || !room.current.password) {
          joinRoom();
        } else {
          setPasswordRequired(true);
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
          break;
        default:
          setError('Something went wrong.');
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
            setError('Wrong password.');
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
      <h1>
        {room.current ? room.current.name : <>&nbsp;</>}
      </h1>
      <Error setError={setError}>{error}</Error>
      {passwordRequired && (
        <PasswordPage
          joinRoom={joinRoom}
          setError={setError}
          error={error}
        />
      )}
      {roomJoined && (
        <>
          <Timer
            ws={webSocket.current}
            room={room.current}
            setError={setError}
            error={error}
            isRoomOwner={isRoomOwner()}
          />
          <Messages ws={webSocket.current} />
        </>
      )}
    </div>
  );
}

function RoomControls(props) {
  let setError = props.setError;
  let history = useHistory();
  let [length, setLength] = useState('');
  let roomId = props.room.id;

  async function handleStartTimerClick(event) {
    let response = await apiPost(
      '/timer/' + roomId, {
        body: JSON.stringify({
          operation: 'start'
        })
      });
    if (!response.ok) {
      setError('failed to start timer');
    }
  }

  async function handleStopTimerClick(event) {
    let response = await apiPost(
      '/timer/' + roomId, {
        body: JSON.stringify({
          operation: 'stop'
        })
      });
    if (!response.ok) {
      setError('failed to stop timer');
    }
  }

  async function handleBreakModeClick(event) {
    let response = await apiPost(
      '/timer/' + roomId, {
        body: JSON.stringify({
          operation: 'break'
        })
      });
    if (!response.ok) {
      setError('failed to enter break mode');
    }
  }

  async function handleWorkModeClick(event) {
    let response = await apiPost(
      '/timer/' + roomId, {
        body: JSON.stringify({
          operation: 'work'
        })
      });
    if (!response.ok) {
      setError('failed to enter work mode');
    }
  }

  async function handleLengthChanged(event) {
    setLength(event.target.value);
    if (props.error === 'Invalid length.') {
      setError('');
    }
  }

  async function handleSetTime(event) {
    event.preventDefault();

    if (length === '' ||
        isNaN(parseInt(length, 10))) {
      setError('Invalid length.');
      return;
    }

    let response = await apiPost(
      '/timer/' + roomId, {
        body: JSON.stringify({
          operation: 'length',
          length: length
        })
      });
    if (!response.ok) {
      setError('failed to set length');
    }
  }

  async function handleDeleteClick(event) {
    let response = await apiDelete('/room/' + roomId);
    if (response.ok) {
      history.replace('/rooms');
    } else {
      setError('failed to delete room');
    }
  }

  let startStopButton = (props.timerStates.state === 1 ? (
    <button
      className="startStopButton"
      onClick={handleStopTimerClick}
    >STOP</button>
  ) : (
    <button
      className="startStopButton"
      onClick={handleStartTimerClick}
    >START</button>
  ));

  let workBreakButton = (props.timerStates.mode === 'w' ? (
    <button onClick={handleBreakModeClick}>Break mode</button>
  ) : (
    <button onClick={handleWorkModeClick}>Work mode</button>
  ));

  return (
    <>
      {props.isRoomOwner && (
        <>
          <nav className="nav-room-controls">
            {startStopButton}
            {workBreakButton}
            <button onClick={handleDeleteClick}>Delete room</button>
            <form
              className="form-set-time"
              onSubmit={handleSetTime}
            >
              <input
                placeholder="Time"
                value={length}
                onChange={handleLengthChanged}
              />
              <button>Set time</button>
            </form>
          </nav>
        </>
      )}
    </>
  );
}

function Timer(props) {
  let [timeElapsed, setTimeElapsed] = useState(0);
  let [state, setState] = useState();
  let [mode, setMode] = useState();
  let [workLength, setWorkLength] = useState(0);
  let [breakLength, setBreakLength] = useState(0);
  let params = useParams();
  let id = params.id;

  useEffect(() => {
    async function init() {
      let response = await apiGet('/timer/' + id);
      let json = await response.json();
      setTimeElapsed(json.timeElapsed);
      setState(json.state);
      setMode(json.mode);
      setBreakLength(json.breakLength);
      setWorkLength(json.workLength);
    }
    init();
  }, []);

  useEffect(() => {
    function handleMessage(event) {
      let json = JSON.parse(event.data);
      switch (json.operation) {
        case 'timerFinished':
          // todo: LICENSE AND ATTRIBUTION stuff
          // https://onlineclock.net/sounds/?sound=Default
          let audio = new Audio('https://onlineclock.net/audio/options/default.mp3');
          audio.play();
          break;
        case 'timerUpdate':
          setTimeElapsed(json.timeElapsed);
          break;
        case 'stateUpdate':
          setState(json.state);
          break;
        case 'modeUpdate':
          setMode(json.mode);
          break;
        case 'workLengthUpdate':
          setWorkLength(json.length);
          break;
        case 'breakLengthUpdate':
          setBreakLength(json.length);
          break
        default:
          // nothing
      }
    }
    props.ws.addEventListener('message', handleMessage);
    return (() => {
      props.ws.removeEventListener('message', handleMessage);
    });
  }, [props.ws]);

  useEffect(() => {
    if (mode === 'w') {
      if (state === 0) {
        document.body.style.backgroundColor = 'rgb(255, 169, 169)';
      } else {
        document.body.style.backgroundColor = 'rgb(255, 100, 100)';
      }
    } else {
      if (state === 0) {
        document.body.style.backgroundColor = 'rgb(169, 169, 255)';
      } else {
        document.body.style.backgroundColor = 'rgb(100, 100, 255)';
      }
    }
    return (() => {
      document.body.style.backgroundColor = '#ffffff';
    });
  }, [mode, state])

  let lengthToUse = (mode ==='w' ? workLength : breakLength)
  let minutesRemaining = Math.floor((lengthToUse - timeElapsed) / 60);
  let secondsRemaining = (lengthToUse - timeElapsed) % 60;
  minutesRemaining = minutesRemaining.toString().padStart(2, '0');
  secondsRemaining = secondsRemaining.toString().padStart(2, '0');

  let status = '';
  if (mode === 'w') {
    status += 'Working';
  } else {
    status += 'Relaxing';
  }
  if (state === 1) {
    status += ' - Running';
  } else {
    status += ' - Paused';
  }

  let timerStates = {state, mode};

  return (
    <>
      <p className="timer-status">{status}</p>
      <p className="timer-time">
        <span className="timer-time-text">{minutesRemaining}:{secondsRemaining}</span>
      </p>
      <RoomControls
        timerStates={timerStates}
        room={props.room}
        setError={props.setError}
        error={props.error}
        isRoomOwner={props.isRoomOwner}
      />
    </>
  );
}

function Messages(props) {
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState('');
  let divElement = useRef();
  let params = useParams();
  let id = params.id;

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

  function handleSubmitMessage(event) {
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
    <>
      <div ref={divElement} className="messages">
        {messages.map((message) => (
          <p key={message.key}>{message.data}</p>
        ))}
      </div>
      <form
        className="form-send-message"
        autoComplete="off"
        onSubmit={handleSubmitMessage}
      >
        <input
          placeholder="Message"
          id="chat-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <button>Send message</button>
      </form>
    </>
  );
}

function PasswordPage(props) {
  let [password, setPassword] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    props.joinRoom(password);
  }

  function handleChange(event) {
    setPassword(event.target.value);
    if (props.error === 'Wrong password.') {
      props.setError('');
    }
  }

  return (
    <div className="password-page">
      <form autoComplete="off" onSubmit={handleSubmit}>
        <label htmlFor="join-room-password">Enter password</label>
        <input
          id="join-room-password"
          type="password"
          value={password}
          onChange={handleChange}
          autoFocus
          required
        />
        <button>Join room</button>
      </form>
    </div>
  );
}

export default App;
