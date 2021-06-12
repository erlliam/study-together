import {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  useParams,
} from 'react-router-dom';

import {
  apiGet,
  getToken,
} from './utils';

function Messages(props) {
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState('');
  let divElement = useRef();
  let params = useParams();
  let id = params.id;

  useEffect(() => {
    function handleMessage(event) {
      let json = JSON.parse(event.data);
      if (json.operation === 'message') {
        setMessages((prevMessages) => {
          return [
            ...prevMessages,
            {
              data: json.message,
              key: event.timeStamp + event.data
            }
          ]
        });
      }
    }
    function handleClose(event) {
      // todo: Normal close is error code 1000
      // make this a switch statement
      setMessages((prevMessages) => {
        return [
          ...prevMessages,
          {
            data: event.reason,
            key: event.timeStamp + event.reason
          }
        ]
      });
    }

    props.ws.addEventListener('message', handleMessage);
    props.ws.addEventListener('close', handleClose);
    return (() => {
      props.ws.removeEventListener('message', handleMessage);
      props.ws.removeEventListener('close', handleClose);
    });
  }, [props.ws]);

  useEffect(() => {
    // todo: Let users override auto scrolling.
    let d = divElement.current;
    d.scrollTop = d.scrollHeight - d.clientHeight;
  }, [messages]);

  function handleSubmitMessage(event) {
    event.preventDefault();
    props.ws.send(JSON.stringify({
      operation: 'userMessage',
      id: id,
      token: getToken(),
      message: message
    }));
    setMessage('');
  }

  return (
    <>
      <UserList />
      <div ref={divElement} className="messages">
        {messages.map((message) => (
          <p key={message.key}>{message.data}</p>
        ))}
      </div>
      <form
        className="form-send-message"
        autoComplete="off"
        onSubmit={handleSubmitMessage}
      >
        <input
          placeholder="Message"
          id="chat-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <button>Send message</button>
      </form>
    </>
  );
}

function UserList() {
  let [opened, setOpened] = useState(false);
  let userList = useRef();
  let params = useParams();
  let roomId = params.id;

  async function handleUserListClick(event) {
    // todo: Add an error
    let response = await apiGet('/room/' + roomId + '/users');
    if (response.ok) {
      let json = await response.json();
      json = json.map(({userId, name}) => {
        if (name !== null) {
          return name;
        } else {
          return userId;
        }
      });
      userList.current = json;
      setOpened(opened => !opened);
    } else {
      throw Error('die');
    }
  }

  return (
    <>
      <button
        onClick={handleUserListClick}
        className="button-user-list"
      >
        User list
      </button>
      {opened && (
        <div className="div-user-list">
          {userList.current.map((name) => (
            <p key={name}>{name}</p>
          ))}
        </div>
      )}
    </>
  );
}

export {Messages};
