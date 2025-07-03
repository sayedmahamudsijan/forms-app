import React, { useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import TemplateList from '../components/TemplateList';
import AdminPanel from '../components/AdminPanel';
import { Nav, Alert, Button, ListGroup, Spinner, Form, InputGroup } from 'react-bootstrap';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Profile() {
  const { t } = useTranslation();
  const { user, getToken, updateUser } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [forms, setForms] = useState([]);
  const [activeTab, setActiveTab] = useState('templates');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [profileData, setProfileData] = useState({ name: '', email: '', password: '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({ name: user.name || '', email: user.email || '', password: '' });
    }
  }, [user]);

  const fetchData = async () => {
    const token = getToken();
    if (!token || !user) {
      setError(t('profile.login_required'));
      setLoading(false);
      return;
    }
    console.log('✅ Profile fetchData:', { userId: user.id, timestamp: new Date().toISOString() });
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [templatesRes, formsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/templates?user=true`, { headers }),
        axios.get(`${API_BASE}/api/templates/owned/results`, { headers }),
      ]);
      const fetchedTemplates = templatesRes.data.templates || [];
      const fetchedForms = formsRes.data.forms || [];
      console.log('✅ Templates fetched:', fetchedTemplates.length);
      console.log('✅ Forms fetched:', fetchedForms.length);
      setTemplates(fetchedTemplates);
      setForms(fetchedForms);
      if (fetchedForms.length === 0 && formsRes.data.success && formsRes.data.message === 'No forms found for this user') {
        setError(t('profile.noFormsFound'));
      }
    } catch (err) {
      console.error('❌ Failed to fetch profile data:', {
        status: err.response?.status,
        timestamp: new Date().toISOString(),
      });
      setError(
        err.response?.status === 401 ? t('profile.unauthorized') :
        err.response?.status === 429 ? t('profile.rateLimit') :
        err.response?.status === 404 ? t('profile.noFormsFound') :
        t('profile.load_error')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (user && isMounted) {
      fetchData();
    } else {
      setError(t('profile.login_required'));
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [user, t, getToken]);

  const validateProfile = () => {
    const errors = {};
    if (!profileData.name.trim()) {
      errors.name = t('profile.nameRequired');
    }
    if (!profileData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      errors.email = t('profile.emailInvalid');
    }
    if (profileData.password && profileData.password.length < 6) {
      errors.password = t('profile.passwordMinLength');
    }
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!validateProfile()) {
      return;
    }
    setMessage(null);
    console.log('✅ Updating profile:', { name: profileData.name, email: profileData.email, timestamp: new Date().toISOString() });
    try {
      const result = await updateUser(profileData);
      console.log('✅ Profile update success:', result.success);
      setMessage({
        type: result.success ? 'success' : 'danger',
        text: result.success ? t('auth.updateSuccess') : t('auth.updateFailed'),
      });
      if (result.success) {
        setProfileData((prev) => ({ ...prev, password: '' }));
      }
    } catch (err) {
      console.error('❌ Profile update failed:', { status: err.response?.status });
      setMessage({
        type: 'danger',
        text: err.response?.status === 429 ? t('profile.rateLimit') : t('auth.updateFailed'),
      });
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!id) {
      console.error('❌ Invalid template_id:', id);
      setMessage({ type: 'danger', text: t('profile.invalidTemplateId') });
      return;
    }
    if (!window.confirm(t('profile.confirm_delete_template'))) return;
    try {
      const token = getToken();
      console.log(`✅ Deleting template ${id}`);
      const response = await axios.delete(`${API_BASE}/api/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ Delete success:', response.data.success);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setMessage({ type: 'success', text: t('profile.delete_success') });
    } catch (err) {
      console.error('❌ Failed to delete template:', { status: err.response?.status });
      setMessage({
        type: 'danger',
        text: err.response?.status === 401 ? t('profile.unauthorized') :
              err.response?.status === 429 ? t('profile.rateLimit') :
              err.response?.data?.message || t('profile.delete_error'),
      });
    }
  };

  const handleRetry = async () => {
    console.log('✅ Retrying fetch data');
    setLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await fetchData();
  };

  const handleCreateTemplate = () => {
    console.log('✅ Navigating to create template');
    navigate('/templates/new');
  };

  const handleEditTemplate = (id) => {
    if (!id) {
      console.error('❌ Invalid template_id:', id);
      setMessage({ type: 'danger', text: t('profile.invalidTemplateId') });
      return;
    }
    console.log(`✅ Navigating to edit template ${id}`);
    navigate(`/templates/${id}/edit`);
  };

  const handleViewForm = (templateId) => {
    if (!templateId) {
      console.error('❌ Invalid template_id:', templateId);
      setMessage({ type: 'danger', text: t('profile.invalidTemplateId') });
      return;
    }
    console.log(`✅ Navigating to view template ${templateId}`);
    navigate(`/templates/${templateId}`);
  };

  if (!user) {
    return (
      <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
        <Helmet>
          <title>{t('appName')} - {t('profile.titlePage')}</title>
        </Helmet>
        <Alert
          variant="danger"
          role="alert"
          aria-live="assertive"
        >
          {t('profile.login_required')}
          <Button
            variant={theme === 'dark' ? 'outline-light' : 'primary'}
            onClick={() => navigate('/login')}
            className="ms-2"
            aria-label={t('profile.login')}
            id="login-button"
          >
            {t('profile.login')}
          </Button>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center my-5">
        <Helmet>
          <title>{t('appName')} - {t('profile.titlePage')}</title>
        </Helmet>
        <Spinner animation="border" aria-label={t('app.loading')} />
      </div>
    );
  }

  return (
    <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <Helmet>
        <title>{t('appName')} - {t('profile.titlePage')}</title>
      </Helmet>
      <h2 id="profile-title" className="mb-4">
        {t('profile.title')}
      </h2>

      {message && (
        <Alert
          variant={message.type}
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setMessage(null)}
        >
          {message.text}
          {message.type === 'danger' && (
            <Button
              variant="link"
              onClick={() => setMessage(null)}
              aria-label={t('profile.dismiss')}
              className="ms-2"
              id="dismiss-button"
            >
              {t('profile.dismiss')}
            </Button>
          )}
        </Alert>
      )}

      {error && (
        <Alert
          variant="danger"
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setError(null)}
        >
          {error}
          {error !== t('profile.login_required') && (
            <Button
              variant="link"
              onClick={handleRetry}
              aria-label={t('profile.retry')}
              className="ms-2"
              id="retry-button"
            >
              {t('profile.retry')}
            </Button>
          )}
        </Alert>
      )}

      <h4>{t('profile.updateProfile')}</h4>
      <Form onSubmit={handleProfileUpdate} className="mb-4" aria-labelledby="profile-title">
        <Form.Group className="mb-3" controlId="name">
          <Form.Label>{t('profile.name')}</Form.Label>
          <Form.Control
            type="text"
            value={profileData.name}
            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
            placeholder={t('profile.namePlaceholder')}
            aria-label={t('profile.name')}
            isInvalid={!!profileErrors.name}
            id="name-input"
          />
          <Form.Control.Feedback type="invalid">{profileErrors.name}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group className="mb-3" controlId="email">
          <Form.Label>{t('profile.email')}</Form.Label>
          <Form.Control
            type="email"
            value={profileData.email}
            onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
            placeholder={t('profile.emailPlaceholder')}
            aria-label={t('profile.email')}
            isInvalid={!!profileErrors.email}
            id="email-input"
          />
          <Form.Control.Feedback type="invalid">{profileErrors.email}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group className="mb-3" controlId="password">
          <Form.Label>{t('profile.password')}</Form.Label>
          <InputGroup>
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              value={profileData.password}
              onChange={(e) => setProfileData({ ...profileData, password: e.target.value })}
              placeholder={t('profile.passwordPlaceholder')}
              aria-label={t('profile.password')}
              isInvalid={!!profileErrors.password}
              id="password-input"
            />
            <Button
              variant={theme === 'dark' ? 'outline-light' : 'outline-secondary'}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('profile.hidePassword') : t('profile.showPassword')}
            >
              {showPassword ? '🙈' : '👁️'}
            </Button>
          </InputGroup>
          <Form.Control.Feedback type="invalid">{profileErrors.password}</Form.Control.Feedback>
        </Form.Group>
        <Button
          variant={theme === 'dark' ? 'outline-light' : 'primary'}
          type="submit"
          aria-label={t('profile.update')}
          id="update-button"
        >
          {t('profile.update')}
        </Button>
      </Form>

      <Nav
        variant="tabs"
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key)}
        role="tablist"
        aria-label={t('profile.tabs_label')}
        id="profile-tabs"
      >
        <Nav.Item>
          <Nav.Link
            eventKey="templates"
            role="tab"
            aria-selected={activeTab === 'templates'}
            aria-controls="templates-tab"
            id="templates-tab-link"
          >
            {t('profile.templates_tab')}
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            eventKey="forms"
            role="tab"
            aria-selected={activeTab === 'forms'}
            aria-controls="forms-tab"
            id="forms-tab-link"
          >
            {t('profile.forms_tab')}
          </Nav.Link>
        </Nav.Item>
        {user?.is_admin && (
          <Nav.Item>
            <Nav.Link
              eventKey="admin"
              role="tab"
              aria-selected={activeTab === 'admin'}
              aria-controls="admin-tab"
              id="admin-tab-link"
            >
              {t('header.admin')}
            </Nav.Link>
          </Nav.Item>
        )}
      </Nav>

      <div className="tab-content mt-3">
        {activeTab === 'templates' && (
          <div id="templates-tab" role="tabpanel" aria-labelledby="templates-tab-link">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4>{t('profile.templates_heading')}</h4>
              <Button
                variant={theme === 'dark' ? 'outline-light' : 'primary'}
                onClick={handleCreateTemplate}
                aria-label={t('profile.create_template_link')}
                id="create-template-button"
              >
                {t('profile.create_template_link')}
              </Button>
            </div>
            {templates.length === 0 ? (
              <p aria-live="polite">{t('profile.no_templates')}</p>
            ) : (
              <TemplateList
                templates={templates}
                onDelete={handleDeleteTemplate}
                onEdit={handleEditTemplate}
                showActions={true}
                aria-labelledby="templates-tab-link"
              />
            )}
          </div>
        )}

        {activeTab === 'forms' && (
          <div id="forms-tab" role="tabpanel" aria-labelledby="forms-tab-link">
            <h4>{t('profile.forms_heading')}</h4>
            {forms.length === 0 ? (
              <p aria-live="polite">{t('profile.noFormsFound')}</p>
            ) : (
              <ListGroup aria-label={t('profile.forms_list_label')}>
                {forms.map((form) => (
                  <ListGroup.Item
                    key={form.id}
                    action
                    as="button"
                    onClick={() => handleViewForm(form.template_id)}
                    aria-label={t('profile.view_form_link', {
                      title: form.Template?.title || t('profile.unknownForm'),
                      date: new Date(form.created_at).toLocaleString(),
                    })}
                    className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                  >
                    {t('profile.form_submitted', {
                      title: form.Template?.title || t('profile.unknownForm'),
                      date: new Date(form.created_at).toLocaleString(),
                    })}
                    {form.FormAnswers && form.FormAnswers.length > 0 && (
                      <div className="mt-2">
                        <small>{t('profile.answers')}:</small>
                        <ul>
                          {form.FormAnswers.map((answer) => (
                            <li key={answer.id}>
                              {t('profile.answer', {
                                question: answer.TemplateQuestion?.title || t('profile.unknownQuestion'),
                                value: answer.value,
                              })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>
        )}

        {activeTab === 'admin' && user?.is_admin && (
          <div id="admin-tab" role="tabpanel" aria-labelledby="admin-tab-link">
            <AdminPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;