// The index file for the React application that sets up the Redux store and renders the main App component.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import  store from './store/index';
import App from './App';
import './styles/globals.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);