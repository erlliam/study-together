import {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  useHistory,
} from 'react-router-dom';

import {
  apiPost,
  Error
} from './utils';

// todo: Don't allow names that only contain spaces
/* todo: UX
    remove error message when you start typing
    display some state that confirms your request is being processed
    display something in the case of a server error
*/

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

    let response = await apiPost('/room/create', {
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
        // todo: Don't just assume the name is invalid.
        setError('Invalid name');
      }
    }
  }

  function handleNameChange(event) {
    setName(event.target.value);
    setError('');
  }

  return (
    <div className="create-room">
      <h1>Create a Room</h1>
      <Error setError={setError}>{error}</Error>
      <div className="create-room-form-wrapper">
        <form autoComplete="off" onSubmit={handleSubmit}>
          <label htmlFor="create-room-name">Room name</label>
          <input
            id="create-room-name"
            value={name}
            onChange={handleNameChange}
            autoFocus
            required
          />

          <label htmlFor="create-room-password">Password <span className="lighter-text">(optional)</span></label>
          <input
            id="create-room-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <label htmlFor="create-room-capacity">Room capacity <span className="lighter-text">(capacity is 16)</span></label>
          <input
            id="create-room-capacity"
            type="number"
            min="1" max="16"
            value={capacity}
            onChange={e => setCapacity(e.target.value)}
            required
          />

          <button id="create-room-button">Create room</button>
        </form>
      </div>
    </div>
  );
}

export default CreateRoom;
