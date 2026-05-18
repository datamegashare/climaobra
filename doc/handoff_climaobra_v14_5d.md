# ClimaObra — Handoff v14.5c

**Fecha:** Mayo 2026
**Archivos entregados esta sesión:** `clima\_v13\_11.gs`

\---

## Prompt para continuar en chat nuevo

```
Continuamos con ClimaObra (datamegashare.github.io/climaobra/).

Stack: GitHub Pages + Google Apps Script + Google Sheets + Google Identity Services (OAuth).
El GAS usa doGet (GET con parámetros), no doPost. Sin fix CORS necesario.

─── ARCHIVOS EN PRODUCCIÓN ───────────────────────────────────────────
  clima\_v13\_10.gs    → GAS backend (en producción desde esta sesión)
  index\_v14\_5.html   → Frontend PWA (en producción, sin cambios esta sesión)
  manifest.json      → PWA manifest
  sw.js              → Service Worker (cache climaobra-v11 — pendiente actualizar a v14)
  favicon.svg        → Ícono personalizado v2 (sol + nube + casco)
  fuentes.html       → Página standalone de metodología (pendiente actualizar con OM)

─── CREDENCIALES ─────────────────────────────────────────────────────
  CLIENT\_ID = '985022387906-5h3qtmq6jifdl5jdv77o4amf9nb3mcdn.apps.googleusercontent.com'
  API\_URL   = 'https://script.google.com/macros/s/AKfycbzH5slzkOQ8fvhCt9JXIoMFNxrBZghZv34fowPI2Yk948eTxhZmHFX37InwpnxmkVBU/exec'
  GCP Project: tokyo-rider-451113-n5
  VERSION\_UI  = 'v14.5' (constante JS en index.html — sin cambios esta sesión)
  VERSION\_GAS = 'v13.10' (GAS en producción)

─── ESTRUCTURA DEL SHEET ─────────────────────────────────────────────
  Hoja Obras:
    ObraID | Descripción | Latitud | Longitud |
    Hora inicio | Hora fin | Lluvia DP (mm) | Viento DP (km/h) |
    Condición DP | Activa
    ⚠️ Columna A formateada como "Texto sin formato" — crítico

  Hoja Usuarios:
    Email | Nombre | Activo (checkbox) | Rol (ADMIN/USER) | Obras (IDs separados por coma)

  Hoja Registros:
    ObraID | ObraDesc | Timestamp | Fecha | Hora | Latitud | Longitud |
    Temperatura | Sensación | Precipitación | Humedad | Viento | Descripción | Fuente
    ⚠️ Columna A formateada como "Texto sin formato" — crítico
    ⚠️ Solo 14 columnas — las columnas de comentarios fueron eliminadas en v13.7

  Hoja Registros\_OM: (mismas columnas que Registros, 14 cols)
    Fuente = "open-meteo"
    Trigger diario 05:00 activo → carga día anterior automáticamente

  Hoja Comentarios: (NUEVA — v13.7)
    ObraID | Fecha | Hora | ComentarioTexto | ComentarioCriticidad |
    ComentarioUsuario | ComentarioEstado
    · Fuente única para wttr.in y Open-Meteo por igual
    · ComentarioCriticidad: 'normal' | 'atencion' | 'critico'
    · ComentarioEstado: 'activo' | 'cancelado'

  Obras activas:
    0000 - Casa AP (coords: -34.5856758, -58.5714108)
    1320 - Planta Potabilizadora Ensenada (coords: -34.8477494, -57.9332436)
    1333 - Anillo Pampa - CABA (coords: -34.5517153, -58.4349864)

─── ACCIONES doGet (GAS v13.10) ─────────────────────────────────────
  ?action=ping
  ?action=solicitarAcceso\&emailSolicitante=x\&nombreSolicitante=x
  ?action=obras\&email=x
  ?action=allObras\&email=x
  ?action=data\&email=x\&obraId=0000              → dashboard wttr.in
  ?action=dataOM\&email=x\&obraId=0000            → dashboard Open-Meteo
  ?action=usuarios\&email=x
  ?action=addObra\&email=x\&...
  ?action=editObra\&email=x\&...
  ?action=deleteObra\&email=x\&id=x
  ?action=addUsuario\&email=x\&...
  ?action=editUsuario\&email=x\&...
  ?action=deleteUsuario\&email=x\&emailTarget=x
  ?action=exportData\&email=x\&obraId=x\&fechaDesde=yyyy-MM-dd\&fechaHasta=yyyy-MM-dd
  ?action=reportData\&email=x\&obraId=x\&anio=2026\&mes=4    → informe PDF wttr.in
  ?action=reportDataOM\&email=x\&obraId=x\&anio=2026\&mes=4  → informe PDF OM
  ?action=gethorasregistro\&email=x\&obraId=x\&fecha=dd/MM/yyyy  → horas disponibles (fallback)
  ?action=getcomentarios\&email=x\&obraId=x\&fechaDesde=dd/MM/yyyy\&fechaHasta=dd/MM/yyyy
  ?action=savecomentario\&email=x\&obraId=x\&fecha=x\&hora=x\&texto=x\&criticidad=x
  ?action=editcomentario\&email=x\&obraId=x\&fecha=x\&hora=x\&texto=x\&criticidad=x
  ?action=cancelcomentario\&email=x\&obraId=x\&fecha=x\&hora=x

─── OPEN-METEO — lógica de endpoint (v13.10) ────────────────────────
  obtenerClimaOMRango(): selección automática según antigüedad:
    fechaHasta < hoy - 5 días → /v1/archive (ERA5 confirmado)
    fechaHasta ≥ hoy - 5 días → /v1/forecast (cubre ayer y recientes)

  ⚠️ ERA5 tiene lag de 2-5 días — el día anterior NO está disponible
     en /v1/archive hasta pasados \~5 días. /v1/forecast cubre ese gap.

  Historial de bugs corregidos en esta área:
    v13.9  → fix: archive para cualquier fecha < hoy (rompía ayer)
    v13.10 → fix: corte en hoy-5 (ERA5 lag); forecast para días recientes

  cargarCatchUpOM(): recupera días faltantes automáticamente (menú 7c)
  cargarAyerOM():   carga manualmente el día anterior (menú 7d) — NUEVA

─── COMENTARIOS — arquitectura (v13.7+) ─────────────────────────────
  Hoja "Comentarios" independiente — multi-fuente
  COL\_COM: obraId=1, fecha=2, hora=3, texto=4, criticidad=5, usuario=6, estado=7
  \_horaToStr(): convierte Date/decimal/string de Sheets → 'HH:mm'
  getDashboardData / getDashboardDataOM devuelven horasPorDia:
    { 'dd/MM/yyyy': \['08:00','09:00',...] } para últimos 28 días
  Frontend usa globalHorasPorDia (local, instantáneo) para el selector de horas
  Fallback a GAS solo si la fecha no está en el período cargado

─── FUENTE DE DATOS — SELECTOR EN FRONTEND ──────────────────────────
  Variable global: fuenteActual = 'wttr' | 'om'
  Toggle en header desktop Y mobile (fuente-toggle + fuente-toggle-mob)
  cambiarFuente(fuente): sincroniza ambos toggles + recarga dashboard

─── COMENTARIOS — UX FRONTEND ───────────────────────────────────────
  Botón "💬 Comentario" (naranja, btn-accion):
    · Posición: a la izquierda de "⬇ Informe PDF"
    · Solo visible en desktop (actualizarBtnExportar)
  Modal de carga/edición (#overlay-comentario):
    · Fecha: input date, max = hoy
    · Hora: dropdown instantáneo desde globalHorasPorDia
    · Semáforo: 🟢 Normal / 🟡 Atención / 🔴 Crítico
    · Edición: abrirEditarCom() pre-carga datos, no bloquea apertura
  Modal de detalle (#overlay-com-detalle):
    · Header inline con background:var(--dark), Bebas Neue naranja
    · Cancelar: inline confirm (cerrarInlineConfirm / confirmarCancelaCom)
    · Sin confirm() nativo del browser
  Vista Días: badge "X comentario/s" con color del peor semáforo, clickeable
  Vista Anual: opción "Comentario" en selector, heat-map con hm-com1/2/3
  globalComentarios: cargado async en cargarComentarios() al iniciar dashboard

─── INFORME PDF — FUENTE VISIBLE ────────────────────────────────────
  Header del PDF: muestra "Fuente: wttr.in · WorldWeatherOnline" o
    "Fuente: Open-Meteo · ERA5/ECMWF" en color correspondiente
  Footer del PDF: párrafo de metodología + badge de fuente

─── NOMBRES DE ARCHIVO ──────────────────────────────────────────────
  \_descParaArchivo(desc): espacios y guiones → \_ (guión bajo único)
  Ejemplo: "Anillo Pampa - CABA" → "Anillo\_Pampa\_CABA"
  Usado en PDF y XLSX

─── MOBILE HEADER ───────────────────────────────────────────────────
  Logo "🏗️ ClimaObra" visible en mobile (Bebas Neue naranja)
  Toggle wttr.in/Open-Meteo en mobile (fuente-toggle-mob)
  Sincronizado con desktop en iniciarDashboard() y cambiarFuente()

─── RECUADRO OBRA DESKTOP ───────────────────────────────────────────
  .obra-name usa flex: ID en .obra-name-id (flex-shrink:0, siempre visible)
  Descripción en .obra-name-desc (overflow:hidden, text-overflow:ellipsis)

─── MENÚ GAS ────────────────────────────────────────────────────────
  1. Setup inicial
  2. Migrar Registros v9→v10
  3. Activar trigger wttr.in
  4. Pausar trigger wttr.in
  5. Registrar clima ahora (manual)
  6. Setup hoja Registros\_OM
  6b. Setup hoja Comentarios (nueva — multi-fuente)
  7a. Histórico OM Tramo A: 16/04–30/04
  7b. Histórico OM Tramo B: 01/05–06/05
  7c. Catch-up OM — recuperar días faltantes (auto)
  7d. Cargar AYER OM — recuperar día anterior manualmente  ← NUEVA
  8. Activar trigger diario OM (05:00)
  9. Pausar trigger diario OM

─── REGLAS DE ENTREGA ────────────────────────────────────────────────
  - Siempre generar archivos descargables, nunca código inline
  - VERSION\_UI = constante JS en index.html — actualizar en cada entrega
  - VERSION\_GAS = constante en GAS — actualizar en cada entrega
  - Nombre de archivo siempre incluye versión: clima\_v13\_10.gs
  - Finalizar cada sesión con prompt de handoff en archivo .md descargable
  - El GAS no requiere re-deploy si solo cambia el HTML
  - Al hacer re-deploy del GAS: nueva versión del deploy existente (no nuevo deploy)
  - Cada cambio = nueva versión (no acumular fixes en la misma versión)

─── HISTORIAL DE VERSIONES PARA EL .docx ────────────────────────────

v13.9 (Mayo 2026)
  GAS clima\_v13\_9.gs:
    a. Fix obtenerClimaOMRango(): endpoint cambiado de corte hoy-3
       a corte hoy — cualquier fecha anterior a hoy usaba archive.
       (Incompleto: ERA5 tiene lag y ayer no estaba disponible aún)
    b. cargarAyerOM(): nueva función menú 7d para carga manual del día anterior

v13.10 (Mayo 2026)
  GAS clima\_v13\_10.gs:
    a. Fix definitivo obtenerClimaOMRango(): corte cambiado a hoy-5
       ERA5 tiene lag de 2-5 días → los últimos 5 días van a /v1/forecast
       fechaHasta < hoy-5 → /v1/archive (ERA5 confirmado)
       fechaHasta ≥ hoy-5 → /v1/forecast (cubre ayer y días recientes)
    b. Verificado: /v1/forecast devuelve datos del día anterior correctamente
    c. Verificado: opción 7d (cargarAyerOM) insertó registros del 11/05 OK

v13.11 (Mayo 2026)
  GAS clima\_v13\_11.gs:
    a. Fix HTTP 429 en trigger diario Open-Meteo: nueva función
       obtenerClimaOMMulti() que consulta todas las obras en UNA
       sola request usando latitude=lat1,lat2,lat3 (API multi-location).
       \_cargarDiaOM() refactorizado para usarla → 1 request/día total
       en vez de 1 request/obra/día (3 obras = 3 requests antes).
       obtenerClimaOMRango() y \_cargarRangoOM() sin cambios
       (cargas manuales/históricas no tienen restricción diaria).
    b. GAS v13.10 en producción hasta este deploy — trigger 05:00
       falló con 429 todos los días desde 08/05. Ejecutar opción 7d
       después del deploy para recuperar días faltantes.

v13.11 (Mayo 2026-18)

* Trigger cambiado de 07:00 a 09:00 ART para prueba (mismas condiciones que ejecución manual exitosa)
* Diagnóstico confirmado por logs: HTTP 429 "Daily API request limit exceeded" en todas las ejecuciones del trigger desde v13.11
* v13.11 correctamente deployado y funcionando (1 request multi-obra confirmada en logs)
* El 429 NO es por cantidad de requests por ejecución — es por límite de IP compartida de Google Apps Script en Open-Meteo Free Tier
* Ejecución manual del 18/05 exitosa (46 filas, fecha 17/05 recuperada) — funciona porque corre desde IP del editor, distinta a la del servidor de triggers
* Hipótesis principal: Open-Meteo limita por IP del servidor GAS, compartida con miles de proyectos externos
* Solución definitiva pendiente de validar: API key gratuita de open-meteo.com (límite por cuenta, no por IP)
* Pendiente: script de menú para cargar fecha específica (no implementado esta sesión)
* Mañana 19/05: verificar logs del trigger 09:00 para confirmar o descartar hipótesis




```

