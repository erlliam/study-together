import {
  useState,
  useRef,
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
  let [volume, setVolume] = useState(100);
  // todo: LICENSE AND ATTRIBUTION stuff
  // https://onlineclock.net/sounds/?sound=Default
  let [sound, setSound] = useState('https://onlineclock.net/audio/options/default.mp3');
  let params = useParams();
  let roomId = params.id;
  let audioElement = useRef();

  useEffect(() => {
    let audio = new Audio(sound);
    audio.volume = volume / 100;
    audioElement.current = audio;
    return (() => {
      audio.remove();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      let response = await apiGet('/timer/' + roomId);
      // todo: Make sure the response is valid
      let json = await response.json();
      // todo: Figure out how to batch these state updates...
      setTimeElapsed(json.timeElapsed);
      setState(json.state);
      setMode(json.mode);
      setBreakLength(json.breakLength);
      setWorkLength(json.workLength);
    })();
  }, [roomId]);

  useEffect(() => {
    function handleMessage(event) {
      let json = JSON.parse(event.data);
      switch (json.operation) {
        case 'timerFinished':
          audioElement.current.play();
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

  useEffect(() => {
    audioElement.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    audioElement.current.src = sound;
  }, [sound]);

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
      <nav className="timer-options">
        <TimerVolume
          volume={volume}
          setVolume={setVolume}
        />
        <TimerSound
          setSound={setSound}
        />
      </nav>
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

function TimerVolume(props) {
  let [opened, setOpened] = useState(false);
  let volume = props.volume;
  let setVolume = props.setVolume;

  function handleOpenClick(event) {
    setOpened(setOpened => !setOpened);
  }

  function handleVolumeSliderChange(event) {
    setVolume(event.target.value);
  }

  return (
    <div className="timer-volume">
      <button
        onClick={handleOpenClick}
      >
        Volume
      </button>
      {opened && (
        <div>
          <h2>Set volume</h2>
          <input
            type="range"
            value={volume}
            min="0"
            max="100"
            onChange={handleVolumeSliderChange}
          />
        </div>
      )}
    </div>
  );
}

function TimerSound(props) {
  let [sound, setSound] = useState('https://onlineclock.net/audio/options/falling-bomb.mp3');
  let [opened, setOpened] = useState(false);
  let setTimerSound = props.setSound;

  function handleOpenClick(event) {
    setOpened(setOpened => !setOpened);
  }

  function handleSoundChange(event) {
    setSound(event.target.value);
  }

  function handleSubmit(event) {
    event.preventDefault();

    setTimerSound(sound);
  }

  return (
    <div className="timer-sound">
      <button onClick={handleOpenClick}>
        Sound
      </button>
      {opened && (
        <form onSubmit={handleSubmit}>
          <label>Sound URL</label>
          <input
            type="url"
            value={sound}
            onChange={handleSoundChange}
          />
          <button>Set sound</button>
        </form>
      )}
    </div>
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
