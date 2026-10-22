# Reglas deportivas: implementadas, inferidas y pendientes de confirmar

## Confirmadas por la liga (20/10/2026)

| Regla | Valor |
|---|---|
| Victoria en tiempo regular | 3 puntos al ganador, 0 al perdedor |
| Empate en tiempo regular | Siempre se define por penales: **3 tiros por equipo y después muerte súbita** |
| Victoria en penales | 2 puntos |
| Derrota en penales | 1 punto |
| Empate definitivo | **No existe** (desactivado) |

Cada domingo juegan dos ligas, cada una con sus propios equipos; el calendario se genera por liga y el rol
de juegos se entrega **en un PDF por liga**. Si por una cancelación u otra causa algún equipo se queda sin
partido, se **combinan equipos de ambas ligas** para que nadie se quede sin jugar (Partidos → Completar
jornada). Por eso los partidos entre ligas están permitidos en la configuración de la temporada.
**Todos los partidos cuentan para la tabla**, también los combinados: cada equipo suma en la tabla de su
liga. Solo un partido declarado expresamente "amistoso" no cuenta.

El sistema rechaza marcadores de penales imposibles con ese formato: una diferencia de 2 o más solo puede
darse dentro de los 3 tiros (por ejemplo 2-0, 3-1); en muerte súbita la diferencia final es de 1 (4-3,
6-5). Si no se conoce el marcador de penales, puede registrarse solo el ganador. El número de tiros se
configura en Configuración → Puntuación y desempates (vacío = sin validar).

## Implementadas según la especificación

| Regla | Valor |
|---|---|
| Partidos pendientes / cancelados | No asignan puntos. La derrota por incomparecencia solo se registra como “decisión administrativa oficial” con resolución escrita |
| Penales | Se registran aparte; no suman a GF/GE ni al goleo |
| Amistosos | No alteran la clasificación ni el goleo oficial |
| Desempate en tabla (propuesta inicial) | Puntos → diferencia de goles → goles a favor → enfrentamiento directo (configurable, por liga) |
| Clasificación (confirmado) | Tras las 14 jornadas: 1–4 directo a cuartos; 5–12 repechaje (5-12, 6-11, 7-10, 8-9) el domingo siguiente |
| Eliminatorias (confirmado) | A un solo partido; si hay empate, se define por penales |
| Después del cierre (confirmado) | Solo cuentan los partidos de eliminatoria. Los demás equipos pueden jugar ese día, pero el sistema registra esos partidos como amistosos (no cuentan) |
| Partidos entre ligas | Desactivados por defecto; autorización individual como “extraordinario” |

## Inferidas de las imágenes de referencia (verificar)

- **EG / EP** en la tabla de referencia significan *empate ganado* / *empate perdido* (victoria o derrota
  en el desempate). Se comprobó con la fila de Cuauteboys FC: 9 JG × 3 + 2 EG × 2 + 1 EP × 1 = 32 puntos.
  Por eso la tabla muestra JJ, JG, JP, EG, EP y añade la columna **E** (empates definitivos) solo si la liga
  los habilita.
- **Cruces del repechaje:** 5.º vs 12.º, 6.º vs 11.º, 7.º vs 10.º y 8.º vs 9.º, deducidos de los colores por
  parejas en la tabla general (azul, morado, naranja y gris).
- En el PDF de resultados, la marca “EG” junto a los goles identifica al ganador del desempate.

## Pendientes de confirmar con la liga

1. ~~Cuadro de eliminatorias~~ — confirmado: cuartos 1.º vs ganador 8-9, 2.º vs ganador 7-10, 3.º vs
   ganador 6-11, 4.º vs ganador 5-12; semifinales ganador C1 vs C4 y C2 vs C3; final. Sin partido por el
   tercer lugar (se puede agregar en Configuración → Eliminatorias y zonas).
2. ~~Empate definitivo~~ — confirmado: no existe; se define por penales.
3. **Orden oficial de criterios de desempate** en tabla y en goleo (por defecto, los jugadores empatados
   comparten posición).
4. ~~¿Los partidos combinados cuentan?~~ — confirmado: **todos los partidos cuentan para la tabla**,
   incluidos los combinados entre ligas (cada equipo suma en la tabla de su propia liga).
5. ~~Formato de eliminatorias~~ — confirmado: a un solo partido.
6. **Nombre de la segunda liga:** se mantiene “Liga 2” por ahora (se edita en Ligas).
7. **Goles de un jugador que cambia de equipo:** el goleo suma todos sus goles y muestra el desglose por
   equipo; los goles nunca se transfieren a la estadística de otro equipo.

## Decisiones técnicas relevantes

- Un árbitro activo se considera disponible salvo que exista un registro de no disponibilidad.
- Si la asignación de árbitro es obligatoria, los partidos sin árbitro se señalan como alerta y la
  confirmación del calendario exige aceptar explícitamente esa situación.
- Las estadísticas no se almacenan: se recalculan siempre desde los resultados oficiales.
- Los empates que los criterios no resuelven se conservan; al cerrar la fase regular se exige el orden
  oficial con su justificación si afectan la clasificación.
