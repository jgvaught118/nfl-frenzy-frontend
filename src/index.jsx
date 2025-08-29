import React from "react";
import ReactDOM from "react-dom/client"; // Use the new ReactDOM.createRoot
import App from "./App"; // Your main App component

// Find the root element in your HTML
const rootElement = document.getElementById("root");

// Create the root using React 18's createRoot
const root = ReactDOM.createRoot(rootElement);

// Render your App wrapped in StrictMode
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
