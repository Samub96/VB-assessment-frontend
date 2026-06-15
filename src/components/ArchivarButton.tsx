import { useState } from 'react';
import { createApiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type Props = {
  onArchived?: () => void;
  onArchiveComplete?: () => Promise<void>;
};

export function ArchivarButton({ onArchived, onArchiveComplete }: Props) {
  const { user, logout } = useAuth();
  const { pushToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  const apiClient = createApiClient({
    getToken: () => user.token,
    onUnauthorized: logout
  });

  const handleArchive = async () => {
    try {
      setIsLoading(true);
      await apiClient.archiveRejectedOrders();
      pushToast({ type: 'success', message: 'Órdenes rechazadas archivadas. Recargando lista...' });
      
      // Recargar lista después de archivar
      if (onArchiveComplete) {
        await onArchiveComplete();
      }
      
      onArchived?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo archivar las órdenes.';
      pushToast({ type: 'error', message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button type="button" onClick={handleArchive} disabled={isLoading}>
      {isLoading ? 'Archivando...' : 'Archivar rechazadas'}
    </button>
  );
}