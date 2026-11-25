# Despliegue en el servidor de la Facultad

Guía para publicar **Huellas Sin Hogar** (backend Express + Prisma/PostgreSQL y frontend React/Vite) usando Docker Compose y Nginx.

La arquitectura que se despliega es:

```
Internet
   │  :80 / :443
   ▼
 Nginx (contenedor `web`)  ── sirve el frontend compilado
   │  /api  y  /uploads
   ▼
 Backend Express (`backend`, :3000)  ── solo red interna
   │
   ▼
 PostgreSQL 16 (`db`)  ── solo red interna, volumen persistente
```

Solo el contenedor `web` queda expuesto. La base de datos y el backend **no** son accesibles desde fuera.

---

## 1. Prerrequisitos en el servidor

- Linux (Ubuntu/Debian recomendado) con acceso `sudo`.
- **Docker Engine** y **Docker Compose v2**.
- Git (para clonar/actualizar) o acceso para copiar el proyecto.
- Puerto `80` libre (o el que definas en `HTTP_PORT`).

Instalación de Docker en Ubuntu (si no está):

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"
# Cierra y vuelve a abrir la sesión SSH para aplicar el grupo
```

Verifica:

```bash
docker --version
docker compose version
```

---

## 2. Obtener el proyecto

```bash
sudo mkdir -p /opt/huellas-sin-hogar
sudo chown "$USER":"$USER" /opt/huellas-sin-hogar
git clone <URL_DEL_REPOSITORIO> /opt/huellas-sin-hogar
cd /opt/huellas-sin-hogar
```

> Si el repositorio es privado, usa una clave SSH o un token de acceso.

---

## 3. Configurar variables de entorno

```bash
cd deploy
cp .env.example .env
nano .env
```

Valores obligatorios a cambiar:

| Variable | Descripción |
| :--- | :--- |
| `POSTGRES_PASSWORD` | Contraseña fuerte para la base de datos. |
| `JWT_SECRET` | Secreto de firma de tokens. Genera uno con `openssl rand -base64 48`. |
| `RUN_SEED` | `true` **solo la primera vez**, para crear usuarios y datos iniciales. Luego `false`. |
| `CORS_ORIGIN` | Déjalo vacío si todo se sirve desde el mismo dominio. Si no, `https://tu-dominio`. |
| `VITE_API_URL` | Por defecto `/api` (ruta relativa a través de Nginx). No lo cambies salvo que uses otro dominio para la API. |
| `HTTP_PORT` | Puerto público de Nginx (por defecto `80`). |

> ⚠️ El archivo `deploy/.env` está ignorado por Git. Nunca lo subas al repositorio.

---

## 4. Primer arranque

```bash
cd /opt/huellas-sin-hogar/deploy
docker compose up -d --build
```

El contenedor del backend espera a PostgreSQL, aplica las migraciones (`prisma migrate deploy`) y, si `RUN_SEED=true`, carga los datos iniciales.

Verifica el estado:

```bash
docker compose ps
docker compose logs -f backend
```

Debe aparecer `Servidor Huellas Sin Hogar corriendo en puerto 3000`.

Prueba de salud:

```bash
curl -i http://localhost/health
# Esperado: {"status":"OK","shelter":"Huellas Sin Hogar"}
```

Abre en el navegador:

```
http://IP_DEL_SERVIDOR/
```

**Cuentas iniciales** (solo si ejecutaste el seed):

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| Dirección | `directora@huellas.cl` | `admin123` |
| Veterinaria | `veterinaria@huellas.cl` | `admin123` |

> Cambia estas contraseñas antes de dar el sistema al personal real.

### Después del primer arranque

Edita `deploy/.env` y pon `RUN_SEED=false`, luego:

```bash
docker compose up -d
```

Esto evita volver a insertar datos de ejemplo en reinicios.

---

## 5. Dominio y HTTPS (recomendado)

Si la Facultad te asigna un dominio o subdominio (por ejemplo `huellas.facultad.edu`), lo más sencillo es usar el Nginx del propio servidor como terminador TLS y que reenvíe al contenedor.

1. Cambia el puerto del contenedor para no ocupar el 80 del host:

   ```bash
   # deploy/.env
   HTTP_PORT=8080
   ```

2. Reinicia:

   ```bash
   docker compose up -d
   ```

3. Instala Nginx y Certbot en el host:

   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

