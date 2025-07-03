import { useTable } from 'react-table';
import { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import { DropdownButton, Dropdown, Alert, Spinner, Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function TemplateList({ templates, onDelete, onEdit, showActions = false, ariaLabelledBy }) {
  const { t } = useTranslation();
  const { user, getToken } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const [dropdownId, setDropdownId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const retryCount = useRef(0);
  const maxRetries = 3;

  // Log templates for debugging
  useEffect(() => {
    console.log(`✅ TemplateList render: templates=${templates.length}, timestamp=${new Date().toISOString()}`);
    templates.forEach((template) => {
      if (!template.id) {
        console.warn(`⚠️ Template missing ID: ${JSON.stringify(template)}, timestamp=${new Date().toISOString()}`);
      }
    });
  }, [templates]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdownElement = document.querySelector(`#dropdown-menu-${dropdownId}`);
      if (dropdownId && dropdownElement && !dropdownElement.contains(event.target)) {
        setDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownId]);

  // Handle delete with retry
  const handleDelete = useCallback(
    async (id) => {
      if (!id) {
        setDeleteError(t('templateList.invalidId'));
        console.error('❌ Attempted to delete invalid template_id:', id, `timestamp=${new Date().toISOString()}`);
        return;
      }
      if (window.confirm(t('templateList.confirmDelete'))) {
        setDeletingId(id);
        setDeleteError(null);
        try {
          const token = getToken();
          if (!token) {
            throw new Error('No token available');
          }
          console.log(`✅ Deleting template ${id}, timestamp=${new Date().toISOString()}`);
          const res = await axios.delete(`${API_BASE}/api/templates/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('✅ Template deleted:', id);
          onDelete(id);
          setDropdownId(null);
          retryCount.current = 0;
        } catch (err) {
          console.error('❌ Delete error:', { status: err.response?.status, message: err.message, timestamp: new Date().toISOString() });
          if (err.response?.status === 429 && retryCount.current < maxRetries) {
            retryCount.current += 1;
            console.log(`✅ Retrying delete for template ${id}, attempt ${retryCount.current}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.current));
            return handleDelete(id);
          }
          if (err.message === 'No token available' || err.response?.status === 401) {
            setDeleteError(t('templateList.unauthorized'));
            // Optionally redirect to login
            // window.location.href = '/login';
          } else {
            setDeleteError(
              err.response?.status === 429 ? t('templateList.rateLimit') :
              err.response?.status === 404 ? t('templateList.notFound') :
              err.response?.data?.message || t('templateList.deleteError')
            );
          }
        } finally {
          setDeletingId(null);
        }
      }
    },
    [onDelete, t, getToken]
  );

  const columns = useMemo(() => {
    const baseColumns = [
      {
        Header: t('templateList.title'),
        accessor: 'title',
        Cell: ({ row }) => {
          if (!row.original.id) {
            console.error(`❌ Missing template ID for title: ${row.original.title}, timestamp=${new Date().toISOString()}`);
            return <span>{row.original.title || t('templateList.unknown')}</span>;
          }
          return (
            <Link
              to={`/templates/${row.original.id}`}
              aria-label={t('templateList.viewTemplate', { title: row.original.title })}
              id={`template-link-${row.original.id}`}
            >
              {row.original.title}
            </Link>
          );
        },
      },
      {
        Header: t('templateList.description'),
        accessor: 'description',
        Cell: ({ value }) => <ReactMarkdown>{value || ''}</ReactMarkdown>,
      },
      {
        Header: t('templateList.topic'),
        accessor: 'Topic.name',
        Cell: ({ value, row }) => {
          const topicName = value || row.original.Topic?.name || t('templateList.noTopic');
          if (!value && row.original.topic_id) {
            console.warn(`⚠️ Missing Topic.name for template_id=${row.original.id}, topic_id=${row.original.topic_id}, timestamp=${new Date().toISOString()}`);
          }
          return topicName;
        },
      },
      {
        Header: t('templateList.public'),
        accessor: 'is_public',
        Cell: ({ value }) => (value ? t('templateList.yes') : t('templateList.no')),
      },
    ];

    if (showActions) {
      baseColumns.push({
        Header: t('templateList.actions'),
        Cell: ({ row }) => {
          if (!row.original.id) {
            console.error('❌ Invalid template_id in actions:', row.original, `timestamp=${new Date().toISOString()}`);
            return <span>{t('templateList.invalidId')}</span>;
          }
          const canEditDelete = user && (user.id === row.original.user_id || user.is_admin);
          return (
            <DropdownButton
              id={`dropdown-menu-${row.original.id}`}
              title={t('templateList.actions')}
              variant={theme === 'dark' ? 'outline-light' : 'outline-secondary'}
              size="sm"
              onToggle={(isOpen) => setDropdownId(isOpen ? row.original.id : null)}
              show={dropdownId === row.original.id}
              disabled={deletingId === row.original.id}
              aria-label={t('templateList.actionsFor', { title: row.original.title })}
            >
              <Dropdown.Item
                as={Link}
                to={`/templates/${row.original.id}/edit`}
                onClick={() => {
                  if (onEdit) onEdit(row.original.id);
                  setDropdownId(null);
                }}
                disabled={!canEditDelete || deletingId === row.original.id}
                aria-label={t('templateList.editTemplate', { title: row.original.title })}
              >
                {t('templateList.edit')}
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => handleDelete(row.original.id)}
                disabled={!canEditDelete || deletingId === row.original.id}
                aria-label={t('templateList.deleteTemplate', { title: row.original.title })}
              >
                {t('templateList.delete')}
                {deletingId === row.original.id && (
                  <Spinner animation="border" size="sm" className="ms-2" aria-hidden="true" />
                )}
              </Dropdown.Item>
            </DropdownButton>
          );
        },
      });
    }

    return baseColumns;
  }, [dropdownId, handleDelete, onEdit, showActions, t, user, theme, deletingId]);

  const data = useMemo(() => templates.filter(t => t.id), [templates]);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({
    columns,
    data,
  });

  return (
    <div aria-labelledby={ariaLabelledBy} role="region" aria-busy={deletingId ? 'true' : 'false'}>
      {deleteError && (
        <Alert
          variant="danger"
          role="alert"
          aria-live="assertive"
          dismissible
          onClose={() => setDeleteError(null)}
          id="template-list-error-alert"
        >
          {deleteError}
          {(deleteError === t('templateList.deleteError') || deleteError === t('templateList.rateLimit')) && (
            <Button
              variant="link"
              onClick={() => handleDelete(dropdownId)}
              aria-label={t('templateList.retry')}
              id="retry-delete-button"
            >
              {t('templateList.retry')}
            </Button>
          )}
        </Alert>
      )}
      <table
        className={`table ${theme === 'dark' ? 'table-dark' : 'table-striped'} table-responsive`}
        {...getTableProps()}
        aria-label={t('templateList.tableLabel')}
        id="templates-table"
      >
        <caption className={theme === 'dark' ? 'text-light' : ''}>{t('templateList.tableCaption')}</caption>
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center" aria-live="polite">
                {t('templateList.noTemplates')}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
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
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default TemplateList;
