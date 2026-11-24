import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './state/AppContext';
import { initInstallPrompt } from './lib/install';
import './styles.css';

// Precisa rodar antes do React montar: o beforeinstallprompt dispara uma única vez.
initInstallPrompt();

// O app instalável (PWA) usa service worker: registramos apenas em HTTPS/produção,
// nunca no servidor de desenvolvimento, para não servir arquivos antigos do Vite.
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
