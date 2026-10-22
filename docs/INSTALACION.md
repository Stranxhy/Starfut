# Instalación y configuración de la base de datos

## 1. Dependencias

```bash
npm install
```

## 2. Variables de entorno

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión PostgreSQL. Con docker-compose: `postgresql://starfutbol:starfutbol_dev@localhost:5433/starfutbol?schema=public` |
| `TEST_DATABASE_URL` | Base **distinta** para las pruebas de integración (p. ej. `.../starfutbol_test`) |
| `AUTH_SECRET` | Secreto aleatorio de 32+ caracteres para firmar la sesión. Genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Administrador inicial que crea `db:seed` (solo si no existe) |
| `APP_TIMEZONE` | Zona horaria de la liga (por defecto `America/Mexico_City`) |

No subas `.env` al repositorio (está en `.gitignore`). En producción cambia la contraseña de
PostgreSQL definiendo `POSTGRES_PASSWORD` antes de `docker compose up`.

## 3. Base de datos

### Con Docker (recomendado)

```bash
npm run db:up        # docker compose up -d db  → PostgreSQL 16 en el puerto 5433, volumen persistente
npm run db:migrate   # prisma migrate deploy
npm run db:seed      # torneo, sede, 5 canchas, temporada con 2 ligas, 14 jornadas, 6 horarios, reglas, administrador
```

### Con un PostgreSQL existente

Crea una base vacía, ajusta `DATABASE_URL` y ejecuta `npm run db:migrate && npm run db:seed`.

La migración inicial incluye, además de las tablas, restricciones de integridad a nivel de base de datos:
una cancha no puede tener dos partidos activos en la misma fecha y horario, un árbitro no puede tener
dos partidos simultáneos, un equipo no puede enfrentarse a sí mismo, marcadores no negativos y una sola
temporada vigente.

## 4. Datos de demostración (opcional)

```bash
npm run db:demo           # crea "[DEMO] Temporada de demostración 2026"
npm run db:demo -- --clean  # la elimina
```

Los registros de demostración están marcados (`isDemo`) y viven en una temporada separada; el panel
muestra un aviso cuando se consulta.

## 5. Iniciar

```bash
npm run dev          # desarrollo: http://localhost:3000
npm run build && npm start   # producción
```

Comprobación de salud: `GET /api/health` → `{"ok":true,"db":"ok"}`.

> Nota sobre OneDrive: si el proyecto está dentro de OneDrive, OneDrive puede convertir los archivos de
> la carpeta `.next` en marcadores de posición y romper la compilación (`EINVAL: readlink`). Por eso
> `npm run build` ejecuta antes `scripts/prebuild.mjs`, que limpia `.next` y la marca como "mantener
> siempre en este dispositivo". Para producción se recomienda una carpeta fuera de carpetas sincronizadas.
