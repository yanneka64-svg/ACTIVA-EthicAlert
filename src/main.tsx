import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// === AMÉLIORATION AJOUTÉE (séparation test / production) ===
import { EnvironmentBanner } from './components/EnvironmentBanner';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EnvironmentBanner />
    <App />
  </StrictMode>,
);
