# Despliegue

> La aplicación **no** ha sido publicada en Internet. Estas son las instrucciones para hacerlo.

## Opción A: servidor propio (Windows o Linux) con Docker para la base de datos

1. Instala Node.js 20+ y Docker.
2. Copia el proyecto (fuera de carpetas sincronizadas como OneDrive).
3. Crea `.env` con valores de producción: `AUTH_SECRET` nuevo, `POSTGRES_PASSWORD` robusta (y la
   misma en `DATABASE_URL`), `ADMIN_PASSWORD` temporal.
4. Ejecuta:
   ```bash
   npm ci
   docker compose up -d db
   npm run db:migrate
   npm run db:seed
   npm run build
   npm start               # puerto 3000 (PORT=xxxx para cambiarlo)
   ```
5. Mantén el proceso activo con un administrador de servicios (p. ej. `pm2 start npm --name starfutbol -- start`
   o un servicio de Windows/NSSM) y colócalo detrás de un proxy HTTPS (Caddy, Nginx o IIS).
6. Programa `npm run db:backup` diario.

La cookie de sesión es `Secure` en producción: se requiere HTTPS. Para una red local sin HTTPS, define
`INSECURE_COOKIES=1` (no recomendado en Internet).

## Opción B: plataforma administrada

- Base de datos: cualquier PostgreSQL administrado (Neon, Supabase, Railway, RDS…). Define `DATABASE_URL`
  y ejecuta `npm run db:migrate` y `npm run db:seed` una vez.
- Aplicación: cualquier plataforma compatible con Next.js 15 en modo Node (Vercel, Railway, Render…).
  Las rutas `/api/pdf/*` usan el runtime de Node.js (`@react-pdf/renderer`), no el Edge.
- Variables: `DATABASE_URL`, `AUTH_SECRET`, `APP_TIMEZONE`.

## Actualizaciones

```bash
npm run db:backup
git pull && npm ci
npm run db:migrate
npm run build && (reiniciar el servicio)
```
