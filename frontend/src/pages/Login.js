import { useContext, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Button, Alert, Spinner, InputGroup, ButtonGroup } from 'react-bootstrap';

function Login() {
  const { t } = useTranslation();
  const { login, loginLoading } = useContext(AuthContext);
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
    console.log('✅ Login attempt:', { email: data.email, timestamp: new Date().toISOString() });
    const res = await login(data.email, data.password);
    console.log('✅ Login response:', { success: res.success, message: res.message });

    if (res.success) {
      setMessage({ type: 'success', text: t('auth.loginSuccess') });
      setTimeout(() => navigate('/'), 1000);
    } else {
      setMessage({
        type: 'danger',
        text: res.status === 429 ? t('auth.rateLimit') : t('auth.loginFailed')
      });
    }
  };

  const handleRetry = async () => {
    console.log('✅ Retrying login');
    setMessage({ type: '', text: '' });
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <Helmet>
        <title>{t('appName')} - {t('login.title')}</title>
      </Helmet>
      <h2 id="login-form" className="mb-4">
        {t('login.title')}
      </h2>
      <Form
        onSubmit={handleSubmit(onSubmit)}
        aria-labelledby="login-form"
        className="col-12 col-md-6 col-lg-4 mx-auto"
        aria-busy={loginLoading ? 'true' : 'false'}
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
                aria-label={t('login.retry')}
                className="ms-2"
                id="retry-button"
              >
                {t('login.retry')}
              </Button>
            )}
          </Alert>
        )}
        <Form.Group className="mb-3" controlId="email">
          <Form.Label>{t('login.email_label')}</Form.Label>
          <Form.Control
            type="email"
            {...register('email', {
              required: t('login.email_required'),
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t('login.email_invalid'),
              },
            })}
            isInvalid={!!errors.email}
            disabled={loginLoading}
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
          <Form.Label>{t('login.password_label')}</Form.Label>
          <InputGroup>
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              {...register('password', {
                required: t('login.password_required'),
                minLength: {
                  value: 6,
                  message: t('login.password_minLength'),
                },
              })}
              isInvalid={!!errors.password}
              disabled={loginLoading}
              aria-describedby="password-error"
              id="password-input"
            />
            <Button
              variant={theme === 'dark' ? 'outline-light' : 'outline-secondary'}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
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
        <ButtonGroup>
          <Button
            type="submit"
            variant={theme === 'dark' ? 'outline-light' : 'primary'}
            disabled={loginLoading}
            aria-busy={loginLoading ? 'true' : 'false'}
            className="me-2"
            id="submit-button"
          >
            {loginLoading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-1"
                />
                {t('login.submitting')}
              </>
            ) : (
              t('login.submit_label')
            )}
          </Button>
          <Link to="/register" className="btn btn-link" aria-label={t('login.register_link')}>
            {t('login.register_link')}
          </Link>
        </ButtonGroup>
      </Form>
    </div>
  );
}

export default Login;