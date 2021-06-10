import {
  useState,
  useEffect,
} from 'react';

import {
  useParams,
  useHistory,
} from 'react-router-dom';

import {
  apiGet,
  apiPost,
  apiDelete,
} from './utils';

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

  // todo: Make this feature OPT IN
  let status = '';
  status += (mode === 'w' ? 'Working' : 'Relaxing');
  status += ' - ';
  status += (state === 1 ? 'Running' : 'Paused');

  return (
    <>
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
      history.replace('/join');
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

export {Timer};
