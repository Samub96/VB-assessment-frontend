# ==========================================
# Etapa 1: Construcción (Build Stage)
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

# Copiar archivos de dependencias para aprovechar la caché de capas de Docker
COPY package.json package-lock.json ./

# Instalar dependencias del proyecto de forma limpia y determinista
RUN npm ci

# Copiar el resto del código fuente del frontend
COPY . .

# Argumentos opcionales para establecer la URL del backend durante la construcción
# Si no se proveen, la aplicación utilizará los valores por defecto
ARG VITE_REACT_APP_API_URL=http://localhost:8080
ENV VITE_REACT_APP_API_URL=${VITE_REACT_APP_API_URL}

# Compilar la aplicación para producción (TypeScript + Vite)
RUN npm run build

# ==========================================
# Etapa 2: Servidor Web (Nginx Stage)
# ==========================================
FROM nginx:stable-alpine AS production

# Metadatos del contenedor
LABEL maintainer="VB Assessment Team"
LABEL description="Frontend SPA para VB Assessment - React + TypeScript + Vite"

# Crear usuario no-root para mejor seguridad
RUN addgroup -g 101 -S nginx && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx || true

# Copiar la configuración personalizada de Nginx para SPA (Single Page Application)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos compilados del frontend desde la etapa de construcción
COPY --from=build /app/dist /usr/share/nginx/html

# Establecer permisos correctos
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Health check para verificar que Nginx está respondiendo
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Exponer el puerto 80 del contenedor
EXPOSE 80

# Ejecutar Nginx en primer plano (daemon off)
CMD ["nginx", "-g", "daemon off;"]
