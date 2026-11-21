import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import PortalFeedback from './components/ui/PortalFeedback.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PortalFeedback>
      <App />
    </PortalFeedback>
  </React.StrictMode>
);
