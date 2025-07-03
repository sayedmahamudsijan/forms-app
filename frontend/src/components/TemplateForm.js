import { useForm, Controller } from 'react-hook-form';
import { useState, useEffect, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Alert, Button, Form, Spinner, Image } from 'react-bootstrap';
import Select from 'react-select';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function TemplateForm({ template, onSubmit }) {
  const { t } = useTranslation();
  const { user, getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [topics, setTopics] = useState([]);
  const [tags, setTags] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const isMounted = useRef(true);
  const fetchRetryCount = useRef(0);
  const submitRetryCount = useRef(0);
  const maxRetries = 3;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: template || {
      title: '',
      description: '',
      topic_id: '',
      is_public: true,
      tags: [],
      permissions: [],
      image: null,
      questions: [{
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
    },
  });

  const selectedTags = watch('tags') || [];
  const selectedPermissions = watch('permissions') || [];
  const selectedImage = watch('image');
  const questions = watch('questions') || [];

  // Check authentication
  if (!user) {
    return (
      <Alert variant="warning" role="alert" aria-live="assertive">
        {t('templateForm.noAuth')} <Link to="/login" id="login-link">{t('templateForm.login')}</Link>
      </Alert>
    );
  }

  // Fetch topics, tags, users, and template (if editing)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getToken();
        const config = { headers: { Authorization: `Bearer ${token}` } };
        console.log(`✅ Fetching data: isEdit=${isEdit}, id=${id}, timestamp=${new Date().toISOString()}`);
        const requests = [
          axios.get(`${API_BASE}/api/topics`, config),
          axios.get(`${API_BASE}/api/tags`, config),
          axios.get(`${API_BASE}/api/users?page=1&limit=100`, config),
        ];
        if (isEdit) {
          requests.push(axios.get(`${API_BASE}/api/templates/${id}`, config));
        }

        const [topicsRes, tagsRes, usersRes, templateRes] = await Promise.all(requests);

        if (isMounted.current) {
          console.log('✅ Topics fetched:', topicsRes.data.topics?.length || 0);
          console.log('✅ Tags fetched:', tagsRes.data.tags?.length || 0);
          console.log('✅ Users fetched:', usersRes.data.users?.length || 0);
          if (isEdit) {
            console.log('✅ Template fetched:', templateRes.data.template?.title);
          }
          setTopics(topicsRes.data.topics || []);
          setTags(
            tagsRes.data.tags.map((tag) => ({ value: String(tag.id), label: tag.name })) || []
          );
          setUsers(
            usersRes.data.users
              .filter((u) => u.id !== user.id)
              .map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` })) || []
          );

          if (isEdit && templateRes?.data?.template) {
            reset({
              title: templateRes.data.template.title,
              description: templateRes.data.template.description || '',
              topic_id: String(templateRes.data.template.topic_id) || '',
              is_public: templateRes.data.template.is_public,
              tags: templateRes.data.template.TemplateTags?.map((tt) => String(tt.tag_id)) || [],
              permissions: templateRes.data.template.TemplatePermissions?.map((tp) => String(tp.user_id)) || [],
              image: null,
              questions: templateRes.data.template.TemplateQuestions?.map((q, index) => ({
                id: q.id,
                title: q.title,
                type: q.select_type || q.type,
                select_type: ['multiple_choice', 'dropdown'].includes(q.type) ? q.type : null,
                description: q.description || '',
                required: q.state === 'required',
                is_visible_in_results: q.is_visible_in_results,
                order: q.order || index + 1,
                options: q.options || [],
                min: q.min || 1,
                max: q.max || 5,
                minLabel: q.minLabel || '',
                maxLabel: q.maxLabel || '',
              })) || [],
            });
            if (templateRes.data.template.image_url) {
              setImagePreview(templateRes.data.template.image_url);
            }
          }
          setError(null);
          fetchRetryCount.current = 0;
        }
      } catch (err) {
        console.error('❌ Fetch error:', { status: err.response?.status, timestamp: new Date().toISOString() });
        if (err.response?.status === 429 && fetchRetryCount.current < maxRetries) {
          fetchRetryCount.current += 1;
          console.log(`✅ Retrying fetch, attempt ${fetchRetryCount.current}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * fetchRetryCount.current));
          return fetchData();
        }
        if (isMounted.current) {
          setError(
            err.response?.status === 401 ? t('templateForm.unauthorized') :
            err.response?.status === 429 ? t('templateForm.rateLimit') :
            err.response?.status === 404 && isEdit ? t('templateForm.notFound') :
            t('templateForm.loadError')
          );
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted.current = false;
    };
  }, [id, isEdit, reset, t, user, getToken]);

  // Handle image preview and validation
  useEffect(() => {
    if (selectedImage && selectedImage[0]) {
      const file = selectedImage[0];
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setSubmitError(t('templateForm.imageTooLarge'));
        setValue('image', null);
        setImagePreview(null);
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        setSubmitError(t('templateForm.invalidImage'));
        setValue('image', null);
        setImagePreview(null);
        return;
      }
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      return () => URL.revokeObjectURL(previewUrl);
    } else if (!isEdit || !template?.image_url) {
      setImagePreview(null);
    }
  }, [selectedImage, template, setValue, t, imagePreview]);

  // Add new question
  const addQuestion = () => {
    const newQuestions = [
      ...questions,
      {
        id: `new-${questions.length}`,
        title: '',
        type: 'string',
        select_type: null,
        description: '',
        required: false,
        is_visible_in_results: true,
        order: questions.length + 1,
        options: [],
        min: 1,
        max: 5,
        minLabel: '',
        maxLabel: '',
      },
    ];
    setValue('questions', newQuestions);
  };

  // Remove question
  const removeQuestion = (index) => {
    const newQuestions = questions
      .filter((_, i) => i !== index)
      .map((q, i) => ({ ...q, order: i + 1 }));
    setValue('questions', newQuestions);
  };

  // Handle drag-and-drop
  const onDragEnd = (result) => {
    if (!result.destination) return;
    const newQuestions = Array.from(questions);
    const [reorderedItem] = newQuestions.splice(result.source.index, 1);
    newQuestions.splice(result.destination.index, 0, reorderedItem);
    setValue('questions', newQuestions.map((q, i) => ({ ...q, order: i + 1 })));
    console.log('✅ Reordered questions:', newQuestions.map(q => q.title));
  };

  // Handle form submission
  const handleFormSubmit = async (data) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('description', data.description || '');
      formData.append('topic_id', data.topic_id);
      formData.append('is_public', data.is_public.toString());
      if (data.image && data.image[0]) {
        formData.append('image', data.image[0]);
      }
      data.tags.forEach(tag => formData.append('tags[]', tag));
      data.permissions.forEach(perm => formData.append('permissions[]', perm));
      data.questions.forEach((q, i) => {
        formData.append(`questions[${i}][id]`, q.id && !q.id.startsWith('new-') ? q.id : '');
        formData.append(`questions[${i}][title]`, q.title);
        formData.append(`questions[${i}][type]`, q.select_type || q.type);
        formData.append(`questions[${i}][description]`, q.description || '');
        formData.append(`questions[${i}][required]`, q.required.toString());
        formData.append(`questions[${i}][is_visible_in_results]`, q.is_visible_in_results.toString());
        formData.append(`questions[${i}][order]`, q.order);
        if (q.options?.length) {
          q.options.forEach((opt, j) => formData.append(`questions[${i}][options][${j}]`, opt));
        }
        if (q.type === 'linear_scale') {
          formData.append(`questions[${i}][min]`, q.min);
          formData.append(`questions[${i}][max]`, q.max);
          formData.append(`questions[${i}][minLabel]`, q.minLabel || '');
          formData.append(`questions[${i}][maxLabel]`, q.maxLabel || '');
        }
      });

      console.log(`✅ Submitting template: isEdit=${isEdit}, id=${id}, title=${data.title}, timestamp=${new Date().toISOString()}`);
      const submitFn = onSubmit || (async (formData) => {
        const token = getToken();
        const url = isEdit ? `${API_BASE}/api/templates/${id}` : `${API_BASE}/api/templates`;
        const method = isEdit ? 'put' : 'post';
        return await axios({
          method,
          url,
          data: formData,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
      });

      const res = await submitFn(formData);
      console.log('✅ Template submitted:', res.data.template?.title);
      alert(res.data.message || t('templateForm.success'));
      reset();
      setImagePreview(null);
      navigate(isEdit ? `/templates/${id}` : '/profile');
    } catch (err) {
      console.error('❌ Submit error:', { status: err.response?.status, message: err.response?.data?.message, timestamp: new Date().toISOString() });
      if (err.response?.status === 429 && submitRetryCount.current < maxRetries) {
        submitRetryCount.current += 1;
        console.log(`✅ Retrying submission, attempt ${submitRetryCount.current}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * submitRetryCount.current));
        return handleFormSubmit(data);
      }
      setSubmitError(
        err.response?.status === 400 ? err.response.data.message || t('templateForm.invalidData') :
        err.response?.status === 401 ? t('templateForm.unauthorized') :
        err.response?.status === 403 ? t('templateForm.forbidden') :
        err.response?.status === 429 ? t('templateForm.rateLimit') :
        err.response?.status === 404 && isEdit ? t('templateForm.notFound') :
        t('templateForm.submitError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <Spinner animation="border" aria-label={t('templateForm.loading')} id="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" role="alert" aria-live="assertive" dismissible onClose={() => setError(null)}>
        {error}
        {(error === t('templateForm.loadError') || error === t('templateForm.rateLimit')) && (
          <Button
            variant="link"
            onClick={() => {
              setLoading(true);
              setError(null);
              isMounted.current = true;
              console.log(`✅ Retrying fetch for template data, timestamp=${new Date().toISOString()}`);
              fetchData();
            }}
            aria-label={t('templateForm.retry')}
            id="retry-fetch-button"
          >
            {t('templateForm.retry')}
          </Button>
        )}
      </Alert>
    );
  }

  return (
    <Form
      onSubmit={handleSubmit(handleFormSubmit)}
      encType="multipart/form-data"
      aria-label={t('templateForm.formLabel')}
      aria-busy={submitting ? 'true' : 'false'}
      className={theme === 'dark' ? 'text-light bg-dark p-4 rounded' : 'p-4'}
    >
      {submitError && (
        <Alert
          variant="danger"
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setSubmitError(null)}
          id="submit-error-alert"
        >
          {submitError}
        </Alert>
      )}

      {topics.length === 0 && (
        <Alert variant="warning" role="alert" aria-live="assertive">
          {t('templateForm.noTopics')} {user.is_admin ? (
            <Link to="/admin" id="admin-link">{t('templateForm.addTopics')}</Link>
          ) : (
            t('templateForm.contactAdmin')
          )}
        </Alert>
      )}

      <Form.Group className="mb-3" controlId="title">
        <Form.Label>{t('templateForm.title')}</Form.Label>
        <Form.Control
          type="text"
          isInvalid={!!errors.title}
          {...register('title', { required: t('templateForm.required'), maxLength: { value: 100, message: t('templateForm.titleMaxLength') } })}
          aria-label={t('templateForm.title')}
          className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
          id="title-input"
        />
        <Form.Control.Feedback type="invalid">{errors.title?.message}</Form.Control.Feedback>
      </Form.Group>

      <Form.Group className="mb-3" controlId="description">
        <Form.Label>{t('templateForm.description')}</Form.Label>
        <Form.Control
          as="textarea"
          rows={4}
          {...register('description')}
          aria-label={t('templateForm.description')}
          className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
          id="description-textarea"
        />
        <Form.Text className={theme === 'dark' ? 'text-light' : ''}>
          {t('templateForm.markdownHint')}
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3" controlId="topic_id">
        <Form.Label>{t('templateForm.topic')}</Form.Label>
        <Form.Select
          isInvalid={!!errors.topic_id}
          {...register('topic_id', { required: t('templateForm.required') })}
          aria-label={t('templateForm.topic')}
          className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
          id="topic-select"
        >
          <option value="">{t('templateForm.selectTopic')}</option>
          {topics.map((topic) => (
            <option key={topic.id} value={String(topic.id)}>
              {topic.name}
            </option>
          ))}
        </Form.Select>
        <Form.Control.Feedback type="invalid">{errors.topic_id?.message}</Form.Control.Feedback>
      </Form.Group>

      <Form.Group className="mb-3" controlId="image">
        <Form.Label>{t('templateForm.image')}</Form.Label>
        <Form.Control
          type="file"
          accept="image/jpeg,image/png,image/gif"
          {...register('image')}
          aria-label={t('templateForm.image')}
          className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
          id="image-input"
        />
        {imagePreview && (
          <div className="mt-2">
            <Image
              src={imagePreview}
              alt={t('templateForm.imageAlt')}
              style={{ maxWidth: '200px' }}
              thumbnail
              className={theme === 'dark' ? 'border-light' : ''}
            />
          </div>
        )}
      </Form.Group>

      <Form.Group className="mb-3" controlId="is_public">
        <Form.Check
          type="checkbox"
          label={t('templateForm.public')}
          {...register('is_public')}
          defaultChecked={template?.is_public ?? true}
          aria-label={t('templateForm.public')}
          id="is-public-checkbox"
        />
      </Form.Group>

      <Form.Group className="mb-3" controlId="tags">
        <Form.Label>{t('templateForm.tags')}</Form.Label>
        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              isMulti
              options={tags}
              value={tags.filter((tag) => field.value?.includes(tag.value))}
              onChange={(selected) => field.onChange(selected.map((s) => s.value))}
              aria-label={t('templateForm.tags')}
              classNamePrefix={theme === 'dark' ? 'select-dark' : 'select-light'}
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
              id="tags-select"
            />
          )}
        />
      </Form.Group>

      {!watch('is_public') && (
        <Form.Group className="mb-3" controlId="permissions">
          <Form.Label>{t('templateForm.permissions')}</Form.Label>
          <Controller
            name="permissions"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                isMulti
                options={users}
                value={users.filter((user) => field.value?.includes(user.value))}
                onChange={(selected) => field.onChange(selected.map((s) => s.value))}
                aria-label={t('templateForm.permissions')}
                classNamePrefix={theme === 'dark' ? 'select-dark' : 'select-light'}
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
                id="permissions-select"
              />
            )}
          />
        </Form.Group>
      )}

      <Form.Group className="mb-3">
        <Form.Label>{t('templateForm.questions')}</Form.Label>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="questions">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {questions.map((q, index) => (
                  <Draggable key={q.id || `question-${index}`} draggableId={q.id || `question-${index}`} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`border p-3 mb-2 rounded ${theme === 'dark' ? 'border-light bg-dark' : 'border-light'} ${snapshot.isDragging ? 'bg-light' : ''}`}
                        role="group"
                        aria-label={t('templateForm.question', { index: index + 1 })}
                      >
                        <Form.Group className="mb-2" controlId={`question-${index}-title`}>
                          <Form.Label>{t('templateForm.questionTitle')}</Form.Label>
                          <Form.Control
                            type="text"
                            {...register(`questions.${index}.title`, { required: t('templateForm.required') })}
                            isInvalid={!!errors.questions?.[index]?.title}
                            aria-label={t('templateForm.questionTitle')}
                            className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                            id={`question-${index}-title-input`}
                          />
                          <Form.Control.Feedback type="invalid">
                            {errors.questions?.[index]?.title?.message}
                          </Form.Control.Feedback>
                        </Form.Group>

                        <Form.Group className="mb-2" controlId={`question-${index}-description`}>
                          <Form.Label>{t('templateForm.questionDescription')}</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            {...register(`questions.${index}.description`)}
                            aria-label={t('templateForm.questionDescription')}
                            className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                            id={`question-${index}-description-textarea`}
                          />
                        </Form.Group>

                        <Form.Group className="mb-2" controlId={`question-${index}-type`}>
                          <Form.Label>{t('templateForm.questionType')}</Form.Label>
                          <Form.Select
                            {...register(`questions.${index}.type`, {
                              onChange: (e) => {
                                const value = e.target.value;
                                if (['multiple_choice', 'dropdown'].includes(value)) {
                                  setValue(`questions.${index}.select_type`, value);
                                  setValue(`questions.${index}.type`, 'select');
                                  setValue(`questions.${index}.options`, ['Option 1', 'Option 2']);
                                } else {
                                  setValue(`questions.${index}.select_type`, null);
                                  setValue(`questions.${index}.options`, []);
                                  if (value === 'linear_scale') {
                                    setValue(`questions.${index}.min`, 1);
                                    setValue(`questions.${index}.max`, 5);
                                    setValue(`questions.${index}.minLabel`, 'Low');
                                    setValue(`questions.${index}.maxLabel`, 'High');
                                  } else {
                                    setValue(`questions.${index}.min`, undefined);
                                    setValue(`questions.${index}.max`, undefined);
                                    setValue(`questions.${index}.minLabel`, '');
                                    setValue(`questions.${index}.maxLabel`, '');
                                  }
                                }
                              },
                            })}
                            aria-label={t('templateForm.questionType')}
                            className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                            id={`question-${index}-type-select`}
                          >
                            <option value="string">{t('templateForm.string')}</option>
                            <option value="text">{t('templateForm.text')}</option>
                            <option value="integer">{t('templateForm.integer')}</option>
                            <option value="checkbox">{t('templateForm.checkbox')}</option>
                            <option value="multiple_choice">{t('templateForm.multipleChoice')}</option>
                            <option value="dropdown">{t('templateForm.dropdown')}</option>
                            <option value="linear_scale">{t('templateForm.linearScale')}</option>
                            <option value="date">{t('templateForm.date')}</option>
                            <option value="time">{t('templateForm.time')}</option>
                          </Form.Select>
                        </Form.Group>

                        {(q.type === 'multiple_choice' || q.type === 'dropdown' || q.type === 'select') && (
                          <Form.Group className="mb-2" controlId={`question-${index}-options`}>
                            <Form.Label>{t('templateForm.options')}</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={2}
                              {...register(`questions.${index}.options`, {
                                required: t('templateForm.required'),
                                setValueAs: (value) => value.split('\n').map(o => o.trim()).filter(o => o),
                                validate: (value) => value.length >= 2 || t('templateForm.optionsRequired'),
                              })}
                              placeholder={t('templateForm.optionsPlaceholder')}
                              aria-label={t('templateForm.options')}
                              className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                              id={`question-${index}-options-textarea`}
                            />
                            <Form.Text className={theme === 'dark' ? 'text-light' : ''}>
                              {t('templateForm.optionsHint')}
                            </Form.Text>
                            <Form.Control.Feedback type="invalid">
                              {errors.questions?.[index]?.options?.message}
                            </Form.Control.Feedback>
                          </Form.Group>
                        )}

                        {q.type === 'linear_scale' && (
                          <>
                            <Form.Group className="mb-2" controlId={`question-${index}-min`}>
                              <Form.Label>{t('templateForm.minValue')}</Form.Label>
                              <Form.Control
                                type="number"
                                {...register(`questions.${index}.min`, {
                                  required: t('templateForm.required'),
                                  valueAsNumber: true,
                                  min: { value: 0, message: t('templateForm.minValueMin') },
                                })}
                                isInvalid={!!errors.questions?.[index]?.min}
                                aria-label={t('templateForm.minValue')}
                                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                                id={`question-${index}-min-input`}
                              />
                              <Form.Control.Feedback type="invalid">
                                {errors.questions?.[index]?.min?.message}
                              </Form.Control.Feedback>
                            </Form.Group>
                            <Form.Group className="mb-2" controlId={`question-${index}-max`}>
                              <Form.Label>{t('templateForm.maxValue')}</Form.Label>
                              <Form.Control
                                type="number"
                                {...register(`questions.${index}.max`, {
                                  required: t('templateForm.required'),
                                  valueAsNumber: true,
                                  validate: (value) => value > questions[index]?.min || t('templateForm.maxGreaterThanMin'),
                                })}
                                isInvalid={!!errors.questions?.[index]?.max}
                                aria-label={t('templateForm.maxValue')}
                                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                                id={`question-${index}-max-input`}
                              />
                              <Form.Control.Feedback type="invalid">
                                {errors.questions?.[index]?.max?.message}
                              </Form.Control.Feedback>
                            </Form.Group>
                            <Form.Group className="mb-2" controlId={`question-${index}-minLabel`}>
                              <Form.Label>{t('templateForm.minLabel')}</Form.Label>
                              <Form.Control
                                type="text"
                                {...register(`questions.${index}.minLabel`)}
                                aria-label={t('templateForm.minLabel')}
                                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                                id={`question-${index}-minLabel-input`}
                              />
                            </Form.Group>
                            <Form.Group className="mb-2" controlId={`question-${index}-maxLabel`}>
                              <Form.Label>{t('templateForm.maxLabel')}</Form.Label>
                              <Form.Control
                                type="text"
                                {...register(`questions.${index}.maxLabel`)}
                                aria-label={t('templateForm.maxLabel')}
                                className={theme === 'dark' ? 'bg-dark text-light border-light' : ''}
                                id={`question-${index}-maxLabel-input`}
                              />
                            </Form.Group>
                          </>
                        )}

                        <Form.Group className="mb-2" controlId={`question-${index}-required`}>
                          <Form.Check
                            type="checkbox"
                            label={t('templateForm.isRequired')}
                            {...register(`questions.${index}.required`)}
                            aria-label={t('templateForm.isRequired')}
                            id={`question-${index}-required-checkbox`}
                          />
                        </Form.Group>

                        <Form.Group className="mb-2" controlId={`question-${index}-is_visible_in_results`}>
                          <Form.Check
                            type="checkbox"
                            label={t('templateForm.isVisibleInResults')}
                            {...register(`questions.${index}.is_visible_in_results`)}
                            aria-label={t('templateForm.isVisibleInResults')}
                            id={`question-${index}-visible-checkbox`}
                          />
                        </Form.Group>

                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeQuestion(index)}
                          aria-label={t('templateForm.removeQuestion')}
                          id={`remove-question-${index}-button`}
                        >
                          {t('templateForm.remove')}
                        </Button>
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
          className="mt-2"
          aria-label={t('templateForm.addQuestion')}
          id="add-question-button"
        >
          {t('templateForm.addQuestion')}
        </Button>
      </Form.Group>

      <Button
        type="submit"
        variant={theme === 'dark' ? 'outline-light' : 'primary'}
        disabled={submitting}
        aria-label={t('templateForm.save')}
        id="submit-template-button"
      >
        {submitting ? (
          <>
            <Spinner as="span" animation="border" size="sm" className="me-2" aria-hidden="true" />
            {t('templateForm.submitting')}
          </>
        ) : (
          t('templateForm.save')
        )}
      </Button>
    </Form>
  );

  async function fetchData() {
    try {
      const token = getToken();
      const config = { headers: { Authorization: `Bearer ${token}` } };
      console.log(`✅ Fetching data: isEdit=${isEdit}, id=${id}, timestamp=${new Date().toISOString()}`);
      const requests = [
        axios.get(`${API_BASE}/api/topics`, config),
        axios.get(`${API_BASE}/api/tags`, config),
        axios.get(`${API_BASE}/api/users?page=1&limit=100`, config),
      ];
      if (isEdit) {
        requests.push(axios.get(`${API_BASE}/api/templates/${id}`, config));
      }

      const [topicsRes, tagsRes, usersRes, templateRes] = await Promise.all(requests);

      if (isMounted.current) {
        console.log('✅ Topics fetched:', topicsRes.data.topics?.length || 0);
        console.log('✅ Tags fetched:', tagsRes.data.tags?.length || 0);
        console.log('✅ Users fetched:', usersRes.data.users?.length || 0);
        if (isEdit) {
          console.log('✅ Template fetched:', templateRes.data.template?.title);
        }
        setTopics(topicsRes.data.topics || []);
        setTags(
          tagsRes.data.tags.map((tag) => ({ value: String(tag.id), label: tag.name })) || []
        );
        setUsers(
          usersRes.data.users
            .filter((u) => u.id !== user.id)
            .map((u) => ({ value: String(u.id), label: `${u.name} (${u.email})` })) || []
        );

        if (isEdit && templateRes?.data?.template) {
          reset({
            title: templateRes.data.template.title,
            description: templateRes.data.template.description || '',
            topic_id: String(templateRes.data.template.topic_id) || '',
            is_public: templateRes.data.template.is_public,
            tags: templateRes.data.template.TemplateTags?.map((tt) => String(tt.tag_id)) || [],
            permissions: templateRes.data.template.TemplatePermissions?.map((tp) => String(tp.user_id)) || [],
            image: null,
            questions: templateRes.data.template.TemplateQuestions?.map((q, index) => ({
              id: q.id,
              title: q.title,
              type: q.select_type || q.type,
              select_type: ['multiple_choice', 'dropdown'].includes(q.type) ? q.type : null,
              description: q.description || '',
              required: q.state === 'required',
              is_visible_in_results: q.is_visible_in_results,
              order: q.order || index + 1,
              options: q.options || [],
              min: q.min || 1,
              max: q.max || 5,
              minLabel: q.minLabel || '',
              maxLabel: q.maxLabel || '',
            })) || [],
          });
          if (templateRes.data.template.image_url) {
            setImagePreview(templateRes.data.template.image_url);
          }
        }
        setError(null);
        fetchRetryCount.current = 0;
      }
    } catch (err) {
      console.error('❌ Fetch error:', { status: err.response?.status, timestamp: new Date().toISOString() });
      if (err.response?.status === 429 && fetchRetryCount.current < maxRetries) {
        fetchRetryCount.current += 1;
        console.log(`✅ Retrying fetch, attempt ${fetchRetryCount.current}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * fetchRetryCount.current));
        return fetchData();
      }
      if (isMounted.current) {
        setError(
          err.response?.status === 401 ? t('templateForm.unauthorized') :
          err.response?.status === 429 ? t('templateForm.rateLimit') :
          err.response?.status === 404 && isEdit ? t('templateForm.notFound') :
          t('templateForm.loadError')
        );
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }
}

export default TemplateForm;