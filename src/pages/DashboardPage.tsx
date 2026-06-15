import { useMemo, useRef, useState } from 'react';
import { ArchivarButton } from '../components/ArchivarButton';
import { RoleGate } from '../components/RoleGate';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createApiClient, generateMinimalPdf } from '../lib/api';
import type { OrderFilters, OrderSummary } from '../types';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { pushToast } = useToast();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<OrderSummary[]>([]);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [archivedCount, setArchivedCount] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [operatorOrderId, setOperatorOrderId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingOrders, setLoadingOrders] = useState(new Set<string>());
  const [filters, setFilters] = useState<OrderFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  
  const apiClient = useMemo(
    () =>
      createApiClient({
        getToken: () => user?.token ?? null,
        onUnauthorized: logout
      }),
    [logout, user]
  );

  const loadOrders = async () => {
    if (user?.role !== 'ADMIN') {
      pushToast({
        type: 'info',
        message: 'GET /api/v1/orders es solo ADMIN. Usa crear orden o subir factura como OPERATOR.'
      });
      return;
    }

    try {
      const orders = await apiClient.getOrders(filters);
      setOrders(orders);
      setOrderCount(orders.length);
      const activeFilters = Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .length;
      const suffix = activeFilters > 0 ? ` (${activeFilters} filtro${activeFilters > 1 ? 's' : ''})` : '';
      pushToast({ type: 'success', message: `Se cargaron ${orders.length} órdenes${suffix}.` });
    } catch (error) {
      pushToast({ type: 'error', message: error instanceof Error ? error.message : 'No se pudieron cargar las órdenes.' });
    }
  };

  const loadArchivedOrders = async () => {
    if (user?.role !== 'ADMIN') {
      return;
    }

    try {
      setLoadingArchived(true);
      const archived = await apiClient.getArchivedOrders();
      setArchivedOrders(archived);
      setArchivedCount(archived.length);
      pushToast({ type: 'success', message: `Se cargaron ${archived.length} órdenes archivadas.` });
    } catch (error) {
      pushToast({ type: 'error', message: error instanceof Error ? error.message : 'No se pudieron cargar las órdenes archivadas.' });
    } finally {
      setLoadingArchived(false);
    }
  };

  const createOperatorOrder = async () => {
    try {
      setIsCreating(true);
      const created = await apiClient.createOrder({
        amount: 123.45,
        currency: 'USD',
        description: 'Pago de servicio'
      });
      setOperatorOrderId(created.id);
      pushToast({ type: 'success', message: `Orden creada: ${created.id}` });
    } catch (error) {
      pushToast({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo crear la orden.' });
    } finally {
      setIsCreating(false);
    }
  };

  const uploadOperatorInvoice = async () => {
    if (!operatorOrderId) {
      pushToast({ type: 'info', message: 'Primero crea una orden para obtener el UUID.' });
      return;
    }

    const fileToUpload = selectedFile ?? generateMinimalPdf('invoice.pdf');

    if (fileToUpload.size === 0) {
      pushToast({ type: 'error', message: 'El archivo está vacío. Selecciona un archivo válido.' });
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', fileToUpload);
      await apiClient.uploadInvoice(operatorOrderId, formData);
      pushToast({ type: 'success', message: `Factura "${fileToUpload.name}" subida correctamente.` });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'No se pudo subir la factura.';
      console.error('[Invoice Upload Error]', { 
        orderId: operatorOrderId, 
        fileName: fileToUpload.name,
        fileSize: fileToUpload.size,
        fileType: fileToUpload.type,
        error 
      });
      pushToast({ type: 'error', message: errorMsg });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        pushToast({ type: 'error', message: 'Archivo demasiado grande (máx 50 MB).' });
        return;
      }
      setSelectedFile(file);
      pushToast({ type: 'info', message: `Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)` });
    }
  };

  const downloadInvoice = async (orderId: string) => {
    try {
      setLoadingOrders(prev => new Set([...prev, orderId]));
      const blob = await apiClient.getInvoice(orderId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast({ type: 'success', message: 'Factura descargada.' });
    } catch (error) {
      pushToast({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo descargar la factura.' });
    } finally {
      setLoadingOrders(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const approveOrder = async (orderId: string) => {
    try {
      setLoadingOrders(prev => new Set([...prev, orderId]));
      await apiClient.approveOrder(orderId);
      pushToast({ type: 'success', message: `Orden ${orderId} aprobada.` });
      // Recargar lista de órdenes
      await loadOrders();
    } catch (error) {
      pushToast({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo aprobar la orden.' });
    } finally {
      setLoadingOrders(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const rejectOrder = async (orderId: string) => {
    try {
      setLoadingOrders(prev => new Set([...prev, orderId]));
      await apiClient.rejectOrder(orderId);
      pushToast({ type: 'success', message: `Orden ${orderId} rechazada.` });
      // Recargar lista de órdenes
      await loadOrders();
    } catch (error) {
      pushToast({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo rechazar la orden.' });
    } finally {
      setLoadingOrders(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleFilterChange = (key: keyof OrderFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' || value === undefined ? undefined : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setShowFilters(false);
    pushToast({ type: 'info', message: 'Filtros limpiados.' });
  };

  const handleToggleArchived = async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next && archivedOrders.length === 0) {
      await loadArchivedOrders();
    }
  };

  const activeFilterCount = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .length;

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sesión activa</p>
          <h1>Panel de órdenes</h1>
        </div>
        <div className="topbar-actions">
          <span>{user?.email}</span>
          <button type="button" className="secondary" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="card-grid">
        <article className="metric-card">
          <span className="metric-label">Rol</span>
          <strong>{user?.role}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">Token</span>
          <strong>{user?.tokenType}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">Órdenes</span>
          <strong>{orderCount ?? 'Sin cargar'}</strong>
        </article>
      </section>

      <section className="actions-panel">
        <button type="button" onClick={loadOrders}>
          Cargar órdenes
        </button>
        <RoleGate role="ADMIN">
          <ArchivarButton 
            onArchived={() => pushToast({ type: 'info', message: 'Acción administrativa completada.' })}
            onArchiveComplete={loadOrders}
          />
        </RoleGate>

        <RoleGate role="OPERATOR">
          <button type="button" onClick={createOperatorOrder} disabled={isCreating}>
            {isCreating ? 'Creando...' : 'Crear orden (OPERATOR)'}
          </button>
        </RoleGate>

        <RoleGate role="OPERATOR">
          <div className="form-group">
            <label htmlFor="invoice-file">Selecciona tu factura (PDF, PNG, JPG, DOC)</label>
            <input
              id="invoice-file"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
              onChange={handleFileSelect}
            />
            {selectedFile && (
              <span className="file-info">
                ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </span>
            )}
          </div>
        </RoleGate>

        <RoleGate role="OPERATOR">
          <button type="button" className="secondary" onClick={uploadOperatorInvoice} disabled={isUploading}>
            {isUploading ? 'Subiendo...' : selectedFile ? `Subir: ${selectedFile.name}` : 'Subir factura (con demo PDF)'}
          </button>
        </RoleGate>

        {operatorOrderId ? <code className="inline-note">UUID creado: {operatorOrderId}</code> : null}
      </section>

      <RoleGate role="ADMIN">
        <section className="orders-panel">
          <header className="orders-panel__header">
            <h2>Órdenes cargadas</h2>
            <div className="orders-header-actions">
              <span>{orderCount ?? 0} resultados {activeFilterCount > 0 && `(${activeFilterCount} filtro${activeFilterCount > 1 ? 's' : ''})`}</span>
              <button 
                type="button" 
                className="small secondary"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? '▲ Ocultar filtros' : '▼ Mostrar filtros'}
              </button>
              <button
                type="button"
                className="small secondary"
                onClick={handleToggleArchived}
                disabled={loadingArchived}
              >
                {loadingArchived ? 'Cargando archivadas...' : showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}
              </button>
            </div>
          </header>

          {showFilters && (
            <div className="filters-panel">
              <div className="filters-grid">
                <div className="filter-group">
                  <label htmlFor="filter-status">Estado</label>
                  <select
                    id="filter-status"
                    value={filters.status ?? ''}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="REJECTED">Rechazada</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="APPROVED">Aprobada</option>
                    <option value="ARCHIVED">Archivada</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="filter-currency">Moneda</label>
                  <input
                    id="filter-currency"
                    type="text"
                    placeholder="ej: USD"
                    value={filters.currency ?? ''}
                    onChange={(e) => handleFilterChange('currency', e.target.value.toUpperCase())}
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="filter-min-amount">Monto mínimo</label>
                  <input
                    id="filter-min-amount"
                    type="number"
                    placeholder="0"
                    step="0.01"
                    value={filters.minAmount ?? ''}
                    onChange={(e) => handleFilterChange('minAmount', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="filter-max-amount">Monto máximo</label>
                  <input
                    id="filter-max-amount"
                    type="number"
                    placeholder="999999"
                    step="0.01"
                    value={filters.maxAmount ?? ''}
                    onChange={(e) => handleFilterChange('maxAmount', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="filter-created-from">Desde</label>
                  <input
                    id="filter-created-from"
                    type="date"
                    value={filters.createdFrom ?? ''}
                    onChange={(e) => handleFilterChange('createdFrom', e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="filter-created-to">Hasta</label>
                  <input
                    id="filter-created-to"
                    type="date"
                    value={filters.createdTo ?? ''}
                    onChange={(e) => handleFilterChange('createdTo', e.target.value)}
                  />
                </div>
              </div>

              <div className="filters-actions">
                <button type="button" onClick={loadOrders} className="success small">
                  🔍 Buscar
                </button>
                {activeFilterCount > 0 && (
                  <button type="button" onClick={clearFilters} className="secondary small">
                    ✕ Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          )}

          {showArchived && user?.role === 'ADMIN' && (
            <div className="archived-panel">
              <header className="orders-panel__header">
                <h3>Órdenes archivadas</h3>
                <span>{archivedCount ?? 0} resultados</span>
              </header>
              {archivedOrders.length === 0 ? (
                <p className="orders-empty">No hay órdenes archivadas.</p>
              ) : (
                <div className="orders-table-wrapper">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Monto</th>
                        <th>Moneda</th>
                        <th>Estado</th>
                        <th>Creada</th>
                        <th>Archivada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedOrders.map((order) => (
                        <tr key={order.id}>
                          <td><code style={{ fontSize: '0.85em' }}>{order.id.slice(0, 8)}...</code></td>
                          <td>{typeof order.amount === 'number' ? order.amount.toFixed(2) : '-'}</td>
                          <td>{order.currency ?? '-'}</td>
                          <td>
                            <span className={`status-badge status-${order.status?.toLowerCase()}`}>
                              {order.status}
                            </span>
                          </td>
                          <td>{order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}</td>
                          <td>{order.archivedAt ? new Date(order.archivedAt).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {orders.length === 0 ? (
            <p className="orders-empty">No hay órdenes cargadas todavía. Pulsa "Cargar órdenes".</p>
          ) : (
            <div className="orders-table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Monto</th>
                    <th>Moneda</th>
                    <th>Estado</th>
                    <th>Creada</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td><code style={{ fontSize: '0.85em' }}>{order.id.slice(0, 8)}...</code></td>
                      <td>{typeof order.amount === 'number' ? order.amount.toFixed(2) : '-'}</td>
                      <td>{order.currency ?? '-'}</td>
                      <td>
                        <span className={`status-badge status-${order.status?.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>{order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}</td>
                      <td>
                        <div className="actions-cell">
                          {order.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                className="small success"
                                onClick={() => approveOrder(order.id)}
                                disabled={loadingOrders.has(order.id)}
                              >
                                ✓ Aprobar
                              </button>
                              <button
                                type="button"
                                className="small danger"
                                onClick={() => rejectOrder(order.id)}
                                disabled={loadingOrders.has(order.id)}
                              >
                                ✕ Rechazar
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="small secondary"
                            onClick={() => downloadInvoice(order.id)}
                            disabled={loadingOrders.has(order.id)}
                          >
                            ⬇ Factura
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </RoleGate>
    </main>
  );
}