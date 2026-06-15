import { useState } from 'react';

type Props = {
  onSubmit: (values: { email: string; password: string }) => Promise<void>;
  isSubmitting: boolean;
  errorMessage?: string | null;
};

export function LoginForm({ onSubmit, isSubmitting, errorMessage }: Props) {
  const [email, setEmail] = useState('admin@local');
  const [password, setPassword] = useState('Admin123!');

  return (
    <form
      className="auth-card"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({ email, password });
      }}
    >
      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
      </label>
      <label>
        Password
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
        />
      </label>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
      </button>
    </form>
  );
}