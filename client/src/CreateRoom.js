import {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  useHistory,
} from 'react-router-dom';

let apiUrl = 'http://localhost:5000/api'

// todo: Don't allow names that only contain spaces
/* todo: UX
    remove error message when you start typing
    display some state that confirms your request is being processed
    display something in the case of a server error
*/
function apiFetch(url, options) {
  return fetch(apiUrl + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    ...options
  });
}

function Error(props) {
  let innerHTML;
  if (props.children === '') {
    innerHTML = <>&nbsp;</>
  } else {
    innerHTML = props.children;
  }
  return (
    <div className="error">{innerHTML}</div>
  );
}

function CreateRoom() {
  let isMounted = useRef(true);
  let history = useHistory();
  let [name, setName] = useState('');
  let [password, setPassword] = useState('');
  let [capacity, setCapacity] = useState('4');
  let [error, setError] = useState('');

  useEffect(() => {
    return (() => {
      isMounted.current = false;
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    let response = await apiFetch('/room/create', {
      body: JSON.stringify({
        name: name,
        password: password,
        capacity: capacity
      })
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
      <Error>{error}</Error>
      <form autoComplete="off" onSubmit={handleSubmit}>
        <label htmlFor="create-room-name">Room name</label>
        <input
          id="create-room-name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
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

export default CreateRoom;
