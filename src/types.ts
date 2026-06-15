export type Role = 'ADMIN' | 'OPERATOR';

export type OrderStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  tokenType: 'Bearer' | string;
  expiresAt: string;
  role?: Role;
  userRole?: Role;
  roles?: string[];
}

export interface AuthUser {
  email: string;
  token: string;
  tokenType: string;
  expiresAt: string;
  role: Role;
}

export interface OrderSummary {
  id: string;
  amount?: number;
  currency?: string;
  description?: string;
  status: OrderStatus | string;
  createdAt?: string;
  archivedAt?: string;
}

export interface CreateOrderRequest {
  amount: number;
  currency: string;
  description: string;
}

export interface OrderFilters {
  status?: string;
  currency?: string;
  minAmount?: number;
  maxAmount?: number;
  createdFrom?: string;
  createdTo?: string;
}

export interface ApiErrorShape {
  message: string;
  status: number;
  details?: unknown;
}