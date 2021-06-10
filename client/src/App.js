import {
  useState,
  useEffect,
} from 'react';

import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useLocation
} from 'react-router-dom';

import {
  apiGet,
  apiPost,
  Error
} from './utils';

import {Room} from './Room';
import {CreateRoom} from './CreateRoom';

async function initializeApp(setValidUser) {
  // If the server is down, fetch throws an error...
  try {
    let userResponse = await apiGet('/user');
    if (userResponse.status === 200) {
      let json = await userResponse.json();
      localStorage.setItem('id', json.id);
      setValidUser(true);
    } else {
      let userCreateReponse = await apiPost('/user/create');
      if (userCreateReponse.status === 201) {
        let json = await userCreateReponse.json();
        localStorage.setItem('id', json.id);
        setValidUser(true);
      } else {
        setValidUser(false);
      }
    }
  } catch(error) {
    setValidUser(false);
  }
}

function App() {
  let [validUser, setValidUser] = useState(null);

  useEffect(() => {
    initializeApp(setValidUser);
  }, []);

  if (validUser === true) {
    return (
      <Router>
        <TopNav />
        <Switch>
          <Route exact path="/"><StartingPage /></Route>
          <Route path="/create"><CreateRoom /></Route>
          <Route path="/join"><RoomList /></Route>
          <Route path="/room/:id"><Room /></Route>
          <Route path="*"><h1>404</h1></Route>
        </Switch>
      </Router>
    );
  } else if (validUser === false) {
    return (
      <h1>Something went wrong...</h1>
    );
  } else if (validUser === null) {
    return (
      <h1>Initializing...</h1>
    );
  }
}

function TopNav() {
  let location = useLocation();

  if (location.pathname === '/') {
    return null;
  } else {
    return (
      <nav className="top-nav">
        <Link to="/">Home</Link>
        <Link to="/create">Create a room</Link>
        <Link to="/join">Join a room</Link>
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
        <Link to="/create">Create a room</Link>
        <Link to="/join">Join a room</Link>
      </nav>
    </div>
  );
}

function RoomList() {
  let [error, setError] = useState('');
  let [rooms, setRooms] = useState(null);

  useEffect(() => {
    (async () => {
      let response = await apiGet('/room/all');
      if (response.ok) {
        setRooms(await response.json());
      } else {
        setError('Failed to fetch rooms.');
      }
    })();
  }, []);

  let tbodyChildren;
  if (rooms === null) {
    tbodyChildren = (
      <tr>
        <td id="rooms-loading" colSpan="4">Loading...</td>
      </tr>
    );
  } else if (Array.isArray(rooms)) {
    if (rooms.length === 0) {
      tbodyChildren = (
        <tr>
          <td id="no-rooms-found" colSpan="4">
            There are no rooms. <Link to="/create">Create a room.</Link>
          </td>
        </tr>
      );
    } else {
      tbodyChildren = rooms.map(({id, password, name, usersConnected, userCapacity}) => {
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
            {tbodyChildren}
          </tbody>
        </table>
      </nav>
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

export {
  App,
  PasswordPage,
}
