import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, Button } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import { useContext } from 'react';
import { Helmet } from 'react-helmet';

function NotFound() {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const location = useLocation();

  useEffect(() => {
    console.log('✅ NotFound page accessed:', { path: location.pathname, timestamp: new Date().toISOString() });
  }, [location]);

  return (
    <Container role="main" className={`text-center my-5 ${theme === 'dark' ? 'text-light' : ''}`}>
      <Helmet>
        <title>{t('appName')} - {t('notFound.title')}</title>
      </Helmet>
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.message', { path: location.pathname })}</p>
      <Button as={Link} to="/" variant={theme === 'dark' ? 'outline-light' : 'primary'} aria-label={t('notFound.backHome')}>
        {t('notFound.backHome')}
      </Button>
    </Container>
  );
}

export default NotFound;