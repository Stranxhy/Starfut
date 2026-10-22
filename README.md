# Starfutbol · Panel administrativo

Aplicación web para administrar los torneos dominicales de futbol 7 de Starfutbol:
ligas, equipos, jugadores, árbitros, programación automática de partidos, resultados,
tabla general, goleo, sanciones, eliminatorias, documentos PDF e historial de cambios.

- **Frontend y backend:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **Base de datos:** PostgreSQL 16 (Docker) + Prisma ORM 6 con migraciones
- **Validación:** Zod en el servidor · **Sesión:** JWT firmado en cookie httpOnly (jose) + bcrypt
- **PDF:** @react-pdf/renderer (documentos vectoriales generados desde la base de datos)
- **Pruebas:** Vitest (dominio + integración con PostgreSQL) y prueba E2E con navegador (playwright-core)

## Requisitos

- Node.js 20 o superior (probado con Node 23.9)
- Docker Desktop (para PostgreSQL) — o un PostgreSQL 14+ propio
- Chrome o Edge instalado (solo para la prueba E2E y las capturas)

## Instalación rápida

```bash
npm install
cp .env.example .env            # y completa AUTH_SECRET y ADMIN_PASSWORD
npm run db:up                   # inicia PostgreSQL en Docker (puerto 5433)
npm run db:migrate              # aplica las migraciones
npm run db:seed                 # configuración inicial + usuario administrador
npm run db:demo                 # (opcional) temporada de DEMOSTRACIÓN con datos ficticios
npm run dev                     # http://localhost:3000
```

Inicia sesión con `ADMIN_EMAIL` / `ADMIN_PASSWORD` del archivo `.env`.
Si `ADMIN_PASSWORD` está vacío, el seed genera una contraseña aleatoria y la imprime en la terminal.

Producción: `npm run build && npm start` (ver [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)).

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run db:up` | Inicia PostgreSQL (docker compose) |
| `npm run db:migrate` | Aplica migraciones pendientes (no destructivo) |
| `npm run db:seed` | Configuración inicial idempotente y administrador |
| `npm run db:demo` / `npm run db:demo -- --clean` | Crea / elimina la temporada de demostración |
| `npm run db:backup` | Respaldo completo `pg_dump` en `backups/` |
| `npm run db:restore -- <archivo> --base <nueva>` | Restaura un respaldo en una base nueva |
| `npm test` | Todas las pruebas (unitarias + integración) |
| `npm run test:unit` / `npm run test:integration` | Pruebas por tipo |
| `npm run typecheck` | Verificación de tipos |
| `npm run pdf:samples` | Genera todos los PDF de la temporada demo en `test-output/pdf` |

## Documentación

- [docs/MANUAL.md](docs/MANUAL.md) — manual breve de administración
- [docs/INSTALACION.md](docs/INSTALACION.md) — instalación y configuración de la base de datos
- [docs/RESPALDOS.md](docs/RESPALDOS.md) — copias de seguridad y restauración
- [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) — despliegue en producción
- [docs/PRUEBAS.md](docs/PRUEBAS.md) — cómo ejecutar las pruebas y resultados obtenidos
- [docs/REGLAS_Y_DECISIONES.md](docs/REGLAS_Y_DECISIONES.md) — reglas deportivas implementadas y pendientes de confirmar
- [docs/ESTADO.md](docs/ESTADO.md) — funcionalidades completadas y limitaciones

## Estructura

```
prisma/              esquema, migraciones, seed (configuración) y demo (datos ficticios)
src/domain/          lógica deportiva pura y probada: puntuación, tabla, round-robin,
                     algoritmo húngaro, generador de calendario, conflictos, eliminatorias, goleo
src/server/services/ servicios con transacciones: partidos, resultados, calendario, eliminatorias…
src/server/actions/  acciones del servidor (validación Zod + permisos + auditoría)
src/app/(panel)/     pantallas del panel administrativo
src/app/api/         PDF, escudos, respaldo JSON, salud
src/pdf/             plantillas y generación de documentos PDF
src/components/      componentes de interfaz y formularios
tests/               pruebas unitarias e integración
scripts/             respaldo, restauración, E2E, capturas, muestras PDF
```
