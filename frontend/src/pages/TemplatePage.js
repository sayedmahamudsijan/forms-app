import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import FormFill from '../components/FormFill';
import CommentSection from '../components/CommentSection';
import { Nav, Alert, Button, Spinner, ListGroup, Container } from 'react-bootstrap';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function TemplatePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user, getToken, getAuthHeaders, refreshToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [results, setResults] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [activeTab, setActiveTab] = useState('settings');
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingLike, setLoadingLike] = useState(false);
  const [errorTemplate, setErrorTemplate] = useState(null);
  const [errorResults, setErrorResults] = useState(null);
  const [errorLike, setErrorLike] = useState(null);
  const [formMessage, setFormMessage] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    console.log('✅ TemplatePage loaded:', { id, userId: user?.id, timestamp: new Date().toISOString() });
    const fetchTemplate = async (retry = false) => {
      console.log('✅ Fetching template:', { id, userId: user?.id, retry, timestamp: new Date().toISOString() });
      setLoadingTemplate(true);
      setErrorTemplate(null);
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(`${API_BASE}/api/templates/${id}`, { headers });
        const data = res.data.template || res.data;
        if (!data.id) throw new Error('Invalid template data');
        console.log('✅ Template fetched:', { title: data.title, questions: data.TemplateQuestions?.length || 0, timestamp: new Date().toISOString() });
        setTemplate(data);
        setLikeCount(data.like_count || 0);
        setIsLiked(data.user_liked || false);
        setRetryCount(0);
      } catch (err) {
        console.error('❌ Error fetching template:', {
          status: err.response?.status,
          message: err.response?.data?.message,
          timestamp: new Date().toISOString(),
        });
        if (err.response?.status === 401 && retryCount < maxRetries && !retry) {
          try {
            await refreshToken();
            setRetryCount(prev => prev + 1);
            await fetchTemplate(true);
          } catch (refreshErr) {
            console.error('❌ Error retrying template:', {
              status: refreshErr.response?.status,
              message: refreshErr.response?.data?.message,
              timestamp: new Date().toISOString(),
            });
            setErrorTemplate(t('templatePage.unauthorized'));
            navigate('/login');
          }
        } else {
          setErrorTemplate(
            err.response?.status === 404 ? t('templatePage.notFound') :
            err.response?.status === 429 ? t('templatePage.rateLimit') :
            err.response?.status === 500 ? t('templatePage.serverError') :
            t('templatePage.loadTemplateError')
          );
        }
      } finally {
        setLoadingTemplate(false);
      }
    };

    const fetchResults = async () => {
      if (!user) {
        setLoadingResults(false);
        return;
      }
      console.log('✅ Fetching results:', { id, userId: user.id, timestamp: new Date().toISOString() });
      setLoadingResults(true);
      setErrorResults(null);
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(`${API_BASE}/api/templates/${id}/results`, { headers });
        console.log('✅ Results fetched:', { count: res.data.forms?.length || 0, timestamp: new Date().toISOString() });
        setResults(res.data.forms || []);
      } catch (err) {
        console.error('❌ Error fetching results:', {
          status: err.response?.status,
          message: err.response?.data?.message,
          timestamp: new Date().toISOString(),
        });
        if (err.response?.status === 401 && retryCount < maxRetries) {
          try {
            await refreshToken();
            setRetryCount(prev => prev + 1);
            await fetchResults();
          } catch (refreshErr) {
            console.error('❌ Error retrying results:', {
              status: refreshErr.response?.status,
              message: refreshErr.response?.data?.message,
              timestamp: new Date().toISOString(),
            });
            setErrorResults(t('templatePage.unauthorized'));
            navigate('/login');
          }
        } else {
          setErrorResults(
            err.response?.status === 404 ? t('templatePage.noResults') :
            err.response?.status === 403 ? t('templatePage.forbidden') :
            err.response?.status === 429 ? t('templatePage.rateLimit') :
            t('templatePage.loadResultsError')
          );
        }
      } finally {
        setLoadingResults(false);
      }
    };

    fetchTemplate();
    fetchResults();

    return () => {};
  }, [id, user, t, getAuthHeaders, refreshToken, retryCount, navigate]);

  const handleLike = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    console.log(`✅ Toggling like for template ${id}`, { timestamp: new Date().toISOString() });
    setLoadingLike(true);
    setErrorLike(null);
    try {
      const headers = getAuthHeaders();
      const response = await axios.post(
        `${API_BASE}/api/templates/${id}/likes`,
        {},
        { headers }
      );
      console.log('✅ Like success:', { success: response.data.success, timestamp: new Date().toISOString() });
      setIsLiked(!isLiked);
      setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    } catch (err) {
      console.error('❌ Error liking template:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        timestamp: new Date().toISOString(),
      });
      if (err.response?.status === 401 && retryCount < maxRetries) {
        try {
          await refreshToken();
          setRetryCount(prev => prev + 1);
          await handleLike();
        } catch (refreshErr) {
          console.error('❌ Error retrying like:', {
            status: refreshErr.response?.status,
            message: refreshErr.response?.data?.message,
            timestamp: new Date().toISOString(),
          });
          setErrorLike(t('templatePage.unauthorized'));
          navigate('/login');
        }
      } else {
        setErrorLike(
          err.response?.status === 404 ? t('templatePage.notFound') :
          err.response?.status === 429 ? t('templatePage.rateLimit') :
          t('templatePage.likeError')
        );
      }
    } finally {
      setLoadingLike(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('templatePage.confirmDelete'))) return;
    console.log(`✅ Deleting template ${id}`, { timestamp: new Date().toISOString() });
    try {
      const headers = getAuthHeaders();
      const response = await axios.delete(`${API_BASE}/api/templates/${id}`, { headers });
      console.log('✅ Delete success:', { success: response.data.success, timestamp: new Date().toISOString() });
      navigate('/');
    } catch (err) {
      console.error('❌ Error deleting template:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        timestamp: new Date().toISOString(),
      });
      if (err.response?.status === 401 && retryCount < maxRetries) {
        try {
          await refreshToken();
          setRetryCount(prev => prev + 1);
          await handleDelete();
        } catch (refreshErr) {
          console.error('❌ Error retrying delete:', {
            status: refreshErr.response?.status,
            message: refreshErr.response?.data?.message,
            timestamp: new Date().toISOString(),
          });
          setErrorTemplate(t('templatePage.unauthorized'));
          navigate('/login');
        }
      } else {
        setErrorTemplate(
          err.response?.status === 404 ? t('templatePage.notFound') :
          err.response?.status === 429 ? t('templatePage.rateLimit') :
          t('templatePage.deleteError')
        );
      }
    }
  };

  const handleRetry = async (type) => {
    console.log(`✅ Retrying ${type} fetch for template ${id}`, { timestamp: new Date().toISOString() });
    setErrorTemplate(null);
    setErrorResults(null);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (type === 'template' || type === 'all') {
      setLoadingTemplate(true);
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(`${API_BASE}/api/templates/${id}`, { headers });
        const data = res.data.template || res.data;
        if (!data.id) throw new Error('Invalid template data');
        console.log('✅ Retry template fetched:', { title: data.title, questions: data.TemplateQuestions?.length || 0, timestamp: new Date().toISOString() });
        setTemplate(data);
        setLikeCount(data.like_count || 0);
        setIsLiked(data.user_liked || false);
        setRetryCount(0);
      } catch (err) {
        console.error('❌ Error retrying template:', {
          status: err.response?.status,
          message: err.response?.data?.message,
          timestamp: new Date().toISOString(),
        });
        if (err.response?.status === 401 && retryCount < maxRetries) {
          try {
            await refreshToken();
            setRetryCount(prev => prev + 1);
            await handleRetry('template');
          } catch (refreshErr) {
            console.error('❌ Error retrying template after refresh:', {
              status: refreshErr.response?.status,
              message: refreshErr.response?.data?.message,
              timestamp: new Date().toISOString(),
            });
            setErrorTemplate(t('templatePage.unauthorized'));
            navigate('/login');
          }
        } else {
          setErrorTemplate(
            err.response?.status === 404 ? t('templatePage.notFound') :
            err.response?.status === 429 ? t('templatePage.rateLimit') :
            err.response?.status === 500 ? t('templatePage.serverError') :
            t('templatePage.loadTemplateError')
          );
        }
      } finally {
        setLoadingTemplate(false);
      }
    }
    if ((type === 'results' || type === 'all') && user) {
      setLoadingResults(true);
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(`${API_BASE}/api/templates/${id}/results`, { headers });
        console.log('✅ Retry results fetched:', { count: res.data.forms?.length || 0, timestamp: new Date().toISOString() });
        setResults(res.data.forms || []);
        setRetryCount(0);
      } catch (err) {
        console.error('❌ Error retrying results:', {
          status: err.response?.status,
          message: err.response?.data?.message,
          timestamp: new Date().toISOString(),
        });
        if (err.response?.status === 401 && retryCount < maxRetries) {
          try {
            await refreshToken();
            setRetryCount(prev => prev + 1);
            await handleRetry('results');
          } catch (refreshErr) {
            console.error('❌ Error retrying results after refresh:', {
              status: refreshErr.response?.status,
              message: refreshErr.response?.data?.message,
              timestamp: new Date().toISOString(),
            });
            setErrorResults(t('templatePage.unauthorized'));
            navigate('/login');
          }
        } else {
          setErrorResults(
            err.response?.status === 404 ? t('templatePage.noResults') :
            err.response?.status === 403 ? t('templatePage.forbidden') :
            err.response?.status === 429 ? t('templatePage.rateLimit') :
            t('templatePage.loadResultsError')
          );
        }
      } finally {
        setLoadingResults(false);
      }
    }
  };

  const handleFormSubmitSuccess = (msg) => {
    console.log('✅ Form submit success:', { message: msg, timestamp: new Date().toISOString() });
    setFormMessage({ type: 'success', text: t('templatePage.formSubmitSuccess') });
    if (user) {
      handleRetry('results');
    }
  };

  const handleFormSubmitError = (msg) => {
    console.error('❌ Form submit error:', { message: msg, timestamp: new Date().toISOString() });
    setFormMessage({ type: 'danger', text: t('templatePage.formSubmitError') });
  };

  const canFillForm = user && (template?.is_public || template?.user_id === user?.id);
  const canViewResults = user && (template?.user_id === user?.id || user?.is_admin);
  const canEdit = user && template?.user_id === user?.id;

  if (loadingTemplate) {
    return (
      <Container className="text-center my-5">
        <Helmet>
          <title>{t('appName')} - {t('templatePage.loading')}</title>
        </Helmet>
        <Spinner animation="border" aria-label={t('templatePage.loading')} />
      </Container>
    );
  }

  if (errorTemplate || !template) {
    return (
      <Container className="my-4">
        <Helmet>
          <title>{t('appName')} - {t('templatePage.notFound')}</title>
        </Helmet>
        <Alert
          variant="danger"
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setErrorTemplate(null)}
        >
          {errorTemplate || t('templatePage.notFound')}
          <Button
            variant="link"
            onClick={() => handleRetry('template')}
            aria-label={t('templatePage.retry')}
            className="ms-2"
            id="retry-template-button"
          >
            {t('templatePage.retry')}
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className={`my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <Helmet>
        <title>{t('appName')} - {t('templatePage.titlePage', { title: template.title })}</title>
      </Helmet>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 id="template-title">{template.title}</h2>
        <div>
          {template.image_url && (
            <img
              src={template.image_url}
              alt={t('templatePage.imageAlt', { title: template.title })}
              style={{ maxWidth: '200px', marginBottom: '10px' }}
            />
          )}
          <Button
            variant={isLiked ? 'danger' : 'outline-primary'}
            onClick={handleLike}
            disabled={loadingLike}
            aria-label={isLiked ? t('templatePage.unlike') : t('templatePage.like')}
            className="me-2"
            id="like-button"
          >
            {loadingLike ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <>
                {isLiked ? '❤️' : '🤍'} {likeCount}
              </>
            )}
          </Button>
          {canEdit && (
            <>
              <Button
                as={Link}
                to={`/templates/${id}/edit`}
                variant="secondary"
                aria-label={t('templatePage.edit')}
                className="me-2"
                id="edit-button"
              >
                {t('templatePage.edit')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                aria-label={t('templatePage.delete')}
                id="delete-button"
              >
                {t('templatePage.delete')}
              </Button>
            </>
          )}
        </div>
      </div>
      <div>
        <ReactMarkdown>{template.description || ''}</ReactMarkdown>
      </傍

      {formMessage && (
        <Alert
          variant={formMessage.type}
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setFormMessage(null)}
        >
          {formMessage.text}
          {formMessage.type === 'danger' && (
            <Button
              variant="link"
              onClick={() => setFormMessage(null)}
              aria-label={t('templatePage.retry')}
              className="ms-2"
              id="retry-form-button"
            >
              {t('templatePage.retry')}
            </Button>
          )}
        </Alert>
      )}

      {errorLike && (
        <Alert
          variant="danger"
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setErrorLike(null)}
        >
          {errorLike}
          <Button
            variant="link"
            onClick={() => setErrorLike(null)}
            aria-label={t('templatePage.retry')}
            className="ms-2"
            id="retry-like-button"
          >
            {t('templatePage.retry')}
          </Button>
        </Alert>
      )}

      <Nav
        variant="tabs"
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key)}
        role="tablist"
        aria-label={t('templatePage.tabsLabel')}
        id="template-tabs"
      >
        <Nav.Item>
          <Nav.Link
            eventKey="settings"
            role="tab"
            aria-selected={activeTab === 'settings'}
            aria-controls="settings-tab"
            id="settings-tab-link"
          >
            {t('templatePage.settings')}
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            eventKey="questions"
            role="tab"
            aria-selected={activeTab === 'questions'}
            aria-controls="questions-tab"
            id="questions-tab-link"
          >
            {t('templatePage.questions')}
          </Nav.Link>
        </Nav.Item>
        {canViewResults && (
          <Nav.Item>
            <Nav.Link
              eventKey="results"
              role="tab"
              aria-selected={activeTab === 'results'}
              aria-controls="results-tab"
              id="results-tab-link"
            >
              {t('templatePage.results')}
            </Nav.Link>
          </Nav.Item>
        )}
      </Nav>

      <div className="tab-content mt-3">
        {activeTab === 'settings' && (
          <div id="settings-tab" role="tabpanel" aria-labelledby="settings-tab">
            <p>
              <strong>{t('templatePage.isPublic')}:</strong>{' '}
              {template.is_public ? t('templatePage.yes') : t('templatePage.no')}
            </p>
            <p>
              <strong>{t('templatePage.createdBy')}:</strong>{' '}
              {template.User?.name || t('templatePage.unknown')}
            </p>
            {template.Topic && (
              <p>
                <strong>{t('templatePage.topic')}:</strong> {template.Topic.name}
              </p>
            )}
            {template.TemplateTags && template.TemplateTags.length > 0 && (
              <p>
                <strong>{t('templatePage.tags')}:</strong>{' '}
                {template.TemplateTags.map(tag => tag.Tag?.name).filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div id="questions-tab" role="tabpanel" aria-labelledby="questions-tab">
            {template.TemplateQuestions && template.TemplateQuestions.length > 0 && (
              <ListGroup className="mb-3">
                {template.TemplateQuestions.map((question, idx) => (
                  <ListGroup.Item
                    key={question.id}
                    className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                  >
                    <p>
                      <strong>{question.title || t('templatePage.unknownQuestion')}:</strong>{' '}
                      {t(`templatePage.${question.type}`)} {question.state === 'required' ? t('templatePage.required') : t('templatePage.optional')}
                    </p>
                    {question.options && question.options.length > 0 && (
                      <p>
                        <strong>{t('templatePage.options')}:</strong> {question.options.join(', ')}
                      </p>
                    )}
                    {question.attachment_url && (
                      <p>
                        <strong>{t('templatePage.attachment')}:</strong>{' '}
                        <a href={question.attachment_url} target="_blank" rel="noopener noreferrer">
                          {t('templatePage.viewAttachment')}
                        </a>
                      </p>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
            {canFillForm ? (
              <FormFill
                template={template}
                onSuccess={handleFormSubmitSuccess}
                onError={handleFormSubmitError}
              />
            ) : (
              <Alert variant="warning" role="alert" aria-live="assertive">
                {user ? (
                  t('templatePage.noPermission')
                ) : (
                  <>
                    {t('templatePage.loginRequired')}{' '}
                    <Button
                      variant="link"
                      onClick={() => navigate('/login')}
                      aria-label={t('templatePage.login')}
                      className="p-0"
                      id="login-button"
                    >
                      {t('templatePage.login')}
                    </Button>
                  </>
                )}
              </Alert>
            )}
          </div>
        )}

        {activeTab === 'results' && canViewResults && (
          <div id="results-tab" role="tabpanel" aria-labelledby="results-tab">
            {loadingResults ? (
              <Spinner animation="border" aria-label={t('templatePage.loading')} />
            ) : errorResults ? (
              <Alert
                variant="danger"
                role="alert"
                aria-live="assertive"
                dismissible
                onClose={() => setErrorResults(null)}
              >
                {errorResults}
                <Button
                  variant="link"
                  onClick={() => handleRetry('results')}
                  aria-label={t('templatePage.retry')}
                  className="ms-2"
                  id="retry-results-button"
                >
                  {t('templatePage.retry')}
                </Button>
              </Alert>
            ) : results.length > 0 ? (
              <ListGroup aria-label={t('templatePage.resultsList')}>
                {results.map((form) => (
                  <ListGroup.Item
                    key={form.id}
                    className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                  >
                    <p>
                      {t('templatePage.submittedOn', {
                        date: new Date(form.created_at).toLocaleString(),
                      })}
                    </p>
                    {form.FormAnswers?.map((answer, idx) => (
                      <p key={idx}>
                        <strong>{answer.TemplateQuestion?.title || t('templatePage.unknownQuestion')}:</strong> {answer.value}
                      </p>
                    ))}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            ) : (
              <p aria-live="polite">{t('templatePage.noResults')}</p>
            )}
          </div>
        )}
      </div>

      <CommentSection
        templateId={id}
        canComment={!!user}
        onRequireLogin={() => navigate('/login')}
      />
    </Container>
  );
}

export default TemplatePage;
