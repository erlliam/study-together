let apiUrl = 'http://192.168.1.163:5000/api'

async function wrappedFetch(url, stuff) {
  try {
    return await fetch(url, stuff);
  } catch(error) {
    return new Response(null, {status: 420});
  }
}

function apiGet(url, options) {
  return wrappedFetch(apiUrl + url, {
    credentials: 'include',
    ...options
  });
}

function apiDelete(url, options) {
  return wrappedFetch(apiUrl + url, {
    method: 'DELETE',
    credentials: 'include',
    ...options
  });
}

function apiPost(url, options) {
  return wrappedFetch(apiUrl + url, {
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

  if (props.error) {
    return (
      <div className="error">
        {props.error}
        <button onClick={handleCloseClick}>Close</button>
      </div>
    );
  } else {
    return null;
  }
}

export {
  apiGet,
  apiDelete,
  apiPost,
  getToken,
  Error
};
