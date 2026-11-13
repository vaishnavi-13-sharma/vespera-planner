import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted fonts (Latin only): no visit ever calls Google.
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import './index.css';
import App from './App';
import { startAutoUpdate } from './lib/pwa';

// New versions install and reload by themselves (src/lib/pwa.ts).
startAutoUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
