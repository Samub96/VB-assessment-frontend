import type {
  AuthUser,
  CreateOrderRequest,
  LoginRequest,
  LoginResponse,
  OrderFilters,
  OrderSummary,
  Role
} from '../types';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type ApiClientOptions = {
  getToken: () => string | null;
  onUnauthorized: () => void;
};

type ResponseMode = 'auto' | 'json' | 'text' | 'blob';

const apiRoot = (() => {
  const configuredUrl = import.meta.env.REACT_APP_API_URL?.trim().replace(/\/$/, '');
  if (import.meta.env.DEV) {
    return '/api';
  }
  return configuredUrl ? `${configuredUrl}/api` : '/api';
})();

export function getApiRoot() {
  return apiRoot;
}

async function parseResponse(response: Response, mode: ResponseMode = 'auto') {
  if (response.status === 204) {
    return undefined;
  }

  if (mode === 'blob') {
    return response.blob();
  }

  if (mode === 'json') {
    return response.json();
  }

  if (mode === 'text') {
    return response.text();
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/octet-stream')) {
    return response.blob();
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function createApiClient(options: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}, mode: ResponseMode = 'auto'): Promise<T> {
    const headers = new Headers(init.headers);
    const token = options.getToken();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const hasFormDataBody = init.body instanceof FormData;
    if (init.body && !hasFormDataBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${apiRoot}${path}`, {
      ...init,
      headers
    });

    if (response.status === 401) {
      options.onUnauthorized();
      throw new ApiError('Sesión expirada. Vuelve a iniciar sesión.', 401);
    }

    const payload = await parseResponse(response, mode);
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'message' in payload
          ? String((payload as { message?: string }).message ?? 'Error inesperado')
          : `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  }

  return {
    login(body: LoginRequest) {
      return request<LoginResponse>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    getOrders(filters?: OrderFilters) {
      const query = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
          }
        });
      }

      const suffix = query.toString() ? `?${query.toString()}` : '';
      return request<OrderSummary[]>(`/v1/orders${suffix}`);
    },
    getArchivedOrders() {
      return request<OrderSummary[]>('/v1/orders/archived');
    },
    getOrderById(id: string) {
      return request<OrderSummary>(`/v1/orders/${id}`);
    },
    approveOrder(id: string) {
      return request<void>(`/v1/orders/${id}/approve`, { method: 'POST' });
    },
    rejectOrder(id: string) {
      return request<void>(`/v1/orders/${id}/reject`, { method: 'POST' });
    },
    archiveRejectedOrders() {
      return request<void>('/v1/orders/archive-rejected', { method: 'POST' });
    },
    createOrder(body: CreateOrderRequest) {
      return request<OrderSummary>('/v1/orders', {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    uploadInvoice(id: string, formData: FormData) {
      return request<void>(`/v1/orders/${id}/invoice`, {
        method: 'POST',
        body: formData
      });
    },
    getInvoice(id: string) {
      return request<Blob>(`/v1/orders/${id}/invoice`, {
        headers: {
          Accept: 'application/octet-stream'
        }
      }, 'blob');
    }
  };
}

/** Genera un PDF válido minimal para pruebas. Cumple estructura básica PDF. */
export function generateMinimalPdf(filename: string = 'invoice.pdf'): File {
  // PDF mínimo válido según especificación
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Factura) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
0000000301 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
395
%%EOF`;

  const blob = new Blob([pdfContent], { type: 'application/pdf' });
  return new File([blob], filename, { type: 'application/pdf' });
}

export function normalizeRole(value?: string): Role {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return 'OPERATOR';
  }

  return normalized.includes('ADMIN') ? 'ADMIN' : 'OPERATOR';
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasAdminInUnknown(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.toUpperCase().includes('ADMIN');
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasAdminInUnknown(item));
  }

  return false;
}

function parseRoleFromToken(token: string): Role | null {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }

  const candidates: unknown[] = [
    payload.role,
    payload.roles,
    payload.authorities,
    payload.scope,
    payload.scp,
    payload['cognito:groups']
  ];

  const realmAccess = payload.realm_access;
  if (realmAccess && typeof realmAccess === 'object' && realmAccess !== null) {
    candidates.push((realmAccess as { roles?: unknown }).roles);
  }

  return candidates.some((value) => hasAdminInUnknown(value)) ? 'ADMIN' : 'OPERATOR';
}

export function parseAuthUser(email: string, response: LoginResponse): AuthUser {
  const responseRoles = Array.isArray(response.roles) ? response.roles.join(' ') : undefined;
  const tokenRole = parseRoleFromToken(response.token);
  return {
    email,
    token: response.token,
    tokenType: response.tokenType ?? 'Bearer',
    expiresAt: response.expiresAt,
    role: normalizeRole(response.role ?? response.userRole ?? responseRoles ?? tokenRole ?? undefined)
  };
}