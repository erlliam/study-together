import {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  useParams,
} from 'react-router-dom';

import {
  apiGet,
  getToken,
  Error
} from './utils';

import {
  PasswordPage,
} from './App';

import Messages from './Messages';
import Timer from './Timer';

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

export default Room;
