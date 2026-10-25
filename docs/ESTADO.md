# Estado de la entrega

## Funcionalidades completadas y verificadas

| Módulo | Estado |
|---|---|
| Inicio de sesión, sesión segura, protección del panel y de la API, limitación de intentos | Probado |
| Dashboard con indicadores reales, alertas y accesos rápidos | Probado |
| Configuración: torneo, sede, temporada, día, jornadas, fechas excluidas, horarios, canchas, bloqueos | Probado |
| Reglas de puntuación y desempates por temporada y por liga | Probado |
| Formato de eliminatorias y zonas de color configurables | Probado |
| Temporadas múltiples (crear, copiar configuración/equipos, vigente, historial por temporada) | Probado (E2E) |
| Ligas (crear, editar, activar/desactivar, ficha con jornadas, reglas y estadísticas) | Implementado, verificado en pantalla |
| Equipos (alta, edición, escudo, baja lógica con impacto en calendario, duplicados, CSV, restricciones, historial) | Probado |
| Jugadores (alta, edición, cambio de equipo con historial, baja, CSV, goles y sanciones) | Implementado, verificado en pantalla |
| Calendario automático (round-robin + asignación óptima, vista previa, regenerar, confirmar, proteger) | Probado |
| Partidos (crear, editar, reprogramar, cancelar, sustituir, entre ligas, conflictos, historial) | Probado |
| Resultados (captura rápida, desempate, decisión administrativa, goleadores, correcciones, reversión) | Probado |
| Tabla general, tabla de goleo, criterios de desempate | Probado |
| Sanciones (unidades diferenciadas, estados, cumplimiento por partidos, filtros, historial) | Implementado y verificado en pantalla; lógica de cumplimiento con pruebas unitarias |
| Eliminatorias (validación de cierre, congelación, cuadro, generación por ronda, avance, campeón) | Probado |
| 12 documentos PDF con la identidad visual y datos reales | Probado (muestras + HTTP) |
| Historial de auditoría con filtros | Probado |
| Usuarios, cambio de contraseña, respaldo JSON, respaldo/restauración `pg_dump` | Probado |
| Diseño responsivo (escritorio y teléfono) | Verificado con capturas |

## Módulo retirado

- **Árbitros:** eliminado a petición de la liga el 24/10/2026 (registro, disponibilidad, asignación a
  partidos, columna en el rol y en el calendario, reporte PDF y rol de usuario "árbitro"). Antes de
  eliminarlo se respaldó la base en `backups/starfutbol_2026-10-24_19-31.dump`.

## Pendiente o con limitaciones

1. **Cuadro eliminatorio oficial:** no se recibió la imagen del cuadro; los cruces de cuartos en adelante son
   una propuesta configurable (ver [REGLAS_Y_DECISIONES.md](REGLAS_Y_DECISIONES.md)).
2. **Reglas por confirmar:** orden oficial de desempates y eliminatorias a un partido (implementado) o ida
   y vuelta (no implementado). La puntuación y el formato de penales ya están confirmados.
3. **Fondo de los PDF:** composición original (degradado rojo/negro, textura y silueta del jugador del logo);
   no reproduce la fotografía de las referencias, que no estaba disponible como recurso independiente.
4. **Logotipo blanco de los PDF:** derivado del logotipo original proporcionado (400×174 px) y ampliado; para
   máxima nitidez conviene sustituir `public/brand/logo-blanco.png` por una versión vectorial oficial.
5. **Rendimiento de PDF largos:** el calendario completo de todas las ligas tarda ~13–20 s y el historial
   completo ~11 s en el equipo de desarrollo; los demás documentos 0.5–2 s.
6. **Roles adicionales:** existen en el modelo (auxiliar y consulta) y el auxiliar puede capturar
   resultados, pero no hay pantallas específicas por rol ni consulta pública.
7. **Despliegue:** la aplicación no se ha publicado en Internet; ver [DESPLIEGUE.md](DESPLIEGUE.md).
8. **Limitador de intentos de acceso** en memoria (se reinicia con la aplicación; suficiente para una sola
   instancia).
9. **Escudos** se guardan en la base de datos (máx. 512 KB) y no aparecen aún en los PDF.
