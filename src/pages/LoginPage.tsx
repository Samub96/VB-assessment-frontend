import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <main className="auth-shell">
      <section className="hero-panel">
        <p className="eyebrow">JWT + Spring Boot</p>
        <h1>Acceso seguro para operar órdenes.</h1>
        <p>
          El frontend guarda el token en memoria, adjunta Authorization en cada petición y redirige si el backend responde
          401.
        </p>
      </section>
      <LoginForm
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onSubmit={async (values) => {
          setErrorMessage(null);
          try {
            setIsSubmitting(true);
            await login(values);
            navigate('/', { replace: true });
          } catch (error) {
            if (error instanceof ApiError && error.status === 403) {
              setErrorMessage('Sin permisos para iniciar sesión.');
            } else if (error instanceof Error) {
              setErrorMessage(error.message);
            } else {
              setErrorMessage('No se pudo conectar con el backend.');
            }
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    </main>
  );
}