4. Crea `/etc/nginx/sites-available/huellas`:

   ```nginx
   server {
       listen 80;
       server_name huellas.facultad.edu;

       client_max_body_size 12m;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

5. Actívalo y obtén el certificado:

   ```bash
   sudo ln -s /etc/nginx/sites-available/huellas /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d huellas.facultad.edu
   ```

6. Si configuraste un dominio, define también en `deploy/.env`:

   ```bash
   CORS_ORIGIN=https://huellas.facultad.edu
   ```

   y vuelve a levantar (`docker compose up -d`).

Con `trust proxy` habilitado en el backend y las cabeceras `X-Forwarded-*`, las URLs de las fotos subidas se generan correctamente con `https`.

---

## 6. Operación habitual

### Ver logs

```bash
docker compose logs -f            # todos
docker compose logs -f backend    # solo backend
```

### Actualizar la aplicación

```bash
cd /opt/huellas-sin-hogar
git pull
cd deploy
docker compose up -d --build
```

Las migraciones nuevas se aplican automáticamente al reiniciar el backend.

### Reiniciar / detener

```bash
docker compose restart
docker compose down          # detiene (conserva datos)
docker compose down -v       # ⚠️ borra también la base y las fotos
```

### Respaldos

Base de datos:

```bash
cd /opt/huellas-sin-hogar/deploy
docker compose exec -T db pg_dump -U huellas -d huellas_sin_hogar \
  | gzip > "backup_$(date +%F_%H%M).sql.gz"
```

Fotos subidas (volumen `uploads`):

```bash
docker run --rm -v huellas-sin-hogar_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads_$(date +%F).tar.gz -C /data .
```

Restaurar base de datos:

```bash
gunzip -c backup_2026-11-25.sql.gz | \
  docker compose exec -T db psql -U huellas -d huellas_sin_hogar
```

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

No abras `3000` ni `5432`: no deben ser públicos.

---

## 7. Alternativa sin Docker (referencia)

Si el servidor de la Facultad no permite Docker, el despliegue equivalente es:

1. Instalar Node.js 20, PostgreSQL 16 y Nginx.
2. Crear la base `huellas_sin_hogar` y un usuario con contraseña.
3. En `backend/`: `npm ci`, configurar `backend/.env`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run prisma:seed` (una vez) y `npm start`.
4. En `frontend/`: `npm ci` y `VITE_API_URL=/api npm run build`; copiar `dist/` a `/var/www/huellas`.
5. Servir `dist/` con Nginx y hacer proxy de `/api/` y `/uploads/` a `http://127.0.0.1:3000`.
6. Mantener el backend con systemd:

   ```ini
   # /etc/systemd/system/huellas-backend.service
   [Unit]
   Description=Huellas Sin Hogar Backend
   After=network.target postgresql.service

   [Service]
   WorkingDirectory=/opt/huellas-sin-hogar/backend
   ExecStart=/usr/bin/node index.js
   Restart=always
   EnvironmentFile=/opt/huellas-sin-hogar/backend/.env

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now huellas-backend
   ```

---

## 8. Solución de problemas

| Síntoma | Causa probable | Solución |
| :--- | :--- | :--- |
| `POSTGRES_PASSWORD` / `JWT_SECRET` faltante | `.env` incompleto | Completa `deploy/.env` y reinicia. |
| `502 Bad Gateway` en el frontend | Backend aún arrancando o migración falló | `docker compose logs backend`. |
| Las fotos subidas dan 404 | Volumen `uploads` no montado | Verifica `docker compose config` y el volumen. |
| Errores CORS | `CORS_ORIGIN` no coincide con el dominio | Ajusta `CORS_ORIGIN` o déjalo vacío con mismo dominio. |
| El frontend llama a `localhost:3000` | Build sin `VITE_API_URL` | Reconstruye: `docker compose build --no-cache web`. |
| Cambios no aparecen | Caché del navegador / build antiguo | Reconstruye `web` y recarga con Ctrl+F5. |

---

## 9. Checklist final

- [ ] `deploy/.env` con contraseña y `JWT_SECRET` propios.
- [ ] `RUN_SEED=false` tras el primer arranque.
- [ ] Contraseñas por defecto cambiadas.
- [ ] `GET /health` responde `OK`.
- [ ] Login y una operación real (p. ej. alta de animal) funcionan.
- [ ] Puerto `80/443` abierto; `3000` y `5432` cerrados.
- [ ] Respaldo de base de datos probado.
- [ ] HTTPS activo si hay dominio.
