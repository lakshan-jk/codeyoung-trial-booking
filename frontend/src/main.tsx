import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { DemoClassRoom } from './pages/DemoClassRoom.js';
import './styles.css';

// Tiny path-based routing — the dummy class link opens the demo room.
const isRoom = window.location.pathname.startsWith('/room/');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isRoom ? <DemoClassRoom /> : <App />}</React.StrictMode>,
);
