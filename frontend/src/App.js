import React, { Suspense, lazy, useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from './i18n';
import { Spinner, Container } from 'react-bootstrap';
import Header from './components/Header';
import Register from './pages/Register';

// Lazy-loaded components
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const TemplatePage = lazy(() => import('./pages/TemplatePage'));
const Search = lazy(() => import('./pages/Search'));
const CreateTemplate = lazy(() => import('./pages/CreateTemplate'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Error Message Component for ErrorBoundary
function ErrorMessage() {
  const { t } = useTranslation();
  return (
    <Container className="my-4" role="alert" aria-live="assertive">
      <h2>{t('app.error')}</h2>
      <p>{t('app.errorMessage')}</p>
    </Container>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ ErrorBoundary caught error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  render() {
    if (this.state.error) {
      return <ErrorMessage />;
    }
    return this.props.children;
  }
}

// Protected route for authenticated users
function PrivateRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  const { t } = useTranslation();

  if (loading) {
    return (
      <Container className="text-center my-5" aria-busy="true">
        <Spinner animation="border" aria-label={t('app.loadingAuth')} id="auth-loading-spinner" />
      </Container>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

// Protected route for admin users
function AdminRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  const { t } = useTranslation();

  if (loading) {
    return (
      <Container className="text-center my-5" aria-busy="true">
        <Spinner animation="border" aria-label={t('app.loadingAuth')} id="admin-loading-spinner" />
      </Container>
    );
  }

  return user && user.is_admin ? children : <Navigate to="/" replace />;
}

// Route Logger Component
function RouteLogger() {
  const location = useLocation();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    console.log(`✅ Route changed: path=${location.pathname}, search=${location.search}, userId=${user ? user.id : 'none'}, timestamp=${new Date().toISOString()}`);
  }, [location, user]);

  return null;
}

function App() {
  const { t } = useTranslation();

  useEffect(() => {
    console.log(`✅ App initialized, timestamp=${new Date().toISOString()}`);
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <ErrorBoundary>
              <Header />
              <RouteLogger />
              <Suspense
                fallback={
                  <Container className="text-center my-5" aria-busy="true">
                    <Spinner animation="border" aria-label={t('app.loadingPage')} id="page-loading-spinner" />
                  </Container>
                }
              >
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/profile"
                    element={
                      <PrivateRoute>
                        <Profile />
                      </PrivateRoute>
                    }
                  />
                  <Route path="/templates/:id" element={<TemplatePage />} />
                  <Route
                    path="/templates/new"
                    element={
                      <PrivateRoute>
                        <CreateTemplate />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/templates/:id/edit"
                    element={
                      <PrivateRoute>
                        <CreateTemplate />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <AdminPanel />
                      </AdminRoute>
                    }
                  />
                  <Route path="/search" element={<Search />} />
                  <Route path="/not-found" element={<NotFound />} />
                  <Route path="*" element={<Navigate to="/not-found" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

export default App;