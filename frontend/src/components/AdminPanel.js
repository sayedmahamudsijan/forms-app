import { useState, useEffect, useContext, useCallback } from 'react';
import { useTable } from 'react-table';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Table, Alert, Button, Spinner, Dropdown, Form } from 'react-bootstrap';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AdminPanel() {
  const { t } = useTranslation();
  const { user, getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [topicSubmitting, setTopicSubmitting] = useState(false);
  const [topicError, setTopicError] = useState(null);
  const [topicSuccess, setTopicSuccess] = useState(null);
  const pageSize = 10;
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  // Fetch users with pagination
  const fetchUsers = useCallback(async () => {
    if (!user) {
      setError(t('admin.unauthorized', { defaultValue: 'Unauthorized access' }));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      console.log(`✅ Fetching users: page=${page}, limit=${pageSize}, timestamp=${new Date().toISOString()}`);
      const res = await axios.get(`${API_BASE}/api/users?page=${page}&limit=${pageSize}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ Users fetched:', res.data.users?.length || 0);
      setUsers(res.data.users || []);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error('❌ Error fetching users:', { status: err.response?.status });
      setError(
        err.response?.status === 401 ? t('admin.unauthorized', { defaultValue: 'Unauthorized access' }) :
        err.response?.status === 429 ? t('admin.rateLimit', { defaultValue: 'Rate limit exceeded' }) :
        t('admin.fetchError', { defaultValue: 'Failed to fetch users' })
      );
    } finally {
      setLoading(false);
    }
  }, [page, t, user, getToken]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Add new topic
  const onAddTopic = async (data) => {
    setTopicSubmitting(true);
    setTopicError(null);
    setTopicSuccess(null);
    try {
      const token = getToken();
      console.log(`✅ Adding topic: ${data.name.trim()}, timestamp=${new Date().toISOString()}`);
      const res = await axios.post(
        `${API_BASE}/api/topics`,
        { name: data.name.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Topic added:', res.data.message);
      setTopicSuccess(res.data.message || t('admin.topicSuccess', { defaultValue: 'Topic added successfully' }));
      reset();
    } catch (err) {
      console.error('❌ Error adding topic:', { status: err.response?.status });
      setTopicError(
        err.response?.status === 401 ? t('admin.unauthorized', { defaultValue: 'Unauthorized access' }) :
        err.response?.status === 429 ? t('admin.rateLimit', { defaultValue: 'Rate limit exceeded' }) :
        err.response?.status === 409 ? t('admin.topicConflict', { defaultValue: 'Topic already exists' }) :
        t('admin.topicError', { defaultValue: 'Failed to add topic' })
      );
    } finally {
      setTopicSubmitting(false);
    }
  };

  // Update user status with retry logic
  const updateUserStatus = async (id, data, isSelfAdminToggle = false, retryCount = 0) => {
    if (isSelfAdminToggle && !window.confirm(t('admin.confirmSelfAdminRemoval', { defaultValue: 'Are you sure you want to remove your own admin status?' }))) {
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(id));
    setMessage(null);
    try {
      const token = getToken();
      console.log(`✅ Updating user ${id}:`, { data, timestamp: new Date().toISOString() });
      const res = await axios.put(`${API_BASE}/api/users/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ Update user success:', res.data.message);
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === id ? { ...u, ...data, version: u.version + 1 } : u))
      );
      setMessage({ type: 'success', text: res.data.message || t('admin.updateSuccess', { defaultValue: 'User updated successfully' }) });
    } catch (err) {
      console.error('❌ Error updating user:', { status: err.response?.status });
      if (err.response?.status === 409 && retryCount < 3) {
        console.log(`✅ Retrying update for user ${id}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return updateUserStatus(id, data, isSelfAdminToggle, retryCount + 1);
      }
      setMessage({
        type: 'danger',
        text: err.response?.status === 401 ? t('admin.unauthorized', { defaultValue: 'Unauthorized access' }) :
              err.response?.status === 429 ? t('admin.rateLimit', { defaultValue: 'Rate limit exceeded' }) :
              err.response?.status === 409 ? t('admin.conflictError', { defaultValue: 'Update conflict occurred' }) :
              err.response?.data?.message || t('admin.updateError', { defaultValue: 'Failed to update user' }),
      });
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Delete user with retry logic
  const deleteUser = async (id, name, retryCount = 0) => {
    if (!window.confirm(t('admin.confirmDelete', { defaultValue: 'Are you sure you want to delete user {{name}}?', name }))) return;
    setUpdatingIds((prev) => new Set(prev).add(id));
    setMessage(null);
    try {
      const token = getToken();
      console.log(`✅ Deleting user ${id}, timestamp=${new Date().toISOString()}`);
      await axios.delete(`${API_BASE}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ User deleted:', id);
      setUsers((prevUsers) => prevUsers.filter((u) => u.id !== id));
      setMessage({ type: 'success', text: t('admin.deleteSuccess', { defaultValue: 'User deleted successfully' }) });
    } catch (err) {
      console.error('❌ Error deleting user:', { status: err.response?.status });
      if (err.response?.status === 409 && retryCount < 3) {
        console.log(`✅ Retrying delete for user ${id}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return deleteUser(id, name, retryCount + 1);
      }
      setMessage({
        type: 'danger',
        text: err.response?.status === 401 ? t('admin.unauthorized', { defaultValue: 'Unauthorized access' }) :
              err.response?.status === 429 ? t('admin.rateLimit', { defaultValue: 'Rate limit exceeded' }) :
              t('admin.deleteError', { defaultValue: 'Failed to delete user' }),
      });
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Toggle admin status
  const toggleAdmin = (id, is_admin, version) => {
    const isSelf = user && user.id === id;
    updateUserStatus(id, { is_admin, version }, isSelf && is_admin === false);
  };

  // Toggle blocked status
  const toggleBlocked = (id, is_blocked, version) => {
    updateUserStatus(id, { is_blocked, version });
  };

  // Table columns
  const columns = [
    { Header: t('admin.name', { defaultValue: 'Name' }), accessor: 'name' },
    { Header: t('admin.email', { defaultValue: 'Email' }), accessor: 'email' },
    {
      Header: t('admin.isAdmin', { defaultValue: 'Admin Status' }),
      accessor: 'is_admin',
      Cell: ({ row }) => {
        const u = row.original;
        const disabled = updatingIds.has(u.id) || (user.id === u.id && u.is_admin);
        return (
          <span className="d-flex align-items-center">
            <input
              type="checkbox"
              checked={u.is_admin}
              disabled={disabled}
              onChange={() => toggleAdmin(u.id, !u.is_admin, u.version)}
              aria-label={t('admin.toggleAdmin', { defaultValue: 'Toggle admin status for {{name}}', name: u.name })}
              className="me-2"
              id={`admin-checkbox-${u.id}`}
            />
            {updatingIds.has(u.id) && <Spinner animation="border" size="sm" aria-label={t('admin.updating', { defaultValue: 'Updating' })} />}
          </span>
        );
      },
    },
    {
      Header: t('admin.isBlocked', { defaultValue: 'Blocked Status' }),
      accessor: 'is_blocked',
      Cell: ({ row }) => {
        const u = row.original;
        const disabled = updatingIds.has(u.id);
        return (
          <span className="d-flex align-items-center">
            <input
              type="checkbox"
              checked={u.is_blocked}
              disabled={disabled}
              onChange={() => toggleBlocked(u.id, !u.is_blocked, u.version)}
              aria-label={t('admin.toggleBlocked', { defaultValue: 'Toggle blocked status for {{name}}', name: u.name })}
              className="me-2"
              id={`blocked-checkbox-${u.id}`}
            />
            {updatingIds.has(u.id) && <Spinner animation="border" size="sm" aria-label={t('admin.updating', { defaultValue: 'Updating' })} />}
          </span>
        );
      },
    },
    {
      Header: t('admin.actions', { defaultValue: 'Actions' }),
      Cell: ({ row }) => {
        const u = row.original;
        const disabled = updatingIds.has(u.id) || user.id === u.id;
        return (
          <Dropdown>
            <Dropdown.Toggle
              variant={theme === 'dark' ? 'outline-light' : 'outline-secondary'}
              size="sm"
              disabled={disabled}
              aria-label={t('admin.actionsFor', { defaultValue: 'Actions for {{name}}', name: u.name })}
              id={`actions-dropdown-${u.id}`}
            >
              {t('admin.actions', { defaultValue: 'Actions' })}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item
                onClick={() => deleteUser(u.id, u.name)}
                disabled={disabled}
                aria-label={t('admin.deleteUser', { defaultValue: 'Delete user {{name}}', name: u.name })}
              >
                {t('admin.delete', { defaultValue: 'Delete' })}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        );
      },
    },
  ];

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({
    columns,
    data: users,
  });

  return (
    <div className={`container my-4 ${theme === 'dark' ? 'text-light' : ''}`}>
      <h2 id="admin-title" className="mb-4">{t('admin.title', { defaultValue: 'Admin Panel' })}</h2>

      {/* Topic Creation Form */}
      <h4>{t('admin.addTopic', { defaultValue: 'Add Topic' })}</h4>
      {topicError && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setTopicError(null)}
          role="alert"
          aria-live="assertive"
        >
          {topicError}
          <Button
            variant="link"
            onClick={() => {
              setTopicError(null);
              setTopicSubmitting(false);
            }}
            aria-label={t('admin.retry', { defaultValue: 'Retry' })}
            className="ms-2"
            id="retry-topic-button"
          >
            {t('admin.retry', { defaultValue: 'Retry' })}
          </Button>
        </Alert>
      )}
      {topicSuccess && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setTopicSuccess(null)}
          role="alert"
          aria-live="assertive"
        >
          {topicSuccess}
        </Alert>
      )}
      <Form onSubmit={handleSubmit(onAddTopic)} aria-label={t('admin.addTopicForm', { defaultValue: 'Add Topic Form' })} className="mb-4">
        <Form.Group className="mb-3" controlId="topicName">
          <Form.Label>{t('admin.topicName', { defaultValue: 'Topic Name' })}</Form.Label>
          <Form.Control
            type="text"
            {...register('name', {
              required: t('admin.topicRequired', { defaultValue: 'Topic name is required' }),
              maxLength: { value: 100, message: t('admin.topicMaxLength', { defaultValue: 'Topic name must be less than 100 characters' }) }
            })}
            isInvalid={!!errors.name}
            placeholder={t('admin.topicPlaceholder', { defaultValue: 'Enter topic name' })}
            aria-label={t('admin.topicInputLabel', { defaultValue: 'Topic Name' })}
            id="topic-input"
          />
          <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
        </Form.Group>
        <Button
          type="submit"
          variant={theme === 'dark' ? 'outline-light' : 'primary'}
          disabled={topicSubmitting}
          aria-label={t('admin.addTopic', { defaultValue: 'Add Topic' })}
          id="add-topic-button"
        >
          {topicSubmitting ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" aria-hidden="true" />
              {t('admin.submitting', { defaultValue: 'Submitting' })}
            </>
          ) : (
            t('admin.addTopic', { defaultValue: 'Add Topic' })
          )}
        </Button>
      </Form>

      {/* User Management */}
      <h4>{t('admin.userManagement', { defaultValue: 'User Management' })}</h4>
      {message && (
        <Alert
          variant={message.type}
          dismissible
          onClose={() => setMessage(null)}
          role="alert"
          aria-live="assertive"
        >
          {message.text}
          {message.type === 'danger' && (
            <Button
              variant="link"
              onClick={() => setMessage(null)}
              aria-label={t('admin.retry', { defaultValue: 'Retry' })}
              className="ms-2"
              id="retry-message-button"
            >
              {t('admin.retry', { defaultValue: 'Retry' })}
            </Button>
          )}
        </Alert>
      )}
      {loading && (
        <Spinner animation="border" role="status" aria-label={t('admin.loading', { defaultValue: 'Loading' })} />
      )}
      {error && (
        <Alert variant="danger" role="alert" aria-live="assertive" dismissible onClose={() => setError(null)}>
          {error}
          <Button
            variant="link"
            onClick={fetchUsers}
            aria-label={t('admin.retry', { defaultValue: 'Retry' })}
            className="ms-2"
            id="retry-users-button"
          >
            {t('admin.retry', { defaultValue: 'Retry' })}
          </Button>
        </Alert>
      )}
      {!loading && users.length === 0 && (
        <p aria-live="polite">{t('admin.noUsers', { defaultValue: 'No users found' })}</p>
      )}
      {!loading && users.length > 0 && (
        <div className="table-responsive">
          <Table
            striped
            bordered
            hover
            variant={theme === 'dark' ? 'dark' : 'light'}
            {...getTableProps()}
            aria-label={t('admin.tableLabel', { defaultValue: 'Users Table' })}
            id="users-table"
          >
            <caption className="visually-hidden">{t('admin.tableCaption', { defaultValue: 'List of users with their details and actions' })}</caption>
            <thead>
              {headerGroups.map((headerGroup) => {
                const { key, ...restHeaderGroupProps } = headerGroup.getHeaderGroupProps();
                return (
                  <tr key={key} {...restHeaderGroupProps}>
                    {headerGroup.headers.map((column) => {
                      const { key: keyCol, ...restHeaderProps } = column.getHeaderProps();
                      return (
                        <th key={keyCol} {...restHeaderProps} scope="col">
                          {column.render('Header')}
                        </th>
                      );
                    })}
                  </tr>
                );
              })}
            </thead>
            <tbody {...getTableBodyProps()}>
              {rows.map((row) => {
                prepareRow(row);
                const { key, ...restRowProps } = row.getRowProps();
                return (
                  <tr key={key} {...restRowProps}>
                    {row.cells.map((cell) => {
                      const { key: keyCell, ...restCellProps } = cell.getCellProps();
                      return (
                        <td key={keyCell} {...restCellProps}>
                          {cell.render('Cell')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <Button
              variant={theme === 'dark' ? 'outline-light' : 'outline-secondary'}
              disabled={page === 1}
              onClick={() => setPage((prev) => prev - 1)}
              aria-label={t('admin.prevPage', { defaultValue: 'Previous Page' })}
              id="prev-page-button"
            >
              {t('admin.prevPage', { defaultValue: 'Previous Page' })}
            </Button>
            <span aria-live="polite">{t('admin.page', { defaultValue: 'Page {{page}} of {{totalPages}}', page, totalPages })}</span>
            <Button
              variant={theme === 'dark' ? 'outline-light' : 'outline-secondary'}
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              aria-label={t('admin.nextPage', { defaultValue: 'Next Page' })}
              id="next-page-button"
            >
              {t('admin.nextPage', { defaultValue: 'Next Page' })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
