# VB-assessment-frontend

Frontend React + TypeScript para autenticarse contra Spring Boot con JWT y consumir los endpoints de órdenes.

## Configuración

1. Copia `.env.example` a `.env.local`.
2. Ajusta `REACT_APP_API_URL` si tu backend no corre en `http://localhost:8080`.
3. Instala dependencias con `npm install`.
4. Arranca el frontend con `npm run dev`.

La app usa `/api/v1/*` en el navegador y el dev server de Vite proxyfía `/api` al backend configurado en `REACT_APP_API_URL`. Si prefieres servir el frontend en otro host sin proxy, habilita CORS en Spring Boot y apunta la variable al backend real.

## Autenticación y autorización

- Login: `POST /api/v1/auth/login`
- El token se guarda en memoria de la app (React state) y se agrega como `Authorization: Bearer <token>` en cada llamada protegida.
- El rol se resuelve desde la respuesta de login y la UI muestra acciones administrativas solo para `ADMIN`.
- Si una petición devuelve `401`, el frontend cierra sesión y vuelve a login.
- Si una petición devuelve `403`, la UI muestra un mensaje de sin permisos.

## Endpoints cubiertos

- `POST /api/v1/orders/archive-rejected`
- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `POST /api/v1/orders/{id}/approve`
- `POST /api/v1/orders/{id}/reject`
- `POST /api/v1/orders/{id}/invoice`

## Validación rápida con curl

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local","password":"Admin123!"}'

curl -X POST http://localhost:8080/api/v1/orders/archive-rejected \
  -H "Authorization: Bearer <token>"
```

## Tests


También queda una colección de Postman en `postman/VB-assessment.postman_collection.json`.
También queda una colección de Postman en `postman/VB-assessment.postman_collection.json`.