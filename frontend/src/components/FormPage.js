import { useState, useEffect, useContext, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container, Spinner, Alert, Button } from 'react-bootstrap';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import FormFill from './FormFill';

const API_BASE = process.env.REACT_APP_API_URL || 'https://forms-app-9zln.onrender.com';

function FormPage() {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const { user, getToken } = useContext(AuthContext);
  const { id } = useParams();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const retryCount = useRef(0);
  const maxRetries = 3;

  const fetchTemplate = async () => {
    try {
      const token = getToken();
      console.log(`✅ Fetching template ${id}, timestamp=${new Date().toISOString()}`);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE}/api/templates/${id}`, { headers });
      console.log('✅ Template fetched:', res.data.template?.title);
      setTemplate(res.data.template);
      setError(null);
      retryCount.current = 0;
    } catch (err) {
      console.error('❌ Fetch error:', { status: err.response?.status });
      if (err.response?.status === 429 && retryCount.current < maxRetries) {
        retryCount.current += 1;
        console.log(`✅ Retrying fetch for template ${id}, attempt ${retryCount.current}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.current));
        return fetchTemplate();
      }
      setError(
        err.response?.status === 404 ? t('form.notFound') :
        err.response?.status === 403 ? t('form.accessDenied') :
        err.response?.status === 429 ? t('form.rateLimit') :
        err.response?.status === 401 ? t('form.unauthorized') :
        t('form.fetchError')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplate();
  }, [id, user, t, getToken]);

  if (loading) {
    return (
      <Container className="text-center mt-5" role="region" aria-label={t('form.loading')}>
        <Spinner animation="border" role="status" aria-label={t('form.loading')} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5" role="region" aria-label={t('form.error')}>
        <Alert variant="danger" role="alert" aria-live="assertive" dismissible onClose={() => setError(null)}>
          {error}
          {(error === t('form.fetchError') || error === t('form.rateLimit')) && (
            <Button
              variant="link"
              onClick={() => {
                setLoading(true);
                setError(null);
                console.log(`✅ Retrying fetch for template ${id}, timestamp=${new Date().toISOString()}`);
                fetchTemplate();
              }}
              aria-label={t('form.retry')}
              id="retry-template-button"
            >
              {t('form.retry')}
            </Button>
          )}
        </Alert>
      </Container>
    );
  }

  return (
    <Container className={`mt-5 ${theme === 'dark' ? 'text-light' : ''}`} role="region" aria-label={t('form.pageLabel')}>
      <h2 id="form-page-title">{t('form.pageTitle', { title: template.title })}</h2>
      <FormFill templateId={id} />
    </Container>
  );
}

export default FormPage;