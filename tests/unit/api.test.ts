import { describe, expect, it, vi } from 'vitest';
import { createApiClient, parseAuthUser } from '../../src/lib/api';

describe('api client', () => {
  it('adds authorization headers and parses login responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ token: 'abc', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z', role: 'ADMIN' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({
      getToken: () => 'jwt',
      onUnauthorized: vi.fn()
    });

    const result = await client.login({ email: 'admin@local', password: 'Admin123!' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(expect.stringContaining('/api/v1/auth/login'));
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer jwt');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(result.token).toBe('abc');
  });

  it('normalizes auth user role', () => {
    expect(
      parseAuthUser('admin@local', {
        token: 'abc',
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z',
        role: 'ADMIN'
      }).role
    ).toBe('ADMIN');
  });

  it('derives ADMIN role from JWT claims when response role is absent', () => {
    const payload = btoa(JSON.stringify({ roles: ['ADMIN'] }));
    const token = `header.${payload}.signature`;

    expect(
      parseAuthUser('admin@local', {
        token,
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z'
      }).role
    ).toBe('ADMIN');
  });

  it('normalizes lowercase response role to ADMIN', () => {
    expect(
      parseAuthUser('admin@local', {
        token: 'abc',
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z',
        role: 'admin' as 'ADMIN'
      }).role
    ).toBe('ADMIN');
  });

  it('derives role from response roles array', () => {
    expect(
      parseAuthUser('operator@local', {
        token: 'abc',
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z',
        roles: ['ROLE_OPERATOR']
      }).role
    ).toBe('OPERATOR');

    expect(
      parseAuthUser('admin@local', {
        token: 'abc',
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z',
        roles: ['ROLE_ADMIN']
      }).role
    ).toBe('ADMIN');
  });

  it('builds query params for GET /orders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({
      getToken: () => 'jwt',
      onUnauthorized: vi.fn()
    });

    await client.getOrders({
      status: 'REJECTED',
      currency: 'USD',
      minAmount: 10,
      maxAmount: 99,
      createdFrom: '2026-06-01T00:00:00Z',
      createdTo: '2026-06-30T23:59:59Z'
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/orders?');
    expect(url).toContain('status=REJECTED');
    expect(url).toContain('currency=USD');
    expect(url).toContain('minAmount=10');
    expect(url).toContain('maxAmount=99');
    expect(url).toContain('createdFrom=2026-06-01T00%3A00%3A00Z');
    expect(url).toContain('createdTo=2026-06-30T23%3A59%3A59Z');
  });

  it('sends POST /orders with backend expected payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', status: 'PENDING' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({
      getToken: () => 'jwt',
      onUnauthorized: vi.fn()
    });

    await client.createOrder({
      amount: 123.45,
      currency: 'USD',
      description: 'Pago de servicio'
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/orders');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ amount: 123.45, currency: 'USD', description: 'Pago de servicio' }));
  });

  it('uses GET /orders/{id} path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', status: 'PENDING' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({
      getToken: () => 'jwt',
      onUnauthorized: vi.fn()
    });

    await client.getOrderById('00000000-0000-0000-0000-000000000001');
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/orders/00000000-0000-0000-0000-000000000001');
  });

  it('uploads invoice as multipart/form-data with file field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({
      getToken: () => 'jwt',
      onUnauthorized: vi.fn()
    });

    const formData = new FormData();
    formData.append('file', new Blob(['invoice']), 'invoice.pdf');

    await client.uploadInvoice('00000000-0000-0000-0000-000000000001', formData);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/orders/00000000-0000-0000-0000-000000000001/invoice');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(formData);
  });

  it('downloads invoice as blob from GET /orders/{id}/invoice', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['pdf-bytes'], { type: 'application/pdf' }), {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient({
      getToken: () => 'jwt',
      onUnauthorized: vi.fn()
    });

    const result = await client.getInvoice('00000000-0000-0000-0000-000000000001');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/orders/00000000-0000-0000-0000-000000000001/invoice');
    expect(new Headers(init.headers).get('Accept')).toBe('application/octet-stream');
    expect(typeof result.arrayBuffer).toBe('function');
    expect(result.size).toBeGreaterThan(0);
  });
});