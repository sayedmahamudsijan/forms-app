import { useForm } from 'react-hook-form';
import { useState, useEffect, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

const API_BASE = process.env.REACT_APP_API_URL || 'https://forms-app-9zln.onrender.com';

function FormFill() {
  const { t } = useTranslation();
  const { user, getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formResponse, setFormResponse] = useState(null);
  const [canAccess, setCanAccess] = useState(null);
  const isMounted = useRef(true);
  const retryCount = useRef(0);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!user) {
        setCanAccess(false);
        setError(t('form.noAuth'));
        return;
      }

      setError(null);
      setCanAccess(null);
      try {
        const token = getToken();
        console.log(`✅ Fetching template ${templateId}, timestamp=${new Date().toISOString()}`);
        const res = await axios.get(`${API_BASE}/api/templates/${templateId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('✅ Template fetched:', res.data.template?.title);
        if (isMounted.current) {
          const { template } = res.data;
          const hasPermission = template.is_public || 
            template.user_id === user?.id || 
            template.TemplatePermissions?.some(p => p.user_id === user?.id);
          setTemplate(template);
          setCanAccess(hasPermission);
          if (!hasPermission) {
            setError(t('form.accessDenied'));
          }
        }
      } catch (err) {
        console.error('❌ Fetch error:', { status: err.response?.status });
        if (err.response?.status === 401 && retryCount.current < 3) {
          retryCount.current += 1;
          console.log(`✅ Retrying fetch for template ${templateId}, attempt ${retryCount.current}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchTemplate();
        }
        if (isMounted.current) {
          setCanAccess(false);
          setError(
            err.response?.status === 403 ? t('form.accessDenied') :
            err.response?.status === 401 ? t('form.unauthorized') :
            err.response?.status === 429 ? t('form.rateLimit') :
            err.response?.status === 404 ? t('form.notFound') :
            t('form.accessError')
          );
        }
      }
    };

    fetchTemplate();

    return () => {
      isMounted.current = false;
    };
  }, [templateId, user, t, getToken]);

  const onSubmit = async (data) => {
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const requiredQuestions = (template.TemplateQuestions || []).filter(q => q.state === 'required');
    const answers = (template.TemplateQuestions || []).map(q => {
      const val = data[q.id];
      if (q.state === 'required' && (val === undefined || val === '')) {
        return null;
      }
      let formattedVal;
      switch (q.type) {
        case 'checkbox':
          formattedVal = val ? 'true' : 'false';
          break;
        case 'integer':
        case 'linear_scale':
          formattedVal = val !== undefined && !isNaN(val) ? val.toString() : '';
          break;
        case 'multiple_choice':
        case 'dropdown':
        case 'select':
          formattedVal = val || '';
          break;
        case 'date':
        case 'time':
          formattedVal = val || '';
          break;
        default:
          formattedVal = val || '';
      }
      return { question_id: q.id, value: formattedVal };
    }).filter(Boolean);

    if (answers.length < requiredQuestions.length) {
      setError(t('form.required'));
      setSubmitting(false);
      return;
    }

    try {
      const token = getToken();
      if (!token) throw new Error(t('form.unauthorized'));

      const payload = {
        template_id: parseInt(templateId, 10),
        answers,
        email_copy: data.email_copy || false,
      };

      console.log(`✅ Submitting form for template ${templateId}, timestamp=${new Date().toISOString()}`);
      const res = await axios.post(
        `${API_BASE}/api/forms`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Form submitted:', res.data.form?.id);
      if (isMounted.current) {
        setSuccessMsg(res.data.message || t('form.success'));
        setFormResponse(res.data.form);
        reset();
        setTimeout(() => navigate(`/templates/${templateId}`), 2000);
      }
    } catch (err) {
      console.error('❌ Submit error:', { status: err.response?.status });
      if (err.response?.status === 429 && retryCount.current < 3) {
        retryCount.current += 1;
        console.log(`✅ Retrying form submission, attempt ${retryCount.current}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return onSubmit(data);
      }
      if (isMounted.current) {
        setError(
          err.response?.status === 403 ? t('form.accessDenied') :
          err.response?.status === 401 ? t('form.unauthorized') :
          err.response?.status === 429 ? t('form.rateLimit') :
          err.response?.status === 404 ? t('form.notFound') :
          err.response?.data?.message || t('form.submitError')
        );
      }
    } finally {
      if (isMounted.current) {
        setSubmitting(false);
      }
    }
  };

  if (canAccess === null) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" role="status" aria-label={t('form.loading')} />
      </div>
    );
  }

  if (canAccess === false || !template) {
    return (
      <Alert variant="warning" role="alert" aria-live="assertive" className="mt-5">
        {error || t('form.noAccess')} <Link to="/login" id="login-link">{t('form.loginLink')}</Link>
      </Alert>
    );
  }

  return (
    <div className={`mt-4 ${theme === 'dark' ? 'text-light bg-dark p-4 rounded' : 'p-4'}`}>
      <h3 id="form-title">{t('form.title', { templateTitle: template.title })}</h3>
      {error && (
        <Alert
          variant="danger"
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setError(null)}
        >
          {error}
          {(error === t('form.accessError') || error === t('form.rateLimit')) && (
            <Button
              variant="link"
              onClick={() => {
                setCanAccess(null);
                setError(null);
                isMounted.current = true;
                console.log(`✅ Retrying fetch for template ${templateId}, timestamp=${new Date().toISOString()}`);
                const fetchTemplate = async () => {
                  try {
                    const token = getToken();
                    const res = await axios.get(`${API_BASE}/api/templates/${templateId}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    console.log('✅ Retry template fetched:', res.data.template?.title);
                    if (isMounted.current) {
                      const { template } = res.data;
                      const hasPermission = template.is_public || 
                        template.user_id === user?.id || 
                        template.TemplatePermissions?.some(p => p.user_id === user?.id);
                      setTemplate(template);
                      setCanAccess(hasPermission);
                      if (!hasPermission) {
                        setError(t('form.accessDenied'));
                      }
                    }
                  } catch (err) {
                    console.error('❌ Retry fetch error:', { status: err.response?.status });
                    if (isMounted.current) {
                      setCanAccess(false);
                      setError(
                        err.response?.status === 403 ? t('form.accessDenied') :
                        err.response?.status === 401 ? t('form.unauthorized') :
                        err.response?.status === 429 ? t('form.rateLimit') :
                        err.response?.status === 404 ? t('form.notFound') :
                        t('form.accessError')
                      );
                    }
                  }
                };
                fetchTemplate();
              }}
              className="ms-2"
              aria-label={t('form.retry')}
              id="retry-template-button"
            >
              {t('form.retry')}
            </Button>
          )}
        </Alert>
      )}
      {successMsg && (
        <Alert
          variant="success"
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setSuccessMsg(null)}
        >
          {successMsg}
          {formResponse && (
            <div className="mt-2">
              <strong>{t('form.submittedDetails')}:</strong>
              <ul>
                <li>{t('form.user', { user: user?.name || t('form.anonymous') })}</li>
                <li>{t('form.date', { date: new Date().toLocaleString() })}</li>
              </ul>
            </div>
          )}
        </Alert>
      )}

      <Form
        onSubmit={handleSubmit(onSubmit)}
        aria-label={t('form.formLabel')}
        aria-busy={submitting ? 'true' : 'false'}
      >
        {(template.TemplateQuestions || []).sort((a, b) => a.order - b.order).map((q) => (
          <Form.Group key={q.id} className="mb-3" controlId={`question-${q.id}`}>
            <Form.Label>
              {q.title} {q.state === 'required' && <span className="text-danger">*</span>}
            </Form.Label>
            {q.description && (
              <Form.Text className={`d-block mb-2 ${theme === 'dark' ? 'text-light' : ''}`} id={`desc-${q.id}`}>
                {q.description}
              </Form.Text>
            )}
            {q.attachment_url && (
              <div className="mb-2">
                <strong>{t('form.attachment')}:</strong>{' '}
                <a href={q.attachment_url} target="_blank" rel="noopener noreferrer" id={`attachment-${q.id}`}>
                  {t('form.viewAttachment')}
                </a>
              </div>
            )}

            {q.type === 'string' && (
              <Form.Control
                type="text"
                isInvalid={!!errors[q.id]}
                {...register(q.id, { required: q.state === 'required' ? t('form.required') : false })}
                aria-describedby={q.description ? `desc-${q.id}` : undefined}
                aria-label={t('form.inputLabel', { title: q.title })}
                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                id={`question-input-${q.id}`}
              />
            )}

            {q.type === 'text' && (
              <Form.Control
                as="textarea"
                rows={3}
                isInvalid={!!errors[q.id]}
                {...register(q.id, { required: q.state === 'required' ? t('form.required') : false })}
                aria-describedby={q.description ? `desc-${q.id}` : undefined}
                aria-label={t('form.inputLabel', { title: q.title })}
                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                id={`question-textarea-${q.id}`}
              />
            )}

            {q.type === 'integer' && (
              <Form.Control
                type="number"
                isInvalid={!!errors[q.id]}
                {...register(q.id, {
                  required: q.state === 'required' ? t('form.required') : false,
                  valueAsNumber: true,
                  validate: (value) =>
                    value === undefined || !isNaN(value) ? true : t('form.invalidNumber'),
                })}
                aria-describedby={q.description ? `desc-${q.id}` : undefined}
                aria-label={t('form.inputLabel', { title: q.title })}
                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                id={`question-number-${q.id}`}
              />
            )}

            {q.type === 'checkbox' && (
              <Form.Check
                type="checkbox"
                label={t('form.checkboxLabel', { title: q.title })}
                isInvalid={!!errors[q.id]}
                {...register(q.id)}
                aria-describedby={q.description ? `desc-${q.id}` : undefined}
                aria-label={t('form.inputLabel', { title: q.title })}
                id={`question-checkbox-${q.id}`}
              />
            )}

            {q.type === 'multiple_choice' && (
              <div role="radiogroup" aria-label={t('form.inputLabel', { title: q.title })}>
                {q.options.map((option, index) => (
                  <Form.Check
                    key={index}
                    type="radio"
                    name={`question-${q.id}`}
                    label={option}
                    value={option}
                    isInvalid={!!errors[q.id]}
                    {...register(q.id, { required: q.state === 'required' ? t('form.required') : false })}
                    aria-describedby={q.description ? `desc-${q.id}` : undefined}
                    id={`question-${q.id}-option-${index}`}
                  />
                ))}
              </div>
            )}

            {(q.type === 'dropdown' || q.type === 'select') && (
              <Form.Select
                isInvalid={!!errors[q.id]}
                {...register(q.id, { required: q.state === 'required' ? t('form.required') : false })}
                aria-describedby={q.description ? `desc-${q.id}` : undefined}
                aria-label={t('form.inputLabel', { title: q.title })}
                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                id={`question-select-${q.id}`}
              >
                <option value="">{t('form.selectOption')}</option>
                {q.options.map((option, index) => (
                  <option key={index} value={option}>
                    {option}
                  </option>
                ))}
              </Form.Select>
            )}

            {q.type === 'linear_scale' && (
              <div className="d-flex flex-wrap gap-3" role="radiogroup" aria-label={t('form.inputLabel', { title: q.title })}>
                {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((value) => (
                  <Form.Check
                    key={value}
                    type="radio"
                    name={`question-${q.id}`}
                    label={`${value} ${value === q.min && q.minLabel ? `(${q.minLabel})` : ''}${value === q.max && q.maxLabel ? `(${q.maxLabel})` : ''}`}
                    value={value}
                    isInvalid={!!errors[q.id]}
                    {...register(q.id, { 
                      required: q.state === 'required' ? t('form.required') : false,
                      valueAsNumber: true,
                    })}
                    aria-describedby={q.description ? `desc-${q.id}` : undefined}
                    id={`question-${q.id}-scale-${value}`}
                  />
                ))}
              </div>
            )}

            {q.type === 'date' && (
              <Form.Control
                type="date"
                isInvalid={!!errors[q.id]}
                {...register(q.id, { required: q.state === 'required' ? t('form.required') : false })}
                aria-describedby={q.description ? `desc-${q.id}` : undefined}
                aria-label={t('form.inputLabel', { title: q.title })}
                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                id={`question-date-${q.id}`}
              />
            )}

            {q.type === 'time' && (
              <Form.Control
                type="time"
                isInvalid={!!errors[q.id]}
                {...register(q.id, { required: q.state === 'required' ? t('form.required') : false })}
                aria-describedby={q.description ? `desc-${q.id}` : undefined}
                aria-label={t('form.inputLabel', { title: q.title })}
                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                id={`question-time-${q.id}`}
              />
            )}

            {errors[q.id] && (
              <Form.Control.Feedback type="invalid" className={theme === 'dark' ? 'text-light' : ''}>
                {errors[q.id].message}
              </Form.Control.Feedback>
            )}
          </Form.Group>
        ))}

        <Form.Group className="mb-3" controlId="emailCopy">
          <Form.Check
            type="checkbox"
            label={t('form.emailCopyLabel')}
            {...register('email_copy')}
            aria-label={t('form.emailCopyLabel')}
            id="email-copy-checkbox"
          />
        </Form.Group>

        <Button
          type="submit"
          variant={theme === 'dark' ? 'outline-light' : 'primary'}
          disabled={submitting}
          aria-label={t('form.submit')}
          id="submit-form-button"
        >
          {submitting ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" aria-hidden="true" />
              {t('form.submitting')}
            </>
          ) : (
            t('form.submit')
          )}
        </Button>
      </Form>
    </div>
  );
}

export default FormFill;
