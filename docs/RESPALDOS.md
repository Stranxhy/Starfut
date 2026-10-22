# Copias de seguridad y restauración

## Respaldo completo (recomendado)

```bash
npm run db:backup
```

Crea `backups/starfutbol_AAAA-MM-DD_HH-MM.dump` con `pg_dump -Fc` (formato comprimido de PostgreSQL).
Usa `pg_dump` local si existe; si no, el del contenedor Docker `starfutbol-db` (configurable con
`DB_CONTAINER`).

Recomendaciones:
- Ejecutarlo después de capturar los resultados de cada jornada y antes de cerrar la fase regular.
- Copiar la carpeta `backups/` a un almacenamiento externo (otra computadora o nube).
- Programarlo con el Programador de tareas de Windows o `cron` en Linux.

## Restauración

### Verificar un respaldo (sin tocar los datos actuales)

```bash
npm run db:restore -- backups/starfutbol_2026-10-20_23-59.dump --base starfutbol_verificacion
```

Crea una base **nueva** con el contenido del respaldo. Si la base ya existe, el script se detiene para no
sobrescribir nada. Para usarla, cambia el nombre de la base en `DATABASE_URL` y reinicia la aplicación.

### Reemplazar la base actual (destructivo)

1. Detén la aplicación.
2. Haz un respaldo del estado actual (`npm run db:backup`).
3. Ejecuta:
   ```bash
   npm run db:restore -- backups/archivo.dump --reemplazar-base-actual
   ```
4. Inicia la aplicación y verifica el Dashboard.

## Respaldo lógico en JSON

En **Usuarios y respaldos → Descargar respaldo JSON** un administrador puede descargar todos los
registros (sin contraseñas ni escudos). Es una copia portátil para consulta o auditoría; la restauración
completa se hace con el archivo `.dump`.

## Verificación realizada

Se ejecutó `npm run db:backup` y se restauró el archivo en una base nueva; los conteos de partidos,
resultados e historial coincidieron con la base original (266 / 246 / 251 registros en ese momento).
