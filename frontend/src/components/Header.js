import { useContext, useState, useEffect } from 'react';
import { Navbar, Nav, Form, Button, Container, Dropdown, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate, NavLink } from 'react-router-dom';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Header() {
  const { t, i18n } = useTranslation();
  const { user, logout, getToken } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    const validThemes = ['light', 'dark'];
    if (!validThemes.includes(theme)) {
      console.warn('⚠️ Invalid theme value detected:', theme);
    }
    if (!i18n.isInitialized) {
      console.warn('⚠️ i18next not initialized during Header render');
    }
    console.log(`✅ Header render: theme=${theme}, lang=${i18n.language}, timestamp=${new Date().toISOString()}`);
  }, [theme, i18n.language, i18n.isInitialized]);

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchError(t('header.search_empty'));
      return;
    }
    if (trimmedQuery.length > 100) {
      setSearchError(t('header.search_too_long'));
      return;
    }
    setSearchError(null);
    console.log(`✅ Searching for: ${trimmedQuery}, timestamp=${new Date().toISOString()}`);
    navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    setSearchQuery('');
    setExpanded(false);
  };

  const handleLogout = () => {
    if (window.confirm(t('header.confirm_logout'))) {
      console.log(`✅ Logging out user, timestamp=${new Date().toISOString()}`);
      logout();
      alert(t('header.logout_success'));
      setExpanded(false);
      navigate('/');
    }
  };

  const changeLanguage = async (lng) => {
    console.log(`✅ Changing language to: ${lng}, timestamp=${new Date().toISOString()}`);
    try {
      await i18n.changeLanguage(lng);
      const token = getToken();
      if (user && token) {
        await axios.put(
          `${API_BASE}/api/auth/me`,
          { language: lng },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        console.log('✅ Language preference updated:', lng);
      }
      localStorage.setItem('language', lng);
    } catch (err) {
      console.error('❌ Failed to save language preference:', { status: err.response?.status });
      alert(
        err.response?.status === 429 ? t('header.rateLimit') :
        err.response?.status === 401 ? t('header.unauthorized') :
        t('header.language_error')
      );
    }
    setExpanded(false);
  };

  const handleDropdownKeyDown = (e, lng) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      changeLanguage(lng);
    }
  };

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const themeText = t('header.toggle_theme', { 
    theme: t(`header.theme.${nextTheme}`, { defaultValue: nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1) }) 
  }, { defaultValue: `${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)} Theme` });

  return (
    <Navbar
      bg={theme === 'dark' ? 'dark' : 'light'}
      variant={theme === 'dark' ? 'dark' : 'light'}
      expand="lg"
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      aria-label={t('header.navbar_label')}
      className="shadow-sm"
    >
      <Container fluid>
        <Navbar.Brand as={NavLink} to="/" onClick={() => setExpanded(false)} aria-label={t('header.appName')}>
          {t('header.appName')}
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="navbarContent" />
        <Navbar.Collapse id="navbarContent">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end onClick={() => setExpanded(false)} aria-label={t('header.home')}>
              {t('header.home')}
            </Nav.Link>
            {user && (
              <Nav.Link as={NavLink} to="/profile" onClick={() => setExpanded(false)} aria-label={t('header.profile')}>
                {t('header.profile')}
              </Nav.Link>
            )}
            {user?.is_admin && (
              <Nav.Link as={NavLink} to="/admin" onClick={() => setExpanded(false)} aria-label={t('header.admin')}>
                {t('header.admin')}
              </Nav.Link>
            )}
          </Nav>
          <Form
            className="d-flex flex-grow-1 flex-lg-grow-0 me-3"
            onSubmit={handleSearch}
            aria-label={t('header.search_form_label')}
          >
            <Form.Control
              name="search"
              type="search"
              placeholder={t('header.search_placeholder')}
              className="me-2"
              aria-label={t('header.search_label')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchError(null);
              }}
              maxLength={100}
              autoComplete="off"
              id="search-input"
            />
            <Button
              variant={theme === 'dark' ? 'outline-light' : 'outline-dark'}
              type="submit"
              aria-label={t('header.search_button_label')}
              id="search-button"
            >
              {t('header.search')}
            </Button>
          </Form>
          {searchError && (
            <Alert
              variant="danger"
              className="position-absolute m-3"
              style={{ top: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 1050, maxWidth: '90%' }}
              dismissible
              onClose={() => setSearchError(null)}
              role="alert"
              aria-live="assertive"
            >
              {searchError}
            </Alert>
          )}
          <Nav className="align-items-center">
            <Dropdown className="me-2">
              <Dropdown.Toggle
                variant={theme === 'dark' ? 'outline-light' : 'outline-dark'}
                id="language-dropdown"
                aria-label={t('header.language_label', { lang: i18n.language === 'es' ? 'Español' : 'English' })}
              >
                {i18n.language === 'es' ? 'Español' : 'English'}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item
                  onClick={() => changeLanguage('en')}
                  onKeyDown={(e) => handleDropdownKeyDown(e, 'en')}
                  aria-label={t('header.select_english')}
                >
                  English
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => changeLanguage('es')}
                  onKeyDown={(e) => handleDropdownKeyDown(e, 'es')}
                  aria-label={t('header.select_spanish')}
                >
                  Español
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
            <Button
              variant={theme === 'dark' ? 'outline-light' : 'outline-dark'}
              onClick={toggleTheme}
              className="me-2"
              aria-label={t('header.theme_label', { theme: t(`header.theme.${nextTheme}`) })}
              id="theme-toggle-button"
            >
              {themeText}
            </Button>
            {user ? (
              <Nav.Link
                onClick={handleLogout}
                className="btn btn-outline-danger"
                aria-label={t('header.logout_label')}
                id="logout-button"
              >
                {t('header.logout')}
              </Nav.Link>
            ) : (
              <>
                <Nav.Link
                  as={NavLink}
                  to="/login"
                  className="btn btn-outline-primary me-2"
                  onClick={() => setExpanded(false)}
                  aria-label={t('header.login_label')}
                  id="login-button"
                >
                  {t('header.login')}
                </Nav.Link>
                <Nav.Link
                  as={NavLink}
                  to="/register"
                  className="btn btn-outline-primary"
                  onClick={() => setExpanded(false)}
                  aria-label={t('header.register_label')}
                  id="register-button"
                >
                  {t('header.register')}
                </Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Header;