import {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  useParams,
  Link
} from 'react-router-dom';

import {
  apiGet,
  getToken,
  Error
} from './utils';

import {Messages} from './Messages';
import {Timer} from './Timer';

function Room() {
  let [error, setError] = useState('');
  let [roomJoined, setRoomJoined] = useState();
  let [passwordRequired, setPasswordRequired] = useState();
  let params = useParams();
  let roomId = params.id;
  let room = useRef();
  let webSocket = useRef();

  useEffect(() => {
    let ws = new WebSocket('ws://192.168.1.163:5000');
    ws.addEventListener('open', (event) => {
      webSocket.current = ws;
      init();
    });
    ws.addEventListener('close', (event) => {
      // todo: Figure out when to display such an error.
      // So far 1005 seems like we should ignore it.
      // setError('The web socket has been closed.');
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
        setError(<span>Room not found. <Link to="/join">Find a room to join.</Link></span>);
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
      <Error error={error} setError={setError} />
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

export {Room};
