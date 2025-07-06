import { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import TemplateList from '../components/TemplateList';
import TagCloud from '../components/TagCloud';
import { Alert, Button, Spinner, Card, Form, InputGroup } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';

const API_BASE = process.env.REACT_APP_API_URL || 'https://forms-app-9zln.onrender.com';

function Home() {
  const { t } = useTranslation();
  const { user, getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [latestTemplates, setLatestTemplates] = useState([]);
  const [topTemplates, setTopTemplates] = useState([]);
  const [myTemplates, setMyTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingMyTemplates, setLoadingMyTemplates] = useState(!!user);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchPublicTemplates = async () => {
      setLoadingLatest(true);
      setLoadingTop(true);
      setError(null);
      try {
        console.log('✅ Fetching public templates', { timestamp: new Date().toISOString() });
        const requests = [
          axios.get(`${API_BASE}/api/templates?latest=true`),
          axios.get(`${API_BASE}/api/templates?top=5`),
        ];
        const responses = await Promise.all(requests);
        if (isMounted) {
          setLatestTemplates(responses[0].data.templates || []);
          setTopTemplates(responses[1].data.templates || []);
          console.log('✅ Latest Templates:', { count: responses[0].data.templates?.length, timestamp: new Date().toISOString() });
          console.log('✅ Top Templates:', { count: responses[1].data.templates?.length, timestamp: new Date().toISOString() });
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ Error fetching public templates:', {
            status: err.response?.status || err.status || 'unknown',
            message: err.response?.data?.message || err.message,
            code: err.code,
            timestamp: new Date().toISOString(),
          });
          setError(
            err.response?.status === 429 ? t('home.rateLimit') :
            err.response?.status === 502 ? t('home.serverDown') :
            err.response?.status === 500 ? t('home.serverError') :
            t('home.loadError')
          );
        }
      } finally {
        if (isMounted) {
          setLoadingLatest(false);
          setLoadingTop(false);
        }
      }
    };

    const fetchMyTemplates = async () => {
      if (!user) {
        setLoadingMyTemplates(false);
        return;
      }
      setLoadingMyTemplates(true);
      try {
        const token = getToken();
        console.log('✅ Fetching my templates', { timestamp: new Date().toISOString() });
        const response = await axios.get(`${API_BASE}/api/templates?user=true`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) {
          setMyTemplates(response.data.templates || []);
          console.log('✅ My Templates:', { count: response.data.templates?.length, timestamp: new Date().toISOString() });
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ Error fetching my templates:', {
            status: err.response?.status || err.status || 'unknown',
            message: err.response?.data?.message || err.message,
            code: err.code,
            timestamp: new Date().toISOString(),
          });
          setError(
            err.response?.status === 401 ? t('home.unauthorized') :
            err.response?.status === 403 ? t('home.forbidden') :
            err.response?.status === 429 ? t('home.rateLimit') :
            err.response?.status === 502 ? t('home.serverDown') :
            t('home.loadError')
          );
        }
      } finally {
        if (isMounted) {
          setLoadingMyTemplates(false);
        }
      }
    };

    fetchPublicTemplates();
    fetchMyTemplates();

    return () => {
      isMounted = false;
    };
  }, [user, t, getToken]);

  const handleDelete = async (templateId) => {
    if (!templateId) {
      console.error('❌ Invalid templateId for delete:', { templateId, timestamp: new Date().toISOString() });
      setError(t('home.invalidTemplateId'));
      return;
    }
    try {
      const token = getToken();
      console.log(`✅ Deleting template ${templateId}, timestamp=${new Date().toISOString()}`);
      await axios.delete(`${API_BASE}/api/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyTemplates(myTemplates.filter(template => template.id !== templateId));
      console.log('✅ Template deleted:', { templateId, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('❌ Error deleting template:', {
        templateId,
        status: err.response?.status || err.status || 'unknown',
        message: err.response?.data?.message || err.message,
        code: err.code,
        timestamp: new Date().toISOString(),
      });
      setError(
        err.response?.status === 401 ? t('home.unauthorized') :
        err.response?.status === 403 ? t('home.forbidden') :
        err.response?.status === 429 ? t('home.rateLimit') :
        err.response?.status === 502 ? t('home.serverDown') :
        t('home.deleteError')
      );
    }
  };

  const handleEdit = (templateId) => {
    console.log(`✅ Navigating to edit template ${templateId}, timestamp=${new Date().toISOString()}`);
    navigate(`/templates/${templateId}/edit`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log(`✅ Searching for: ${searchQuery}, timestamp=${new Date().toISOString()}`);
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleViewClick = (templateId, title) => {
    console.log(`✅ Navigating to template: ${templateId} (${title}), timestamp=${new Date().toISOString()}`);
    navigate(`/templates/${templateId}`);
  };

  const handleRetry = async () => {
    console.log('✅ Retrying fetch templates, timestamp=${new Date().toISOString()}');
    setError(null);
    setLoadingLatest(true);
    setLoadingTop(true);
    setLoadingMyTemplates(!!user);

    const fetchPublicTemplates = async () => {
      try {
        console.log('✅ Retrying public templates, timestamp=${new Date().toISOString()}');
        const requests = [
          axios.get(`${API_BASE}/api/templates?latest=true`),
          axios.get(`${API_BASE}/api/templates?top=5`),
        ];
        const responses = await Promise.all(requests);
        setLatestTemplates(responses[0].data.templates || []);
        setTopTemplates(responses[1].data.templates || []);
        console.log('✅ Retry Latest Templates:', { count: responses[0].data.templates?.length, timestamp: new Date().toISOString() });
        console.log('✅ Retry Top Templates:', { count: responses[1].data.templates?.length, timestamp: new Date().toISOString() });
        setError(null);
      } catch (err) {
        console.error('❌ Error retrying public templates:', {
          status: err.response?.status || err.status || 'unknown',
          message: err.response?.data?.message || err.message,
          code: err.code,
          timestamp: new Date().toISOString(),
        });
        setError(
          err.response?.status === 429 ? t('home.rateLimit') :
          err.response?.status === 502 ? t('home.serverDown') :
          err.response?.status === 500 ? t('home.serverError') :
          t('home.loadError')
        );
      } finally {
        setLoadingLatest(false);
        setLoadingTop(false);
      }
    };

    const fetchMyTemplates = async () => {
      if (!user) {
        setLoadingMyTemplates(false);
        return;
      }
      try {
        const token = getToken();
        console.log('✅ Retrying my templates, timestamp=${new Date().toISOString()}');
        const response = await axios.get(`${API_BASE}/api/templates?user=true`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMyTemplates(response.data.templates || []);
        console.log('✅ Retry My Templates:', { count: response.data.templates?.length, timestamp: new Date().toISOString() });
        setError(null);
      } catch (err) {
        console.error('❌ Error retrying my templates:', {
          status: err.response?.status || err.status || 'unknown',
          message: err.response?.data?.message || err.message,
          code: err.code,
          timestamp: new Date().toISOString(),
        });
        setError(
          err.response?.status === 401 ? t('home.unauthorized') :
          err.response?.status === 403 ? t('home.forbidden') :
          err.response?.status === 429 ? t('home.rateLimit') :
          err.response?.status === 502 ? t('home.serverDown') :
          t('home.loadError')
        );
      } finally {
        setLoadingMyTemplates(false);
      }
    };

    await Promise.all([fetchPublicTemplates(), fetchMyTemplates()]);
  };

  return (
    <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <Helmet>
        <title>{t('appName')} - {t('home.title')}</title>
      </Helmet>
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
            aria-label={t('home.retry')}
            className="ms-2"
          >
            {t('home.retry')}
          </Button>
        </Alert>
      )}

      <Form onSubmit={handleSearch} className="mb-4" role="search" aria-label={t('home.searchLabel')}>
        <InputGroup>
          <Form.Control
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            aria-label={t('home.searchPlaceholder')}
            id="search-input"
          />
          <Button
            variant={theme === 'dark' ? 'outline-light' : 'primary'}
            type="submit"
            aria-label={t('home.searchButton')}
            id="search-button"
          >
            {t('home.search')}
          </Button>
        </InputGroup>
      </Form>

      <h2 id="latest-templates" className="mb-3">
        {t('home.latestTemplates')}
      </h2>
      {loadingLatest ? (
        <Spinner animation="border" aria-label={t('home.loading')} />
      ) : latestTemplates.length === 0 ? (
        <p aria-live="polite">{t('home.noTemplates')}</p>
      ) : (
        <div className="row" aria-labelledby="latest-templates">
          {latestTemplates.map((template) => (
            <div key={template.id} className="col-12 col-sm-6 col-md-4 mb-3">
              <Card className={theme === 'dark' ? 'bg-dark text-white border-light' : ''}>
                {template.image_url && (
                  <Card.Img
                    variant="top"
                    src={template.image_url}
                    alt={t('home.templateImage', { title: template.title })}
                    style={{ maxHeight: '200px', objectFit: 'cover' }}
                  />
                )}
                <Card.Body>
                  <Card.Title>{template.title}</Card.Title>
                  <div>
                    <ReactMarkdown>{template.description || ''}</ReactMarkdown>
                  </div>
                  <Card.Text>
                    <small>
                      {t('home.by')} {template.User?.name || t('home.unknown')}
                    </small>
                  </Card.Text>
                  {template.id ? (
                    <Button
                      variant={theme === 'dark' ? 'outline-light' : 'primary'}
                      onClick={() => handleViewClick(template.id, template.title)}
                      aria-label={t('home.viewTemplate', { title: template.title })}
                    >
                      {t('home.view')}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled
                      aria-label={t('home.viewDisabled')}
                    >
                      {t('home.view')}
                    </Button>
                  )}
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      )}

      {user && (
        <>
          <h2 id="my-templates" className="mt-4 mb-3">
            {t('home.myTemplates')}
            <Button
              as={Link}
              to="/templates/new"
              variant={theme === 'dark' ? 'outline-light' : 'primary'}
              size="sm"
              className="ms-2"
              aria-label={t('createTemplate.title')}
            >
              {t('createTemplate.title')}
            </Button>
          </h2>
          {loadingMyTemplates ? (
            <Spinner animation="border" aria-label={t('home.loading')} />
          ) : myTemplates.length === 0 ? (
            <p aria-live="polite">{t('home.noMyTemplates')}</p>
          ) : (
            <TemplateList
              templates={myTemplates}
              onDelete={handleDelete}
              onEdit={handleEdit}
              showActions={true}
              aria-labelledby="my-templates"
            />
          )}
        </>
      )}

      <h2 id="top-templates" className="mt-4 mb-3">
        {t('home.topTemplates')}
      </h2>
      {loadingTop ? (
        <Spinner animation="border" aria-label={t('home.loading')} />
      ) : topTemplates.length === 0 ? (
        <p aria-live="polite">{t('home.noTopTemplates')}</p>
      ) : (
        <TemplateList
          templates={topTemplates}
          onDelete={() => {}}
          showActions={false}
          aria-labelledby="top-templates"
        />
      )}

      <h2 id="tags" className="mt-4 mb-3">
        {t('home.tags')}
      </h2>
      <TagCloud aria-labelledby="tags" />
    </div>
  );
}

export default Home;
