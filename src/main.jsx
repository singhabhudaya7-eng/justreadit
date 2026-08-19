// main.jsx – entry point for Vite + React
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import MetricsPage from './components/MetricsPage.jsx';
import './index.css';

const isMetricRoute = window.location.pathname.replace(/\/+$/, '') === '/metric';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isMetricRoute ? <MetricsPage /> : <App />}
  </React.StrictMode>
);
