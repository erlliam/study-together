import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from 'react-router-dom';

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/">
          <div className="starting-page">
            <h1>Study Together</h1>
            <Link to="/create-room">Create a room</Link>
            <Link to="/join-room">Join a room</Link>
          </div>
        </Route>
      </Switch>
    </Router>
  );
}

export default App;
