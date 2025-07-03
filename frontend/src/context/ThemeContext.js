import React, { createContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button } from 'react-bootstrap';

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      console.log(`✅ Initializing theme: ${savedTheme || 'light'}, timestamp=${new Date().toISOString()}`);
      return savedTheme || 'light';
    } catch (err) {
      console.error('❌ Failed to access localStorage for theme:', { message: err.message, timestamp: new Date().toISOString() });
      return 'light';
    }
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log(`✅ Setting theme: ${theme}, timestamp=${new Date().toISOString()}`);
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
      const announcer = document.getElementById('theme-announcer');
      if (announcer) {
        announcer.textContent = t('themeProvider.themeChanged', { theme });
      }
      setError(null);
    } catch (err) {
      console.error('❌ Failed to save theme to localStorage:', { message: err.message, timestamp: new Date().toISOString() });
      setError(t('themeProvider.storageError'));
    }
  }, [theme, t]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {error && (
        <Alert
          variant="danger"
          className="position-fixed top-0 start-50 translate-middle-x m-3"
          style={{ zIndex: 1050, maxWidth: '500px' }}
          dismissible
          onClose={() => setError(null)}
          role="alert"
          aria-live="assertive"
          id="theme-error-alert"
        >
          {error}
          <Button
            variant="link"
            onClick={() => setError(null)}
            aria-label={t('themeProvider.dismiss')}
            className="ms-2"
            id="theme-dismiss-button"
          >
            {t('themeProvider.dismiss')}
          </Button>
        </Alert>
      )}
      <div aria-live="polite" className="visually-hidden" id="theme-announcer"></div>
      {children}
    </ThemeContext.Provider>
  );
}