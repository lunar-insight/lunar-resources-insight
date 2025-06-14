import React from 'react' // Necessary import
import { createRoot } from 'react-dom/client'
import App from './App';
import './global.css'

const root = createRoot(document.getElementById('app'));
root.render(<App />);