\---

## Estado del deploy

* ✅ clima\_v13\_10.gs → clima\_v13\_11.gs
* ✅ index\_v14\_5.html en producción (GitHub Pages, sin cambios esta sesión)
* ✅ Trigger wttr.in activo (horario)
* ✅ Trigger Open-Meteo activo (diario 05:00)
* ✅ Hoja Registros\_OM con datos — 11/05 recuperado manualmente con opción 7d
* ✅ Hoja Comentarios creada y operativa
* ✅ Toggle wttr.in / Open-Meteo funcionando (desktop + mobile)
* ✅ Informe PDF funcional con ambas fuentes + fuente visible en header
* ✅ Comentarios: carga, edición, cancelación, badges en vista Días
* ✅ Vista Anual modo comentario con heat-map de criticidad
* ✅ Selector de horas instantáneo (datos locales)
* ✅ 3 obras activas
* ⏳ El ⏳ de verificación del trigger → ❌ con nota de los 429, y agregás ⏳ para el v13.11.

## Pendientes

### Funcionales

* \[ ] Verificar trigger 05:00 del 13/05 con GAS v13.10 (primera ejecución real del fix)
* \[ ] `fuentes.html` standalone — actualizar con sección Open-Meteo
* \[ ] Indicador visual "Preparando mapa..." en modal PDF si `\_mapaBase64` es null
* \[ ] Comentarios en mobile — botón "💬 Comentario" no visible en mobile
* \[ ] Comentarios en informe PDF — incluir tabla de comentarios del mes

### Mejoras / backlog

* \[ ] `sw.js` → actualizar string de cache a `climaobra-v14`
* \[ ] MailApp solicitud de acceso → `executeAs:ME` + `access:ANYONE`
* \[ ] Alertas por email cuando lluvia o viento superan umbral
* \[ ] Reporte semanal automático por email
* \[ ] Dominio personalizado para GitHub Pages
* \[ ] CacheService GAS para Config/Obras (performance)

\---

*Generado al cierre de sesión — Mayo 2026*

