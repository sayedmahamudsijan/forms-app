import { useEffect, useState, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import TemplateList from '../components/TemplateList';
import { Alert, Button, Spinner } from 'react-bootstrap';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function SearchResults() {
  const { t } = useTranslation();
  const { user, getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const location = useLocation();
  const query = new URLSearchParams(location.search).get('q') || '';
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query.trim()) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    const fetchTemplates = async () => {
      const token = getToken();
      if (!token) {
        setError(t('search.unauthorized'));
        setLoading(false);
        return;
      }

      console.log('✅ SearchResults fetchTemplates:', { query, timestamp: new Date().toISOString() });
      setLoading(true);
      setError(null);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${API_BASE}/api/templates/search?q=${encodeURIComponent(query)}`, {
          headers,
        });
        const fetchedTemplates = res.data.templates?.filter(t => t.id && t.id !== 16 && t.id !== 31) || [];
        console.log('✅ SearchResults Response:', JSON.stringify(fetchedTemplates, null, 2));
        if (fetchedTemplates.some(t => t.id === 16 || t.id === 31)) {
          console.error('❌ Invalid template_id (16 or 31) detected:', fetchedTemplates);
        }
        setTemplates(fetchedTemplates);
      } catch (err) {
        console.error('❌ Error fetching search results:', {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data,
        });
        setError(
          err.response?.status === 401
            ? t('search.unauthorized')
            : t('search.loadError')
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [query, t, getToken]);

  const handleDelete = async (templateId) => {
    if (!templateId || templateId === 16 || templateId === 31) {
      console.error('❌ Attempted to delete invalid template_id:', templateId);
      setError(t('search.invalidTemplateId'));
      return;
    }
    console.log(`✅ Deleting template ${templateId}`);
    try {
      const token = getToken();
      const response = await axios.delete(`${API_BASE}/api/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ Delete Response:', JSON.stringify(response.data, null, 2));
      setTemplates(templates.filter(t => t.id !== templateId));
    } catch (err) {
      console.error('❌ Error deleting template:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      setError(t('search.deleteError'));
    }
  };

  const handleRetry = async () => {
    if (!query.trim()) return;
    console.log('✅ Retrying search:', { query, timestamp: new Date().toISOString() });
    setError(null);
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const fetchTemplates = async () => {
      const token = getToken();
      if (!token) {
        setError(t('search.unauthorized'));
        setLoading(false);
        return;
      }

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${API_BASE}/api/templates/search?q=${encodeURIComponent(query)}`, {
          headers,
        });
        const fetchedTemplates = res.data.templates?.filter(t => t.id && t.id !== 16 && t.id !== 31) || [];
        console.log('✅ Retry SearchResults Response:', JSON.stringify(fetchedTemplates, null, 2));
        setTemplates(fetchedTemplates);
      } catch (err) {
        console.error('❌ Error retrying search:', {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data,
        });
        setError(
          err.response?.status === 401
            ? t('search.unauthorized')
            : t('search.loadError')
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  };

  return (
    <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <Helmet>
        <title>{t('appName')} - {t('search.titlePage', { query: query || t('search.emptyQuery') })}</title>
      </Helmet>
      <h2 id="search-results">{t('search.title', { query: query || t('search.emptyQuery') })}</h2>
      {error && (
        <Alert
          variant="danger"
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setError(null)}
        >
          {error}
          <Button
            variant="link"
            onClick={handleRetry}
            aria-label={t('search.retry')}
            className="ms-2"
            id="retry-button"
          >
            {t('search.retry')}
          </Button>
        </Alert>
      )}
      {loading && <Spinner animation="border" aria-label={t('search.loading')} />}
      {!loading && !error && templates.length === 0 && (
        <p aria-live="polite">{t('search.noResults')}</p>
      )}
      {!loading && !error && templates.length > 0 && (
        <TemplateList
          templates={templates}
          onDelete={handleDelete}
          showActions={user ? templates.some(t => t.user_id === user.id) : false}
          aria-labelledby="search-results"
        />
      )}
    </div>
  );
}

export default SearchResults;