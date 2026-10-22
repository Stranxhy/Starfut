# Pruebas

## Cómo ejecutarlas

```bash
npm run test:unit          # lógica deportiva (sin base de datos)
npm run test:integration   # servicios contra PostgreSQL (usa TEST_DATABASE_URL, nunca DATABASE_URL)
npm test                   # ambas
npm run typecheck
npx eslint .
```

Las pruebas de integración aplican las migraciones a la base de pruebas (`prisma migrate deploy`,
no destructivo) y cada archivo crea su propia temporada con nombre único.

### Prueba de extremo a extremo (navegador real)

Requiere Chrome o Edge instalado. Se ejecuta contra una compilación de producción conectada a la base de
**pruebas**:

```bash
npm run build
# preparar la base de pruebas (una vez): migraciones + administrador
DATABASE_URL="<TEST_DATABASE_URL>" npx prisma migrate deploy
DATABASE_URL="<TEST_DATABASE_URL>" npx tsx prisma/seed.ts
# servidor con la base de pruebas
DATABASE_URL="<TEST_DATABASE_URL>" INSECURE_COOKIES=1 npx next start -p 3200
# en otra terminal
npm run test:e2e -- http://localhost:3200 test-output/e2e
```

### Otras verificaciones

- `npm run smoke -- http://localhost:3000` — solicita todas las pantallas con una sesión de administrador
  (también acepta rutas, incluidas `/api/pdf/...`, y la variable `SEASON=<id>` para elegir temporada).
- `npm run pdf:samples` — genera 28 variantes de los 12 documentos PDF con la temporada demo y las
  rasteriza en `test-output/pdf/png/` para revisión visual.
- `node --env-file=.env scripts/screens.mjs <carpeta> <url> <rutas…>` — capturas de pantalla.

## Resultados obtenidos (20/10/2026)

| Verificación | Resultado |
|---|---|
| `tsc --noEmit` | Sin errores |
| `eslint .` | Sin errores ni advertencias |
| Pruebas unitarias (4 archivos) | **47 / 47** correctas (incluye formato de penales y completar jornada) |
| Pruebas de integración con PostgreSQL (4 archivos) | **24 / 24** correctas |
| E2E con navegador sobre compilación de producción | **15 / 15** pasos correctos |
| Smoke de pantallas (temporada oficial y demo, incluidas fichas de detalle) | 21 + 28 rutas con HTTP 200 |
| PDF por HTTP (12 documentos, con y sin filtros vacíos) | 200 y `%PDF` válido; parámetro obligatorio faltante → 400 con mensaje |
| Respaldo y restauración | Respaldo restaurado en una base nueva; conteos idénticos |
| Persistencia | Tras detener y reiniciar la aplicación los datos permanecen (266 partidos demo) |
| Compilación de producción (`next build`) | Correcta |

### Cobertura por área del plan de pruebas

- **Equipos y árbitros:** alta, edición, baja lógica, duplicados (aplicación y restricción única en BD),
  disponibilidad de árbitros y conflicto por no disponibilidad (unitarias, integración y E2E).
- **Calendario:** 14 jornadas; sin cancha, equipo ni árbitro duplicados en el mismo horario; número impar
  (descansos, cada equipo descansa una vez por vuelta); detección de repeticiones inevitables; situación
  imposible por falta de espacios; vista previa; confirmación con advertencias; protección de jornadas
  confirmadas; no regeneración de jornadas confirmadas; minimización de repeticiones al regenerar.
- **Cancelaciones:** cancelar, sustitución en el mismo espacio, reprogramación (estado y fecha original),
  partidos entre ligas (requieren tipo extraordinario), amistosos sin efecto en la tabla, historial.
- **Resultados:** victoria 3-0, desempate 2-1, empate definitivo bloqueado si no está configurado,
  corrección con motivo y registro de valores anterior/nuevo, reversión con recálculo, sin duplicación al
  guardar dos veces, cancelados sin puntos.
- **Estadísticas:** JJ/JG/JP/EG/EP/GF/GE/DIF/PTS, desempates (diferencia, goles a favor, enfrentamiento
  directo con dos y tres equipos, empate circular sin resolver y orden oficial manual), goleo y validación
  de goleadores contra el marcador, penales fuera de GF y del goleo, sanciones por partidos.
- **Eliminatorias:** detección de pendientes y autorización explícita, cierre y congelación, clasificados
  1–4 y 5–12, cruces 5-12/6-11/7-10/8-9, ronda bloqueada sin participantes, avance de ganadores, corrección
  controlada que actualiza la ronda siguiente, bloqueo de cambios que afectan una ronda ya disputada,
  campeón, imposibilidad de reabrir con partidos de eliminatoria.
- **PDF:** revisión visual de las muestras frente a las cuatro referencias (logotipo, colores, tipografía,
  alineación, saltos de página, encabezados repetidos, numeración, sin filas cortadas).
- **Seguridad:** credenciales incorrectas rechazadas, panel y API protegidos sin sesión (redirección/401),
  cierre de sesión.

## Defectos encontrados y corregidos durante las pruebas

1. Tras un inicio de sesión fallido se borraba el correo escrito (React 19 restablece los campos del
   formulario). Ahora se conserva.
2. Crear una temporada sin “copiar de” heredaba el número de jornadas de la temporada más reciente; ahora
   usa la configuración inicial (14 jornadas, domingo).
3. Filtros combinados de la lista de partidos (liga + equipo + alertas) se sobrescribían entre sí.
4. Expectativa incorrecta de una prueba de árbitros (con 2 árbitros × 6 horarios no caben 13 partidos: el
   sistema reporta correctamente 1 partido sin árbitro).
