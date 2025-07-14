import React, { useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import TemplateList from '../components/TemplateList';
import AdminPanel from '../components/AdminPanel';
import { Nav, Alert, Button, ListGroup, Spinner, Form, InputGroup, Modal } from 'react-bootstrap';

const API_BASE = process.env.REACT_APP_API_URL || 'https://forms-app-9zln.onrender.com';

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
  const [showSalesforceModal, setShowSalesforceModal] = useState(false);
  const [salesforceData, setSalesforceData] = useState({ companyName: '', phone: '', address: '' });
  const [salesforceErrors, setSalesforceErrors] = useState({});
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportData, setSupportData] = useState({ summary: '', priority: 'Low' });
  const [supportErrors, setSupportErrors] = useState({});

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
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [templatesRes, formsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/templates?user=true`, { headers }),
        axios.get(`${API_BASE}/api/templates/owned/results`, { headers }),
      ]);
      setTemplates(templatesRes.data.templates || []);
      setForms(formsRes.data.forms || []);
      if (formsRes.data.forms?.length === 0) {
        setError(t('profile.noFormsFound'));
      }
    } catch (err) {
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
    if (user) fetchData();
    else setError(t('profile.login_required'));
  }, [user, t, getToken]);

  const validateProfile = () => {
    const errors = {};
    if (!profileData.name.trim()) errors.name = t('profile.nameRequired');
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
    if (!validateProfile()) return;
    setMessage(null);
    try {
      const result = await updateUser(profileData);
      setMessage({
        type: result.success ? 'success' : 'danger',
        text: result.success ? t('auth.updateSuccess') : t('auth.updateFailed'),
      });
      if (result.success) setProfileData((prev) => ({ ...prev, password: '' }));
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.status === 429 ? t('profile.rateLimit') : t('auth.updateFailed'),
      });
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!id || !window.confirm(t('profile.confirm_delete_template'))) return;
    try {
      const token = getToken();
      await axios.delete(`${API_BASE}/api/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setMessage({ type: 'success', text: t('profile.delete_success') });
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.status === 401 ? t('profile.unauthorized') :
              err.response?.status === 429 ? t('profile.rateLimit') :
              t('profile.delete_error'),
      });
    }
  };

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await fetchData();
  };

  const handleCreateTemplate = () => navigate('/templates/new');
  const handleEditTemplate = (id) => id && navigate(`/templates/${id}/edit`);
  const handleViewForm = (templateId) => templateId && navigate(`/templates/${templateId}`);

  const validateSalesforce = () => {
    const errors = {};
    if (!salesforceData.companyName.trim()) errors.companyName = t('profile.companyRequired');
    if (!salesforceData.phone.trim() || !/^\+?[\d\s-]{7,}$/.test(salesforceData.phone)) {
      errors.phone = t('profile.phoneInvalid');
    }
    if (!salesforceData.address.trim()) errors.address = t('profile.addressRequired');
    setSalesforceErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSalesforceSync = async (e) => {
    e.preventDefault();
    if (!validateSalesforce()) return;
    setMessage(null);
    try {
      const token = getToken();
      await axios.post(
        `${API_BASE}/api/salesforce/sync`,
        salesforceData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: t('profile.salesforce_sync_success') });
      setShowSalesforceModal(false);
      setSalesforceData({ companyName: '', phone: '', address: '' });
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.status === 401 ? t('profile.unauthorized') :
              err.response?.status === 429 ? t('profile.rateLimit') :
              t('profile.salesforce_sync_failed'),
      });
    }
  };

  const handleGenerateOdooToken = async () => {
    try {
      const token = getToken();
      const res = await axios.post(`${API_BASE}/api/odoo/token`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      updateUser({ ...user, odoo_token: res.data.token });
      setMessage({ type: 'success', text: t('profile.odoo_token_generated') });
    } catch (err) {
      setMessage({ type: 'danger', text: t('profile.odoo_token_failed') });
    }
  };

  const validateSupportTicket = () => {
    const errors = {};
    if (!supportData.summary.trim()) errors.summary = t('profile.summaryRequired');
    setSupportErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSupportTicket = async (e) => {
    e.preventDefault();
    if (!validateSupportTicket()) return;
    setMessage(null);
    try {
      const token = getToken();
      await axios.post(
        `${API_BASE}/api/support/ticket`,
        {
          ...supportData,
          reportedBy: user.email,
          template: activeTab === 'forms' && forms.length > 0 ? forms[0].Template?.title : '',
          link: window.location.href,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: t('profile.support_ticket_success') });
      setShowSupportModal(false);
      setSupportData({ summary: '', priority: 'Low' });
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.status === 401 ? t('profile.unauthorized') :
              err.response?.status === 429 ? t('profile.rateLimit') :
              t('profile.support_ticket_failed'),
      });
    }
  };

  if (!user) {
    return (
      <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
        <Helmet><title>{t('appName')} - {t('profile.titlePage')}</title></Helmet>
        <Alert variant="danger" role="alert" aria-live="assertive">
          {t('profile.login_required')}
          <Button
            variant={theme === 'dark' ? 'outline-light' : 'primary'}
            onClick={() => navigate('/login')}
            className="ms-2"
            aria-label={t('profile.login')}
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
        <Helmet><title>{t('appName')} - {t('profile.titlePage')}</title></Helmet>
        <Spinner animation="border" aria-label={t('app.loading')} />
      </div>
    );
  }

  return (
    <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <Helmet><title>{t('appName')} - {t('profile.titlePage')}</title></Helmet>
      <h2 id="profile-title" className="mb-4">{t('profile.title')}</h2>

      {message && (
        <Alert variant={message.type} role="alert" aria-live="assertive" dismissible onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" role="alert" aria-live="assertive" dismissible onClose={() => setError(null)}>
          {error}
          {error !== t('profile.login_required') && (
            <Button variant="link" onClick={handleRetry} aria-label={t('profile.retry')} className="ms-2">
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
            onChange={(e) => setProfileData({ ...prev, name: e.target.value })}
            placeholder={t('profile.namePlaceholder')}
            aria-label={t('profile.name')}
            isInvalid={!!profileErrors.name}
          />
          <Form.Control.Feedback type="invalid">{profileErrors.name}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group className="mb-3" controlId="email">
          <Form.Label>{t('profile.email')}</Form.Label>
          <Form.Control
            type="email"
            value={profileData.email}
            onChange={(e) => setProfileData({ ...prev, email: e.target.value })}
            placeholder={t('profile.emailPlaceholder')}
            aria-label={t('profile.email')}
            isInvalid={!!profileErrors.email}
          />
          <Form.Control.Feedback type="invalid">{profileErrors.email}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group className="mb-3" controlId="password">
          <Form.Label>{t('profile.password')}</Form.Label>
          <InputGroup>
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              value={profileData.password}
              onChange={(e) => setProfileData({ ...prev, password: e.target.value })}
              placeholder={t('profile.passwordPlaceholder')}
              aria-label={t('profile.password')}
              isInvalid={!!profileErrors.password}
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
        <Button variant={theme === 'dark' ? 'outline-light' : 'primary'} type="submit" aria-label={t('profile.update')}>
          {t('profile.update')}
        </Button>
      </Form>

      {/* Salesforce Modal */}
      <Modal show={showSalesforceModal} onHide={() => setShowSalesforceModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('profile.salesforce_sync_title')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSalesforceSync}>
            <Form.Group className="mb-3" controlId="companyName">
              <Form.Label>{t('profile.companyName')}</Form.Label>
              <Form.Control
                type="text"
                value={salesforceData.companyName}
                onChange={(e) => setSalesforceData({ ...salesforceData, companyName: e.target.value })}
                placeholder={t('profile.companyPlaceholder')}
                isInvalid={!!salesforceErrors.companyName}
              />
              <Form.Control.Feedback type="invalid">{salesforceErrors.companyName}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3" controlId="phone">
              <Form.Label>{t('profile.phone')}</Form.Label>
              <Form.Control
                type="text"
                value={salesforceData.phone}
                onChange={(e) => setSalesforceData({ ...salesforceData, phone: e.target.value })}
                placeholder={t('profile.phonePlaceholder')}
                isInvalid={!!salesforceErrors.phone}
              />
              <Form.Control.Feedback type="invalid">{salesforceErrors.phone}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3" controlId="address">
              <Form.Label>{t('profile.address')}</Form.Label>
              <Form.Control
                type="text"
                value={salesforceData.address}
                onChange={(e) => setSalesforceData({ ...salesforceData, address: e.target.value })}
                placeholder={t('profile.addressPlaceholder')}
                isInvalid={!!salesforceErrors.address}
              />
              <Form.Control.Feedback type="invalid">{salesforceErrors.address}</Form.Control.Feedback>
            </Form.Group>
            <Button variant="primary" type="submit">{t('profile.submit')}</Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Support Ticket Modal */}
      <Modal show={showSupportModal} onHide={() => setShowSupportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('profile.support_ticket_title')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSupportTicket}>
            <Form.Group className="mb-3" controlId="summary">
              <Form.Label>{t('profile.summary')}</Form.Label>
              <Form.Control
                type="text"
                value={supportData.summary}
                onChange={(e) => setSupportData({ ...supportData, summary: e.target.value })}
                placeholder={t('profile.summaryPlaceholder')}
                isInvalid={!!supportErrors.summary}
              />
              <Form.Control.Feedback type="invalid">{supportErrors.summary}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3" controlId="priority">
              <Form.Label>{t('profile.priority')}</Form.Label>
              <Form.Select
                value={supportData.priority}
                onChange={(e) => setSupportData({ ...supportData, priority: e.target.value })}
              >
                <option value="Low">{t('profile.priorityLow')}</option>
                <option value="Average">{t('profile.priorityAverage')}</option>
                <option value="High">{t('profile.priorityHigh')}</option>
              </Form.Select>
            </Form.Group>
            <Button variant="primary" type="submit">{t('profile.submit')}</Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Nav variant="tabs" activeKey={activeTab} onSelect={setActiveTab} role="tablist" aria-label={t('profile
System: .tabs_label')}>
        <Nav.Item>
          <Nav.Link eventKey="templates" role="tab" aria-selected={activeTab === 'templates'} aria-controls="templates-tab">
            {t('profile.templates_tab')}
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="forms" role="tab" aria-selected={activeTab === 'forms'} aria-controls="forms-tab">
            {t('profile.forms_tab')}
          </Nav.Link>
        </Nav.Item>
        {user?.is_admin && (
          <Nav.Item>
            <Nav.Link eventKey="admin" role="tab" aria-selected={activeTab === 'admin'} aria-controls="admin-tab">
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
              >
                {t('profile.create_template_link{SEPARATOR}link')}
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
            {/* Salesforce Integration */}
            <div className="my-4">
              <h5>{t('profile.salesforce_integration_title')}</h5>
              <Button
                variant={theme === 'dark' ? 'outline-light' : 'secondary'}
                onClick={() => setShowSalesforceModal(true)}
                aria-label={t('profile.salesforce_sync_button')}
              >
                {t('profile.salesforce_sync_button')}
              </Button>
            </div>
            {/* Odoo Integration */}
            <div className="my-4">
              <h5>{t('profile.odoo_integration_title')}</h5>
              <Form.Group className="mb-2">
                <Form.Label>{t('profile.odoo_token')}</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={user?.odoo_token || ''}
                    readOnly
                    aria-label={t('profile.odoo_token')}
                  />
                  <Button
                    variant={theme === 'dark' ? 'outline-light' : 'outline-secondary'}
                    onClick={handleGenerateOdooToken}
                    aria-label={t('profile.generate_token')}
                  >
                    {t('profile.generate_token')}
                  </Button>
                </InputGroup>
              </Form.Group>
            </div>
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

      {/* Support Ticket Button */}
      <div className="my-4">
        <Button
          variant={theme === 'dark' ? 'outline-light' : 'secondary'}
          onClick={() => setShowSupportModal(true)}
          aria-label={t('profile.support_ticket_button')}
        >
          {t('profile.support_ticket_button')}
        </Button>
      </div>
    </div>
  );
}

export default Profile;
