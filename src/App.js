// ===== 2. src/App.js =====
import React from 'react';
import { ToastContainer } from 'react-toastify';
import PlaceSearchApp from './components/PlaceSearchApp';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <div className="App">
      <PlaceSearchApp />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}

export default App;