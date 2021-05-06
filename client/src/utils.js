let apiUrl = 'http://localhost:5000/api'

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

export {apiFetch, Error};
