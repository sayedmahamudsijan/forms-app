import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-bootstrap';
import { ThemeContext } from '../context/ThemeContext';

function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <div>
      <Button
        variant={theme === 'dark' ? 'outline-light' : 'outline-dark'}
        size="sm"
        onClick={() => {
          console.log(`✅ Toggling theme from ${theme} to ${theme === 'light' ? 'dark' : 'light'}, timestamp=${new Date().toISOString()}`);
          toggleTheme();
          const newTheme = theme === 'light' ? 'dark' : 'light';
          const region = document.getElementById('theme-announcer');
          if (region) {
            region.textContent = t('themeToggle.changed', { theme: newTheme });
          }
        }}
        aria-pressed={theme === 'dark'}
        aria-label={t('themeToggle.toggle', { theme: theme === 'light' ? 'dark' : 'light' })}
        id="theme-toggle-button"
      >
        {t('themeToggle.label', { theme: theme === 'light' ? 'Dark' : 'Light' })}
      </Button>
      <div
        id="theme-announcer"
        aria-live="polite"
        className="visually-hidden"
      />
    </div>
  );
}

export default ThemeToggle;