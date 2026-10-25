# Manual breve de administración

## 0. Cómo está organizado el menú

- **Inicio:** la jornada, el botón para registrar resultados y los PDF listos para WhatsApp.
- **Domingo:** Resultados, Partidos y Calendario.
- **Clasificación:** Tabla general, Goleo y Eliminatorias.
- **Registro:** Equipos, Jugadores y Sanciones.
- **PDF para WhatsApp:** rol, resultados, tabla y goleo; al tocarlos se elige la liga.
- **Ajustes** (plegado): Ligas, Configuración, Historial de cambios y Usuarios.

## 1. Acceso

Entra a la dirección de la aplicación e inicia sesión con tu correo y contraseña. Tras 8 intentos
fallidos se bloquea el acceso durante 15 minutos. Cambia tu contraseña en **Usuarios y respaldos**.

El selector **Temporada** (barra superior) define qué temporada estás consultando. La temporada de
demostración muestra una franja amarilla: sus datos son ficticios.

## 2. Preparar la temporada (una vez)

1. **Configuración → General:** nombre del torneo, sede (aparece en los PDF), primera fecha de juego,
   día de juego, número de jornadas (14), fechas sin jornada y partidos entre ligas.
2. **Configuración → Horarios y canchas:** horarios (08:10 … 12:20) y canchas (1–5). Puedes bloquear una
   cancha en una fecha u horario (mantenimiento).
3. **Configuración → Puntuación y desempates:** 3-0 en tiempo regular, 2-1 por desempate; el empate
   definitivo está desactivado hasta que el reglamento defina sus puntos. Orden de criterios de desempate.
   Cada liga puede tener reglas propias.
4. **Configuración → Eliminatorias y zonas:** cruces del cuadro y colores de la tabla. **Confirma los
   cruces con el cuadro oficial** y marca la casilla de confirmación.
5. **Ligas / Equipos / Jugadores:** registra los datos (los equipos y jugadores también se pueden
   importar por CSV).

## 3. Generar el calendario

**Calendario y jornadas → Generar vista previa.** Revisa:
- resumen (partidos, repetidos, conflictos, sin espacio) y advertencias;
- verificación por liga: “Sin repeticiones (verificado)” o “Repeticiones matemáticamente inevitables”
  (cuando hay más jornadas que rivales posibles);
- distribución de horarios por equipo;
- el detalle de cada jornada.

Usa **Regenerar propuesta** para otra combinación o **Confirmar calendario**. Si hay advertencias, el
sistema pide confirmarlas explícitamente. Las jornadas confirmadas quedan **protegidas**: cualquier
cambio pide un motivo y queda en el historial.

## 4. El domingo

- **PDF para WhatsApp:** cuatro botones (rol de juegos, resultados, tabla general y goleo), en Inicio y en
  **PDF para WhatsApp**. Al tocar uno, el sistema pregunta de qué liga lo quieres y abre ese PDF; la flecha
  hace lo mismo pero lo descarga para compartirlo. El rol usa la próxima fecha y los resultados la última
  jugada (se pueden cambiar arriba). Si una liga tiene un partido combinado con la otra, aparece en los PDF
  de ambas, con la liga del rival entre paréntesis.
- **Completar jornada:** si por una cancelación o por descanso (número impar de equipos) algún equipo se
  queda sin partido, el Dashboard lo avisa. En **Partidos → Completar jornada** el sistema propone los
  partidos: primero dentro de la misma liga y, con los que sobran, combinando ambas ligas; asigna horario,
  y cancha libres. Revisa y crea los partidos con un clic. Todos cuentan para la tabla (en los
  combinados, cada equipo suma en la tabla de su liga).
- **Resultados:** captura rápida por fecha. Si el marcador queda empatado aparecen los campos de penales
  (o el selector de ganador si no se conoce el marcador del desempate). Para goleadores u otras
  observaciones usa **Detalle y goleadores**. Corregir un resultado exige motivo.
- **Cancelaciones:** en el partido → **Cancelar partido** (motivo obligatorio). Luego
  **Crear partido en este espacio** para aprovechar horario y cancha. Elige la naturaleza:
  *Sustitución* (cuenta para la tabla), *Amistoso* (no cuenta) o *Extraordinario entre ligas*.
  Una cancelación nunca se convierte en derrota automáticamente: si hay una resolución oficial, registra
  el resultado como **decisión administrativa** e indica la resolución.
- **Reprogramar:** en el partido → **Reprogramar**; el sistema muestra los espacios libres.

## 5. Tabla, goleo y sanciones

- **Tabla general** y **Tabla de goleo** se calculan solas a partir de los resultados oficiales.
- **Sanciones:** registra jugador, tipo, motivo, duración y unidad (partidos, minutos, días…). Para las
  sanciones por partidos registra cada partido cumplido; al completarse se marca *Cumplida*.

## 6. Eliminatorias

**Eliminatorias:** revisa la validación del cierre (jornadas, pendientes, empates sin resolver, cuadro),
la tabla que se congelará y cierra la fase regular. Si hay pendientes, debes autorizarlo explícitamente.
Después genera cada ronda indicando la fecha confirmada; los ganadores avanzan automáticamente al
registrar los resultados. Al terminar la final se registra el campeón.

## 7. Otros PDF

En **PDF para WhatsApp → Otros documentos**: sanciones, cuadro de eliminatorias, calendario completo,
historial de resultados, cancelaciones y reprogramaciones, estadísticas de un equipo y listado de equipos.

## 8. Historial y respaldos

- **Historial de cambios:** quién hizo qué, cuándo, valores anteriores y nuevos, y motivo.
- **Respaldos:** ver [RESPALDOS.md](RESPALDOS.md). Recomendado: un respaldo después de capturar los
  resultados de cada domingo.
