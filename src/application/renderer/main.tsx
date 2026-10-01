import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { APP_NAME } from '@/common/model/brand';
import './styles.css';

/** Appen hette Reverik; inställningar sparade under det namnet flyttas till yart-nycklar en gång. */
function migrateLegacyStorage(): void {
  try {
    const legacyKeys = Object.keys(localStorage).filter((key) => key.startsWith('reverik.'));
    for (const key of legacyKeys) {
      const next = `yart.${key.slice('reverik.'.length)}`;
      const value = localStorage.getItem(key);
      if (value !== null && localStorage.getItem(next) === null) localStorage.setItem(next, value);
      localStorage.removeItem(key);
    }
  } catch {
    // Utan localStorage finns inget att flytta.
  }
}

async function bootstrap(): Promise<void> {
  document.title = APP_NAME;
  migrateLegacyStorage();
  if (import.meta.env.DEV && !('api' in window)) {
    const { installMockBridge } = await import('./mockBridge');
    installMockBridge();
  }

  const root = document.getElementById('root');
  if (!root) throw new Error('Hittar inte #root');

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
