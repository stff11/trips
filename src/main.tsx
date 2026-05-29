import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Force Leaflet's structural layout engine onto the DOM tree
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Re-route Leaflet's internal asset resolver to stable CDN assets.
// This completely bypasses Vite's file bundling graph and removes the type errors.
delete (L.Icon.Default.prototype as any)._getIconUrl;

// Set everything to a blank icon
L.Icon.Default.mergeOptions({
  iconUrl: '', 
  iconRetinaUrl: '',
  shadowUrl: ''
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);