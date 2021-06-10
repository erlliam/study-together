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
      let response = await apiGet('/user');
      if (response.status === 200) {
        let json = await response.json();
        localStorage.setItem('id', json.id);
      } else {
        createUser();
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
  let [error, setError] = useState('');
  let [rooms, setRooms] = useState();

  useEffect(() => {
    async function init() {
      let response = await apiGet('/room/all');
      if (response.ok) {
        setRooms(await response.json());
      } else {
        setError(await response.text());
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
  let [error, setError] = useState('');
  let [roomJoined, setRoomJoined] = useState();
  let [passwordRequired, setPasswordRequired] = useState();
  let params = useParams();
  let roomId = params.id;
  let room = useRef();
  let webSocket = useRef();

  useEffect(() => {
    let ws = new WebSocket('ws://localhost:5000');
    ws.addEventListener('open', (event) => {
      webSocket.current = ws;
      init();
    });
    ws.addEventListener('close', (event) => {
      // todo: Figure out when to display such an error.
      // So far 1005 seems like we should ignore it.
      setError('The web socket has been closed.');
      console.log(event);
    });

    async function init() {
      await setRoomData();
      if (room.current !== undefined) {
        if (isRoomOwner() || !room.current.password) {
          joinRoom();
        } else {
          setPasswordRequired(true);
        }
      } else {
        ws.close();
      }
    }

    return (() => {
      ws.close();
    });
    // https://stackoverflow.com/a/55854902
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setRoomData() {
    let response = await apiGet('/room/' + roomId);
    switch (response.status) {
      case 200:
        room.current = await response.json();
        break;
      case 404:
        // todo: Suggest users to visit /rooms
        setError('Room not found.');
        break;
      default:
        setError('Something went wrong.');
    }
  }

  async function joinRoom(password) {
    webSocket.current.addEventListener('message', (event) => {
      switch (parseInt(event.data, 10)) {
        case 200:
          handleRoomJoined();
          break;
        case 400:
          setError('Room full. Try again later.');
          break;
        case 401:
          setError('Incorrect password. Try again.');
          break;
        case 404:
          setError('Room no longer exists.');
          break;
        case 405:
          setError('You are already in this room.');
          break;
        default:
          setError('Something went wrong.');
      }
    }, {once: true});
    webSocket.current.send(JSON.stringify({
      operation: 'joinRoom',
      token: getToken(),
      id: roomId,
      password: password,
    }));
  }

  function isRoomOwner() {
    let userId = parseInt(localStorage.getItem('id'), 10);
    return userId === room.current.ownerId;
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

function Timer(props) {
  let [timeElapsed, setTimeElapsed] = useState(0);
  let [state, setState] = useState();
  let [mode, setMode] = useState();
  let [workLength, setWorkLength] = useState(0);
  let [breakLength, setBreakLength] = useState(0);
  let params = useParams();
  let roomId = params.id;

  useEffect(() => {
    async function init() {
      let response = await apiGet('/timer/' + roomId);
      let json = await response.json();
      // todo: Figure out how to batch these state updates...
      setTimeElapsed(json.timeElapsed);
      setState(json.state);
      setMode(json.mode);
      setBreakLength(json.breakLength);
      setWorkLength(json.workLength);
    }

    init();
  }, [roomId]);

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
  status += (mode === 'w' ? 'Working' : 'Relaxing');
  status += ' - ';
  status += (state === 1 ? 'Running' : 'Paused');

  return (
    <>
      <p className="timer-status">{status}</p>
      <p className="timer-time">
        <span className="timer-time-text">{minutesRemaining}:{secondsRemaining}</span>
      </p>
      {(props.isRoomOwner) && (
        <TimerControls
          timerStates={{state, mode}}
          room={props.room}
          setError={props.setError}
          error={props.error}
        />
      )}
    </>
  );
}

function TimerControls(props) {
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
      setError('Failed to start the timer.');
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
      setError('Failed to stop the timer.');
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
      setError('Failed to enter break mode.');
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
      setError('Failed to enter work mode.');
    }
  }

  async function handleDeleteClick(event) {
    let response = await apiDelete('/room/' + roomId);
    if (response.ok) {
      history.replace('/rooms');
    } else {
      setError('Failed to delete the room.');
    }
  }

  async function handleLengthChanged(event) {
    setLength(event.target.value);
    if (props.error === 'Invalid time length. Only numbers are accepted.') {
      setError('');
    }
  }

  async function handleSetTime(event) {
    event.preventDefault();

    if (length === '' ||
        isNaN(parseInt(length, 10))) {
      setError('Invalid time length. Only numbers are accepted.');
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
      setError('Failed to set timer length.');
    }
  }

  let startStopButton = (props.timerStates.state === 1 ? (
      <button
        className="startStopButton"
        onClick={handleStopTimerClick}
      >
        STOP
      </button>
    ) : (
      <button
        className="startStopButton"
        onClick={handleStartTimerClick}
      >
        START
      </button>
    )
  );

  let workBreakButton = (props.timerStates.mode === 'w' ? (
      <button onClick={handleBreakModeClick}>Break mode</button>
    ) : (
      <button onClick={handleWorkModeClick}>Work mode</button>
    )
  );

  return (
    <nav className="nav-room-controls">
      {startStopButton}
      {workBreakButton}
      <button onClick={handleDeleteClick}>Delete room</button>
      <form
        className="form-set-time"
        onSubmit={handleSetTime}
      >
        <input
          placeholder="Seconds"
          type="number"
          min="1"
          value={length}
          onChange={handleLengthChanged}
        />
        <button>Set time</button>
      </form>
    </nav>
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
    // todo: Let users override auto scrolling.
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
    if (props.error === 'Incorrect password. Try again.') {
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
