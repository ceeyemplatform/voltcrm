import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConfirmHost } from './components/common/ConfirmHost';
import { CompanyProvider } from './context/CompanyContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <CompanyProvider>
          <App />
          <ConfirmHost />
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
