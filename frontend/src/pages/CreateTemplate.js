import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Helmet } from 'react-helmet';
import { Form, Button, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Select from 'react-select';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function CreateTemplate() {
  const { t } = useTranslation();
  const { user, getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [tags, setTags] = useState([]);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    topic_id: '',
    is_public: false,
    tags: [],
    permissions: [],
    questions: [{
      type: 'string',
      title: '',
      required: false,
 Jovisible_in_results: true,
      options: [],
      select_type: null,
      min: 1,
      max: 5,
      minLabel: '',
      maxLabel: ''
    }],
    image: null,
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = user ? getToken() : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [topicsRes, tagsRes, usersRes] = await Promise.all([
          axios.get(`${API_BASE}/api/topics`, { headers }),
          axios.get(`${API_BASE}/api/tags`, { headers }),
          user ? axios.get(`${API_BASE}/api/users?page=1&limit=100`, { headers }) : Promise.resolve({ data: { users: [] } }),
        ]);
        if (isMounted) {
          setTopics(topicsRes.data.topics || []);
          setTags(tagsRes.data.tags.map(t => ({ value: String(t.id), label: t.name })) || []);
          setUsers(usersRes.data.users.filter(u => u.id !== user?.id).map(u => ({ value: String(u.id), label: `${u.name} (${u.email})` })) || []);
          console.log('✅ Fetched data:', {
            topics: topicsRes.data.topics?.length,
            tags: tagsRes.data.tags?.length,
            users: usersRes.data.users?.length,
            timestamp: new Date().toISOString(),
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('❌ Error fetching data:', { status: err.response?.status, timestamp: new Date().toISOString() });
        setSubmitError(
          err.response?.status === 401 ? t('createTemplate.unauthorized') :
          err.response?.status === 429 ? t('createTemplate.rateLimit') :
          t('createTemplate.loadError')
        );
        setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [user, getToken, t]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        setErrors((prev) => ({ ...prev, image: t('createTemplate.invalidImage') }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, image: t('createTemplate.imageTooLarge') }));
        return;
      }
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setFormData((prev) => ({ ...prev, image: file }));
      setImagePreview(URL.createObjectURL(file));
      setErrors((prev) => ({ ...prev, image: '' }));
    }
  };

  const handleTagChange = (selectedOptions) => {
    const newTags = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    setFormData((prev) => ({ ...prev, tags: newTags }));
    console.log('✅ Updated tags:', newTags);
  };

  const handlePermissionChange = (selectedOptions) => {
    const newPermissions = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
    setFormData((prev) => ({ ...prev, permissions: newPermissions }));
    console.log('✅ Updated permissions:', newPermissions);
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...formData.questions];
    if (field === 'options') {
      newQuestions[index] = { ...newQuestions[index], options: value.split(',').map(o => o.trim()).filter(o => o) };
    } else if (field === 'type') {
      const isSelect = ['multiple_choice', 'dropdown'].includes(value);
      newQuestions[index] = {
        ...newQuestions[index],
        type: isSelect ? 'select' : value,
        select_type: isSelect ? value : null,
        options: isSelect ? ['Option 1', 'Option 2'] : [],
        min: value === 'linear_scale' ? 1 : undefined,
        max: value === 'linear_scale' ? 5 : undefined,
        minLabel: value === 'linear_scale' ? 'Low' : '',
        maxLabel: value === 'linear_scale' ? 'High' : '',
      };
    } else {
      newQuestions[index] = { ...newQuestions[index], [field]: value };
    }
    setFormData((prev) => ({ ...prev, questions: newQuestions }));
    setErrors((prev) => ({ ...prev, [`question${index}`]: '' }));
  };

  const addQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      questions: [...prev.questions, {
        type: 'string',
        title: '',
        required: false,
        is_visible_in_results: true,
        options: [],
        select_type: null,
        min: 1,
        max: 5,
        minLabel: '',
        maxLabel: ''
      }],
    }));
  };

  const removeQuestion = (index) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[`question${index}`];
      return newErrors;
    });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const newQuestions = [...formData.questions];
    const [reorderedItem] = newQuestions.splice(result.source.index, 1);
    newQuestions.splice(result.destination.index, 0, reorderedItem);
    setFormData((prev) => ({ ...prev, questions: newQuestions }));
    console.log('✅ Reordered questions:', newQuestions.map(q => q.title));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setSubmitError(t('createTemplate.loginRequired'));
      return;
    }
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = t('createTemplate.titleRequired');
    if (!formData.topic_id) newErrors.topic_id = t('createTemplate.topicRequired');
    if (formData.image && formData.image.size > 5 * 1024 * 1024) newErrors.image = t('createTemplate.imageTooLarge');
    formData.questions.forEach((q, i) => {
      if (!q.title.trim()) newErrors[`question${i}`] = t('createTemplate.questionsRequired');
      if (q.type === 'select' && (!q.options || q.options.length < 2)) {
        newErrors[`question${i}`] = t('createTemplate.optionsRequired');
      }
      if (q.type === 'linear_scale' && (isNaN(q.min) || isNaN(q.max) || q.min >= q.max)) {
        newErrors[`question${i}`] = t('createTemplate.scaleInvalid');
      }
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setIsSubmitting(true);
    try {
      const token = getToken();
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('topic_id', formData.topic_id);
      formDataToSend.append('is_public', formData.is_public.toString());
      formData.tags.forEach(tag => formDataToSend.append('tags[]', tag));
      formData.permissions.forEach(perm => formDataToSend.append('permissions[]', perm));
      formData.questions.forEach((q, i) => {
        formDataToSend.append(`questions[${i}][title]`, q.title);
        formDataToSend.append(`questions[${i}][type]`, q.select_type || q.type);
        formDataToSend.append(`questions[${i}][required]`, q.required.toString());
        formDataToSend.append(`questions[${i}][is_visible_in_results]`, q.is_visible_in_results.toString());
        formDataToSend.append(`questions[${i}][order]`, i + 1);
        if (q.options.length) {
          q.options.forEach((opt, j) => formDataToSend.append(`questions[${i}][options][${j}]`, opt));
        }
        if (q.type === 'linear_scale') {
          formDataToSend.append(`questions[${i}][min]`, q.min);
          formDataToSend.append(`questions[${i}][max]`, q.max);
          formDataToSend.append(`questions[${i}][minLabel]`, q.minLabel || '');
          formDataToSend.append(`questions[${i}][maxLabel]`, q.maxLabel || '');
        }
      });
      if (formData.image) formDataToSend.append('image', formData.image);

      // Log FormData contents for debugging
      const formDataEntries = {};
      for (const [key, value] of formDataToSend.entries()) {
        formDataEntries[key] = value instanceof File ? `File: ${value.name}` : value;
      }
      console.log('✅ Submitting template:', {
        ...formDataEntries,
        timestamp: new Date().toISOString(),
      });

      const response = await axios.post(`${API_BASE}/api/templates`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('✅ Template created:', response.data);
      navigate(`/templates/${response.data.template.id}`);
    } catch (err) {
      console.error('❌ Error creating template:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        timestamp: new Date().toISOString(),
      });
      setSubmitError(
        err.response?.status === 400 ? err.response?.data?.message || t('createTemplate.invalidData') :
        err.response?.status === 401 ? t('createTemplate.unauthorized') :
        err.response?.status === 403 ? t('createTemplate.forbidden') :
        err.response?.status === 429 ? t('createTemplate.rateLimit') :
        err.response?.data?.message || t('createTemplate.submitError')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
        <Helmet>
          <title>{t('appName')} - {t('createTemplate.title')}</title>
        </Helmet>
        <Alert variant="warning">{t('createTemplate.loginRequired')}</Alert>
        <Button as="a" href="/login" variant={theme === 'dark' ? 'outline-light' : 'primary'}>
          {t('createTemplate.login')}
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
        <Helmet>
          <title>{t('appName')} - {t('createTemplate.title')}</title>
        </Helmet>
        <Spinner animation="border" aria-label={t('app.loading')} />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
        <Helmet>
          <title>{t('appName')} - {t('createTemplate.title')}</title>
        </Helmet>
        <Alert variant="warning">{t('createTemplate.noTopicsAvailable')}</Alert>
        {user.is_admin && (
          <Button as="a" href="/admin" variant={theme === 'dark' ? 'outline-light' : 'primary'}>
            {t('createTemplate.adminPanel')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <Helmet>
        <title>{t('appName')} - {t('createTemplate.title')}</title>
      </Helmet>
      <h2>{t('createTemplate.title')}</h2>
      {submitError && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setSubmitError(null)}
          aria-live="assertive"
        >
          {submitError}
          <Button
            variant="link"
            onClick={() => setSubmitError(null)}
            aria-label={t('createTemplate.retry')}
          >
            {t('createTemplate.retry')}
          </Button>
        </Alert>
      )}
      <Form onSubmit={handleSubmit} aria-label={t('createTemplate.title')}>
        <Form.Group className="mb-3" controlId="title">
          <Form.Label>{t('createTemplate.titleLabel')}</Form.Label>
          <Form.Control
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            isInvalid={!!errors.title}
            placeholder={t('createTemplate.titlePlaceholder')}
            aria-describedby="title-error"
          />
          <Form.Control.Feedback type="invalid">
            {errors.title}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group className="mb-3" controlId="description">
          <Form.Label>{t('createTemplate.descriptionLabel')}</Form.Label>
          <Form.Control
            as="textarea"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder={t('createTemplate.descriptionPlaceholder')}
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="image">
          <Form.Label>{t('createTemplate.imageLabel')}</Form.Label>
          <Form.Control
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={handleImageChange}
            isInvalid={!!errors.image}
            aria-describedby="image-error"
          />
          {imagePreview && (
            <img
              src={imagePreview}
              alt={t('createTemplate.imagePreview')}
              style={{ maxWidth: '200px', marginTop: '10px' }}
            />
          )}
          <Form.Control.Feedback type="invalid">
            {errors.image}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group className="mb-3" controlId="topic_id">
          <Form.Label>{t('createTemplate.topicLabel')}</Form.Label>
          <Form.Select
            name="topic_id"
            value={formData.topic_id}
            onChange={handleInputChange}
            isInvalid={!!errors.topic_id}
            aria-describedby="topic-error"
          >
            <option value="">{t('createTemplate.selectTopic')}</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </Form.Select>
          <Form.Control.Feedback type="invalid">
            {errors.topic_id}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group className="mb-3" controlId="is_public">
          <Form.Check
            type="checkbox"
            name="is_public"
            checked={formData.is_public}
            onChange={handleInputChange}
            label={t('createTemplate.isPublic')}
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="tags">
          <Form.Label>{t('createTemplate.tagsLabel')}</Form.Label>
          <Select
            isMulti
            options={tags}
            value={tags.filter(t => formData.tags.includes(t.value))}
            onChange={handleTagChange}
            placeholder={t('createTemplate.tagsPlaceholder')}
            aria-label={t('createTemplate.tagsLabel')}
            classNamePrefix="react-select"
            styles={{
              control: (base) => ({
                ...base,
                backgroundColor: theme === 'dark' ? '#343a40' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                borderColor: theme === 'dark' ? '#495057' : '#ced4da',
              }),
              menu: (base) => ({
                ...base,
                backgroundColor: theme === 'dark' ? '#343a40' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
              }),
            }}
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="permissions">
          <Form.Label>{t('createTemplate.permissionsLabel')}</Form.Label>
          <Select
            isMulti
            options={users}
            value={users.filter(u => formData.permissions.includes(u.value))}
            onChange={handlePermissionChange}
            placeholder={t('createTemplate.permissionsPlaceholder')}
            aria-label={t('createTemplate.permissionsLabel')}
            classNamePrefix="react-select"
            styles={{
              control: (base) => ({
                ...base,
                backgroundColor: theme === 'dark' ? '#343a40' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
                borderColor: theme === 'dark' ? '#495057' : '#ced4da',
              }),
              menu: (base) => ({
                ...base,
                backgroundColor: theme === 'dark' ? '#343a40' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
              }),
            }}
          />
        </Form.Group>
        <h3>{t('createTemplate.questionsLabel')}</h3>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="questions">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {formData.questions.map((question, index) => (
                  <Draggable key={`question-${index}`} draggableId={`question-${index}`} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="mb-3 border p-3 rounded"
                      >
                        <InputGroup>
                          <Form.Select
                            value={question.type === 'select' ? question.select_type || 'multiple_choice' : question.type}
                            onChange={(e) => handleQuestionChange(index, 'type', e.target.value)}
                            aria-label={t('createTemplate.question_label', { index: index + 1 })}
                          >
                            <option value="string">{t('createTemplate.string')}</option>
                            <option value="text">{t('createTemplate.text')}</option>
                            <option value="integer">{t('createTemplate.integer')}</option>
                            <option value="checkbox">{t('createTemplate.checkbox')}</option>
                            <option value="multiple_choice">{t('createTemplate.multiple_choice')}</option>
                            <option value="dropdown">{t('createTemplate.dropdown')}</option>
                            <option value="linear_scale">{t('createTemplate.linear_scale')}</option>
                            <option value="date">{t('createTemplate.date')}</option>
                            <option value="time">{t('createTemplate.time')}</option>
                          </Form.Select>
                          <Form.Control
                            value={question.title}
                            onChange={(e) => handleQuestionChange(index, 'title', e.target.value)}
                            placeholder={t('createTemplate.questionTitle')}
                            isInvalid={!!errors[`question${index}`]}
                            aria-describedby={`question${index}-error`}
                          />
                          <Button
                            variant="danger"
                            onClick={() => removeQuestion(index)}
                            aria-label={t('createTemplate.remove')}
                          >
                            {t('createTemplate.remove')}
                          </Button>
                        </InputGroup>
                        <Form.Group className="mt-2" controlId={`required-${index}`}>
                          <Form.Check
                            type="checkbox"
                            label={t('createTemplate.required')}
                            checked={question.required}
                            onChange={(e) => handleQuestionChange(index, 'required', e.target.checked)}
                          />
                        </Form.Group>
                        <Form.Group className="mt-2" controlId={`visible-${index}`}>
                          <Form.Check
                            type="checkbox"
                            label={t('createTemplate.visibleInResults')}
                            checked={question.is_visible_in_results}
                            onChange={(e) => handleQuestionChange(index, 'is_visible_in_results', e.target.checked)}
                          />
                        </Form.Group>
                        {question.type === 'select' && (
                          <Form.Group className="mt-2" controlId={`options-${index}`}>
                            <Form.Label>{t('createTemplate.optionsLabel')}</Form.Label>
                            <Form.Control
                              value={question.options.join(', ')}
                              onChange={(e) => handleQuestionChange(index, 'options', e.target.value)}
                              placeholder={t('createTemplate.optionsPlaceholder')}
                              aria-label={t('createTemplate.optionsLabel')}
                            />
                          </Form.Group>
                        )}
                        {question.type === 'linear_scale' && (
                          <div className="mt-2">
                            <Form.Group className="d-flex gap-3">
                              <Form.Group controlId={`min-${index}`}>
                                <Form.Label>{t('createTemplate.minLabel')}</Form.Label>
                                <Form.Control
                                  type="number"
                                  value={question.min}
                                  onChange={(e) => handleQuestionChange(index, 'min', parseInt(e.target.value))}
                                  aria-label={t('createTemplate.minLabel')}
                                />
                              </Form.Group>
                              <Form.Group controlId={`max-${index}`}>
                                <Form.Label>{t('createTemplate.maxLabel')}</Form.Label>
                                <Form.Control
                                  type="number"
                                  value={question.max}
                                  onChange={(e) => handleQuestionChange(index, 'max', parseInt(e.target.value))}
                                  aria-label={t('createTemplate.maxLabel')}
                                />
                              </Form.Group>
                            </Form.Group>
                            <Form.Group className="mt-2" controlId={`minLabel-${index}`}>
                              <Form.Label>{t('createTemplate.minLabelText')}</Form.Label>
                              <Form.Control
                                value={question.minLabel}
                                onChange={(e) => handleQuestionChange(index, 'minLabel', e.target.value)}
                                placeholder={t('createTemplate.minLabelPlaceholder')}
                                aria-label={t('createTemplate.minLabelText')}
                              />
                            </Form.Group>
                            <Form.Group className="mt-2" controlId={`maxLabel-${index}`}>
                              <Form.Label>{t('createTemplate.maxLabelText')}</Form.Label>
                              <Form.Control
                                value={question.maxLabel}
                                onChange={(e) => handleQuestionChange(index, 'maxLabel', e.target.value)}
                                placeholder={t('createTemplate.maxLabelPlaceholder')}
                                aria-label={t('createTemplate.maxLabelText')}
                              />
                            </Form.Group>
                          </div>
                        )}
                        {errors[`question${index}`] && (
                          <Form.Control.Feedback type="invalid" className="d-block">
                            {errors[`question${index}`]}
                          </Form.Control.Feedback>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <Button
          variant={theme === 'dark' ? 'outline-light' : 'primary'}
          onClick={addQuestion}
          className="mb-3"
          aria-label={t('createTemplate.addQuestion')}
        >
          {t('createTemplate.addQuestion')}
        </Button>
        <Button
          type="submit"
          variant={theme === 'dark' ? 'outline-light' : 'primary'}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          id="submit-template-button"
        >
          {isSubmitting ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
              {t('createTemplate.submitting')}
            </>
          ) : (
            t('createTemplate.submit')
          )}
        </Button>
      </Form>
    </div>
  );
}

export default CreateTemplate;