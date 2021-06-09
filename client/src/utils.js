let apiUrl = 'http://localhost:5000/api'

function apiGet(url, options) {
  return fetch(apiUrl + url, {
    credentials: 'include',
    ...options
  });
}

function apiDelete(url, options) {
  return fetch(apiUrl + url, {
    method: 'DELETE',
    credentials: 'include',
    ...options
  });
}

function apiPost(url, options) {
  return fetch(apiUrl + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    ...options
  });
}

function getToken() {
  let cookies = Object.fromEntries(document.cookie.split('; ').map(x => x.split('=')));
  return cookies.token;
}

function Error(props) {
  function handleCloseClick(event) {
    props.setError('');
  }

  return (
    (props.children) === '' ?
      <div className="error-empty">&nbsp;</div> :
      <div className="error">
        {props.children}
        <button onClick={handleCloseClick}>Close</button>
      </div>
  );
}

export {
  apiGet,
  apiDelete,
  apiPost,
  getToken,
  Error
};
