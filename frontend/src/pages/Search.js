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

function Search() {
  const { t } = useTranslation();
  const { user, getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const location = useLocation();
  const query = new URLSearchParams(location.search).get('q') || '';
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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

      console.log('✅ Search fetchTemplates:', { query, timestamp: new Date().toISOString() });
      setLoading(true);
      setError(null);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${API_BASE}/api/templates/search?q=${encodeURIComponent(query)}`, {
          headers,
        });
        const fetchedTemplates = res.data.templates || [];
        console.log('✅ Search fetched:', fetchedTemplates.length);
        setTemplates(fetchedTemplates);
      } catch (err) {
        console.error('❌ Error fetching search results:', { status: err.response?.status });
        setError(
          err.response?.status === 401 ? t('search.unauthorized') :
          err.response?.status === 429 ? t('search.rateLimit') :
          t('search.loadError')
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [query, t, getToken]);

  const handleDelete = async (templateId) => {
    if (!templateId) {
      console.error('❌ Invalid template_id:', templateId);
      setError(t('search.invalidTemplateId'));
      return;
    }
    console.log(`✅ Deleting template ${templateId}`);
    try {
      const token = getToken();
      const response = await axios.delete(`${API_BASE}/api/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ Delete success:', response.data.success);
      setTemplates(templates.filter(t => t.id !== templateId));
    } catch (err) {
      console.error('❌ Error deleting template:', { status: err.response?.status });
      setError(
        err.response?.status === 401 ? t('search.unauthorized') :
        err.response?.status === 429 ? t('search.rateLimit') :
        t('search.deleteError')
      );
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
        const fetchedTemplates = res.data.templates || [];
        console.log('✅ Retry search fetched:', fetchedTemplates.length);
        setTemplates(fetchedTemplates);
      } catch (err) {
        console.error('❌ Error retrying search:', { status: err.response?.status });
        setError(
          err.response?.status === 401 ? t('search.unauthorized') :
          err.response?.status === 429 ? t('search.rateLimit') :
          t('search.loadError')
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

export default Search;