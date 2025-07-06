import { useState, useEffect, useContext, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form, Button, Alert, Spinner, ListGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

const API_BASE = process.env.REACT_APP_API_URL || 'https://forms-app-9zln.onrender.com';

function CommentSection({ templateId, canComment, onRequireLogin }) {
  const { t } = useTranslation();
  const { user, getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const socketRef = useRef(null);

  // Initialize WebSocket with reconnection logic
  useEffect(() => {
    if (!user || !templateId) return;

    const token = getToken();
    const socket = io(API_BASE, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`✅ WebSocket connected for template ${templateId}, timestamp=${new Date().toISOString()}`);
      socket.emit('joinTemplate', templateId);
    });

    socket.on('comment', (comment) => {
      console.log(`✅ Received comment for template ${templateId}, id=${comment.id}`);
      setComments((prev) => [...prev, comment]);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ WebSocket connection error:', { message: err.message });
      setError(t('comments.socketError'));
    });

    socket.on('reconnect', (attempt) => {
      console.log(`✅ WebSocket reconnected after ${attempt} attempts`);
      socket.emit('joinTemplate', templateId);
    });

    return () => {
      socket.disconnect();
      console.log(`✅ WebSocket disconnected for template ${templateId}`);
    };
  }, [user, templateId, t, getToken]);

  // Fetch comments
  useEffect(() => {
    let isMounted = true;

    const fetchComments = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const token = getToken();
        console.log(`✅ Fetching comments for template ${templateId}, timestamp=${new Date().toISOString()}`);
        const res = await axios.get(`${API_BASE}/api/comments/${templateId}/comments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('✅ Comments fetched:', res.data.comments?.length || 0);
        if (isMounted) {
          setComments(res.data.comments || []);
          setError(null);
        }
      } catch (err) {
        console.error('❌ Error loading comments:', { status: err.response?.status });
        if (isMounted) {
          setError(
            err.response?.status === 404 ? t('comments.noComments') :
            err.response?.status === 429 ? t('comments.rateLimit') :
            t('comments.fetchError')
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchComments();

    return () => {
      isMounted = false;
    };
  }, [templateId, user, t, getToken]);

  // Handle comment submission
  const onSubmit = async (data) => {
    if (!user) {
      setError(t('comments.loginRequired'));
      onRequireLogin();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const token = getToken();
      console.log(`✅ Posting comment for template ${templateId}, timestamp=${new Date().toISOString()}`);
      const res = await axios.post(
        `${API_BASE}/api/comments/${templateId}/comments`,
        { content: data.content.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Comment posted:', res.data.comment.id);
      setComments([...comments, res.data.comment]);
      reset();
    } catch (err) {
      console.error('❌ Error adding comment:', { status: err.response?.status });
      setError(
        err.response?.status === 404 ? t('comments.notFound') :
        err.response?.status === 429 ? t('comments.rateLimit') :
        err.response?.status === 401 ? t('comments.unauthorized') :
        t('comments.submitError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle comment deletion (for admins)
  const handleDelete = async (commentId) => {
    if (!window.confirm(t('comments.deleteConfirm'))) return;
    if (!user) {
      setError(t('comments.loginRequired'));
      onRequireLogin();
      return;
    }

    try {
      const token = getToken();
      console.log(`✅ Deleting comment ${commentId}, timestamp=${new Date().toISOString()}`);
      await axios.delete(`${API_BASE}/api/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ Comment deleted:', commentId);
      setComments(comments.filter((c) => c.id !== commentId));
      setError(null);
    } catch (err) {
      console.error('❌ Error deleting comment:', { status: err.response?.status });
      setError(
        err.response?.status === 401 ? t('comments.unauthorized') :
        err.response?.status === 429 ? t('comments.rateLimit') :
        t('comments.deleteError')
      );
    }
  };

  return (
    <div className={`mt-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <h5 id="comments-title">{t('comments.title')}</h5>
      {loading && (
        <Spinner animation="border" role="status" aria-label={t('comments.loading')} />
      )}
      {error && (
        <Alert variant="danger" role="alert" aria-live="assertive" dismissible onClose={() => setError(null)}>
          {error}
          {error === t('comments.fetchError') && (
            <Button
              variant="link"
              onClick={() => {
                setLoading(true);
                setError(null);
                console.log(`✅ Retrying comments fetch for template ${templateId}, timestamp=${new Date().toISOString()}`);
                const token = getToken();
                axios
                  .get(`${API_BASE}/api/comments/${templateId}/comments`, {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  .then((res) => {
                    console.log('✅ Retry comments fetched:', res.data.comments?.length || 0);
                    setComments(res.data.comments || []);
                    setError(null);
                  })
                  .catch((err) => {
                    console.error('❌ Retry error:', { status: err.response?.status });
                    setError(
                      err.response?.status === 404 ? t('comments.noComments') :
                      err.response?.status === 429 ? t('comments.rateLimit') :
                      t('comments.fetchError')
                    );
                  })
                  .finally(() => setLoading(false));
              }}
              className="ms-2"
              aria-label={t('comments.retry')}
              id="retry-comments-button"
            >
              {t('comments.retry')}
            </Button>
          )}
        </Alert>
      )}

      <div aria-live="polite">
        {comments.length === 0 && !loading && <p>{t('comments.noComments')}</p>}
        <ListGroup className="mb-3">
          {comments.map((c) => (
            <ListGroup.Item
              key={c.id}
              className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
              aria-label={t('comments.comment', { content: c.content, user: c.User?.name || t('comments.anonymous') })}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <strong>{c.User?.name || t('comments.anonymous')}:</strong> {c.content}
                  <br />
                  <small className="text-muted">{new Date(c.created_at).toLocaleString()}</small>
                </div>
                {user?.is_admin && (
                  <Button
                    variant="link"
                    className="text-danger"
                    onClick={() => handleDelete(c.id)}
                    aria-label={t('comments.delete', { content: c.content })}
                    id={`delete-comment-${c.id}`}
                  >
                    {t('comments.delete')}
                  </Button>
                )}
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </div>

      {canComment ? (
        <Form onSubmit={handleSubmit(onSubmit)} aria-label={t('comments.formLabel')} className="mb-3">
          <Form.Group className="mb-3" controlId="commentInput">
            <Form.Label className="visually-hidden">{t('comments.inputLabel')}</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              isInvalid={!!errors.content}
              {...register('content', { required: t('comments.emptyComment'), maxLength: { value: 500, message: t('comments.maxLength') } })}
              placeholder={t('comments.placeholder')}
              aria-label={t('comments.inputLabel')}
              disabled={submitting}
              className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
              id="comment-textarea"
            />
            {errors.content && <Form.Control.Feedback type="invalid">{errors.content.message}</Form.Control.Feedback>}
          </Form.Group>
          <Button
            type="submit"
            variant={theme === 'dark' ? 'outline-light' : 'primary'}
            disabled={submitting}
            aria-label={t('comments.submit')}
            id="submit-comment-button"
          >
            {submitting ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" aria-hidden="true" />
                {t('comments.submitting')}
              </>
            ) : (
              t('comments.submit')
            )}
          </Button>
        </Form>
      ) : (
        <Alert variant="warning" role="alert" aria-live="assertive">
          {t('comments.loginRequired')} <Link to="/login" id="login-link">{t('comments.loginLink')}</Link>
        </Alert>
      )}
    </div>
  );
}

export default CommentSection;