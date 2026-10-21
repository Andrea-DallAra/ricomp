import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { seed } from './lib/settings';
import { registerSW } from './lib/push';

seed().then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
registerSW();
// chiede al browser di non cancellare i dati locali
navigator.storage?.persist?.().catch(() => {});
