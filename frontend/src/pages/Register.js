import { useContext, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Button, Alert, Spinner, InputGroup } from 'react-bootstrap';

function Register() {
  const { t } = useTranslation();
  const { register: registerUser, registerLoading } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (data) => {
    setMessage({ type: '', text: '' });
    console.log('✅ Register attempt:', { timestamp: new Date().toISOString() });
    const res = await registerUser(data.name, data.email, data.password);
    console.log('✅ Register response:', { success: res.success, message: res.message });
    if (res.success) {
      setMessage({ type: 'success', text: res.message });
      setTimeout(() => navigate('/'), 1000);
    } else {
      setMessage({
        type: 'danger',
        text: res.status === 429 ? t('register.rateLimit') : res.message || t('register.registerFailed'),
      });
    }
  };

  const handleRetry = async () => {
    console.log('✅ Retrying registration');
    setMessage({ type: '', text: '' });
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <Helmet>
        <title>{t('appName')} - {t('register.titlePage')}</title>
      </Helmet>
      <h2 id="register-form" className="mb-4">
        {t('register.title')}
      </h2>
      <Form
        onSubmit={handleSubmit(onSubmit)}
        aria-labelledby="register-form"
        className="col-12 col-md-6 col-lg-4 mx-auto"
        aria-busy={registerLoading ? 'true' : 'false'}
      >
        {message.text && (
          <Alert
            variant={message.type}
            role="alert"
            aria-live="assertive"
            dismissible
            onClose={() => setMessage({ type: '', text: '' })}
          >
            {message.text}
            {message.type === 'danger' && (
              <Button
                variant="link"
                onClick={handleRetry}
                aria-label={t('register.retry')}
                className="ms-2"
                id="retry-button"
              >
                {t('register.retry')}
              </Button>
            )}
          </Alert>
        )}
        <Form.Group className="mb-3" controlId="name">
          <Form.Label>{t('register.name_label')}</Form.Label>
          <Form.Control
            type="text"
            {...register('name', {
              required: t('register.name_required'),
              minLength: {
                value: 2,
                message: t('register.name_minLength'),
              },
            })}
            isInvalid={!!errors.name}
            disabled={registerLoading}
            aria-describedby="name-error"
            id="name-input"
          />
          {errors.name && (
            <Form.Control.Feedback type="invalid" id="name-error">
              {errors.name.message}
            </Form.Control.Feedback>
          )}
        </Form.Group>
        <Form.Group className="mb-3" controlId="email">
          <Form.Label>{t('register.email_label')}</Form.Label>
          <Form.Control
            type="email"
            {...register('email', {
              required: t('register.email_required'),
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t('register.email_invalid'),
              },
            })}
            isInvalid={!!errors.email}
            disabled={registerLoading}
            aria-describedby="email-error"
            id="email-input"
          />
          {errors.email && (
            <Form.Control.Feedback type="invalid" id="email-error">
              {errors.email.message}
            </Form.Control.Feedback>
          )}
        </Form.Group>
        <Form.Group className="mb-3" controlId="password">
          <Form.Label>{t('register.password_label')}</Form.Label>
          <InputGroup>
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              {...register('password', {
                required: t('register.password_required'),
                minLength: {
                  value: 6,
                  message: t('register.password_minLength'),
                },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                  message: t('register.password_pattern'),
                },
              })}
              isInvalid={!!errors.password}
              disabled={registerLoading}
              aria-describedby="password-error"
              id="password-input"
            />
            <Button
              variant={theme === 'dark' ? 'outline-light' : 'outline-secondary'}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('register.hidePassword') : t('register.showPassword')}
            >
              {showPassword ? '🙈' : '👁️'}
            </Button>
          </InputGroup>
          {errors.password && (
            <Form.Control.Feedback type="invalid" id="password-error">
              {errors.password.message}
            </Form.Control.Feedback>
          )}
        </Form.Group>
        <Button
          type="submit"
          variant={theme === 'dark' ? 'outline-light' : 'primary'}
          disabled={registerLoading}
          aria-busy={registerLoading ? 'true' : 'false'}
          className="me-2"
          id="submit-button"
        >
          {registerLoading ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
                className="me-1"
              />
              {t('register.submitting')}
            </>
          ) : (
            t('register.submit_label')
          )}
        </Button>
        <Link to="/login" className="btn btn-link" id="login-link" aria-label={t('register.login_link')}>
          {t('register.login_link')}
        </Link>
      </Form>
    </div>
  );
}

export default Register;