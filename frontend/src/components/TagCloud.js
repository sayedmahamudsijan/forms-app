import { useEffect, useState, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spinner, Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function TagCloud({ ariaLabelledBy }) {
  const { t } = useTranslation();
  const { getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const retryCount = useRef(0);
  const maxRetries = 3;

  const fetchTags = async () => {
    const token = getToken();
    setLoading(true);
    setError(null);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      console.log(`✅ Fetching tags, timestamp=${new Date().toISOString()}`);
      const res = await axios.get(`${API_BASE}/api/tags`, { headers });
      console.log('✅ Tags fetched:', res.data.tags?.length || 0);
      setTags(res.data.tags || []);
      setError(null);
      retryCount.current = 0;
    } catch (err) {
      console.error('❌ Failed to load tags:', { status: err.response?.status });
      if (err.response?.status === 429 && retryCount.current < maxRetries) {
        retryCount.current += 1;
        console.log(`✅ Retrying tag fetch, attempt ${retryCount.current}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.current));
        return fetchTags();
      }
      setError(
        err.response?.status === 429 ? t('tagCloud.rateLimit') :
        err.response?.status === 401 ? t('tagCloud.unauthorized') :
        t('tagCloud.error')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadTags = async () => {
      if (isMounted) await fetchTags();
    };
    loadTags();
    return () => {
      isMounted = false;
    };
  }, [t, getToken]);

  return (
    <div
      className="mt-3"
      aria-label={t('tagCloud.label')}
      role="region"
      aria-labelledby={ariaLabelledBy}
      aria-busy={loading ? 'true' : 'false'}
    >
      <h5 className="mb-2" id={ariaLabelledBy}>{t('tagCloud.title')}</h5>
      {loading && <Spinner animation="border" size="sm" aria-label={t('tagCloud.loading')} />}
      {error && (
        <Alert variant="danger" role="alert" aria-live="assertive" dismissible onClose={() => setError(null)}>
          {error}
          <Button
            variant="link"
            onClick={fetchTags}
            className="ms-2"
            aria-label={t('tagCloud.retry')}
            id="retry-tags-button"
          >
            {t('tagCloud.retry')}
          </Button>
        </Alert>
      )}
      <div aria-live="polite">
        {!loading && !error && tags.length === 0 && <p>{t('tagCloud.noTags')}</p>}
        {!loading && !error && tags.length > 0 && (
          <div className="d-flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                to={`/search?q=${encodeURIComponent(`tag:${tag.name}`)}`}
                className={`badge ${theme === 'dark' ? 'bg-primary text-light' : 'bg-primary text-white'} text-decoration-none tag-badge`}
                aria-label={t('tagCloud.tagLink', { name: tag.name })}
                id={`tag-${tag.id}`}
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TagCloud;