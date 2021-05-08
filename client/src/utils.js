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
  let innerHtml;
  if (props.children === '') {
    innerHtml = <>&nbsp;</>
  } else {
    innerHtml = props.children;
  }
  return (
    <div className="error">{innerHtml}</div>
  );
}

export {
  apiGet,
  apiDelete,
  apiPost,
  getToken,
  Error
};
