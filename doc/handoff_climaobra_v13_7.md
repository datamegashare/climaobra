# ClimaObra — Handoff v13.7
**Fecha:** Mayo 2026
**Archivos entregados esta sesión:** `index_v13_7.html` · `clima_v13_4.gs`

---

## Prompt para continuar en chat nuevo

```
Continuamos con ClimaObra (datamegashare.github.io/climaobra/).

Stack: GitHub Pages + Google Apps Script + Google Sheets + Google Identity Services (OAuth).
El GAS usa doGet (GET con parámetros), no doPost. Sin fix CORS necesario.

─── ARCHIVOS EN PRODUCCIÓN ───────────────────────────────────────────
  clima_v13_4.gs     → GAS backend (en producción desde esta sesión)
  index_v13_7.html   → Frontend PWA (subir como index.html a GitHub Pages)
  manifest.json      → PWA manifest
  sw.js              → Service Worker (cache climaobra-v11 — pendiente actualizar)
  favicon.svg        → Ícono personalizado v2 (sol + nube + casco)
  fuentes.html       → Página standalone de metodología (pendiente actualizar con OM)

─── CREDENCIALES ─────────────────────────────────────────────────────
  CLIENT_ID = '985022387906-5h3qtmq6jifdl5jdv77o4amf9nb3mcdn.apps.googleusercontent.com'
  API_URL   = 'https://script.google.com/macros/s/AKfycbzH5slzkOQ8fvhCt9JXIoMFNxrBZghZv34fowPI2Yk948eTxhZmHFX37InwpnxmkVBU/exec'
  GCP Project: tokyo-rider-451113-n5
  VERSION_UI  = 'v13.7' (constante JS en index.html)
  VERSION_GAS = 'v13.4' (GAS en producción)

─── ESTRUCTURA DEL SHEET ─────────────────────────────────────────────
  Hoja Obras:
    ObraID (texto plano) | Descripción | Latitud | Longitud |
    Hora inicio | Hora fin | Lluvia DP (mm) | Viento DP (km/h) |
    Condición DP | Activa
    ⚠️ Columna A formateada como "Texto sin formato" — crítico

  Hoja Usuarios:
    Email | Nombre | Activo (checkbox) | Rol (ADMIN/USER) | Obras (IDs separados por coma)

  Hoja Registros:
    ObraID | ObraDesc | Timestamp | Fecha | Hora | Latitud | Longitud |
    Temperatura | Sensación | Precipitación | Humedad | Viento | Descripción | Fuente
    ⚠️ Columna A formateada como "Texto sin formato" — crítico

  Hoja Registros_OM: (NUEVA — mismas columnas que Registros)
    Fuente = "open-meteo"
    Datos históricos desde 01/04/2026 cargados
    Trigger diario 05:00 activo → carga día anterior automáticamente

  Obras activas:
    0000 - Casa AP (coords: -34.5856758, -58.5714108)
    1320 - Planta Potabilizadora Ensenada (coords: -34.8477494, -57.9332436)
    1333 - Anillo Pampa - CABA (coords: -34.5517153, -58.4349864)

─── ACCIONES doGet (GAS v13.4) ──────────────────────────────────────
  ?action=ping
  ?action=solicitarAcceso&emailSolicitante=x&nombreSolicitante=x
  ?action=obras&email=x
  ?action=allObras&email=x
  ?action=data&email=x&obraId=0000              → dashboard wttr.in
  ?action=dataOM&email=x&obraId=0000            → dashboard Open-Meteo (NUEVO)
  ?action=usuarios&email=x
  ?action=addObra&email=x&...
  ?action=editObra&email=x&...
  ?action=deleteObra&email=x&id=x
  ?action=addUsuario&email=x&...
  ?action=editUsuario&email=x&...
  ?action=deleteUsuario&email=x&emailTarget=x
  ?action=exportData&email=x&obraId=x&fechaDesde=yyyy-MM-dd&fechaHasta=yyyy-MM-dd
  ?action=reportData&email=x&obraId=x&anio=2026&mes=4    → informe PDF wttr.in
  ?action=reportDataOM&email=x&obraId=x&anio=2026&mes=4  → informe PDF OM (NUEVO)

─── OPEN-METEO — FUNCIONES GAS (v13.4) ──────────────────────────────
  convertirCodigoWMO(codigo)         → código WMO → español (26 códigos)
  obtenerClimaOMRango(lat,lon,desde,hasta,h1,h2) → UNA llamada HTTP por rango
  obtenerClimaOM(lat,lon,fecha,h1,h2)            → wrapper de un solo día
  setupHojaRegistrosOM()             → crea hoja Registros_OM con encabezados
  _insertarRegistrosOM(ss,obra,regs) → batch insert con Set anti-duplicados
  _cargarDiaOM(ss,fechaISO)          → carga un día, todas las obras activas
  _cargarRangoOM(ss,desde,hasta)     → carga rango completo, UNA llamada por obra
  cargarDiarioOM()                   → función del trigger diario 05:00
  crearTriggerOM() / eliminarTriggerOM()
  getDashboardDataOM(obraId)         → igual que getDashboardData, lee Registros_OM
  getReportDataOM(ss,obraId,anio,mes)→ igual que getReportData, lee Registros_OM

  Menú ClimaObra en el Sheet:
    1. Setup inicial
    2. Migrar Registros v9→v10
    3. Activar trigger wttr.in
    4. Pausar trigger wttr.in
    5. Registrar clima ahora (manual)
    6. Setup hoja Registros_OM
    7a. Histórico OM Tramo A: 16/04–30/04
    7b. Histórico OM Tramo B: 01/05–06/05
    8. Activar trigger diario OM (05:00)
    9. Pausar trigger diario OM

─── FUENTE DE DATOS — SELECTOR EN FRONTEND ──────────────────────────
  Variable global: fuenteActual = 'wttr' | 'om'
  Toggle en el header: botones pill [wttr.in] [Open-Meteo]
  cambiarFuente(fuente): cambia fuenteActual + recarga dashboard completo
  _actionData():   'data'   | 'dataOM'
  _actionReport(): 'reportData' | 'reportDataOM'
  PDF footer: párrafo de metodología adaptado a la fuente activa
  Línea de versión: muestra fuente activa

─── INFORME PDF — FUNCIONANDO COMPLETO ──────────────────────────────
  Tecnología: jsPDF 2.5.1 + html2canvas 1.4.1 + Chart.js (ya en la app)
  CDNs en <head>:
    https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
    https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js

  Genera con la fuente activa (wttr.in u Open-Meteo) al momento de abrir el modal.
  Footer del PDF incluye párrafo completo de metodología adaptado a la fuente.
  Nombre archivo: ClimaObra_ID_Desc_Mes_Anio_DDMMaaaa_HHmm.pdf

─── MAPA EN EL PDF ───────────────────────────────────────────────────
  Variable global: _mapaBase64 (null hasta que cargan los tiles)
  Al cargar obra → IIFE carga 9 tiles OSM (CORS abierto) en canvas 155x116
  → dibuja pin naranja → canvas.toDataURL() → _mapaBase64
  Fallback automático a SVG si tiles no cargan
  ⚠️ PENDIENTE: indicador visual "Preparando mapa..." si _mapaBase64 es null al abrir modal

─── MODALES — UX UNIFICADA (v13.7) ─────────────────────────────────
  Todos los modales comparten el mismo diseño:
    · Header oscuro (var(--dark)) con título Bebas Neue naranja
    · border-radius: 16px en todo el modal (16px 16px 0 0 en el header)
    · X para cerrar en el header
    · Click fuera del modal lo cierra
    · Overlay bloquea el fondo (body.style.overflow = 'hidden')
    · Botón primario: clase btn-accion (pill naranja sólido)
    · Botón secundario: clase btn-header (pill outline)
    · Controles deshabilitados durante procesamiento

  Modales existentes:
    · #overlay-informe-pdf    → Informe PDF mensual
    · #export-overlay         → Exportar XLSX
    · #overlay-fuentes        → Metodología y Fuentes (3 tabs)
    · #overlay-informe-pdf-render → div oculto para html2canvas

─── MODAL METODOLOGÍA Y FUENTES ─────────────────────────────────────
  Botón "📋 Metodología" en el header → abre modal con 3 tabs:
    Tab 1: wttr.in / WorldWeatherOnline
      · Cadena: ClimaObra → wttr.in → WWO → GFS/ECMWF → SMN
      · Tabla de variables con precisiones típicas
      · Argumento ante clientes/auditorías
    Tab 2: Open-Meteo
      · Cadena: ClimaObra → Open-Meteo → ERA5/GFS → observaciones → SMN
      · Qué es ERA5 y Open-Meteo
      · Diferencia wttr.in (tiempo real) vs Open-Meteo (día anterior consolidado)
      · Argumento ante clientes/auditorías
    Tab 3: Alcance y limitaciones
      · Qué SÍ / qué NO es adecuado
      · Stack tecnológico completo (100% gratuito)
  Al abrir, activa el tab de la fuente activa en ese momento.

─── BOTONES — CLASES CSS ────────────────────────────────────────────
  .btn-header  → pill outline gris, hover naranja (Instalar, Actualizar, Cambiar obra, Metodología)
  .btn-accion  → pill naranja sólido (Informe PDF, Exportar XLSX, Generar PDF, Descargar XLSX)
  .btn-periodo → pill outline, activo naranja (7/14/21/28 días)
  .fuente-btn  → pill interno del toggle wttr.in/Open-Meteo
  .btn-refresh → alias de btn-header para el botón Actualizar (compat)

─── REGLAS DE ENTREGA ────────────────────────────────────────────────
  - Siempre generar archivos descargables, nunca código inline
  - VERSION_UI = constante JS en index.html — actualizar en cada entrega
  - Nombre de archivo siempre incluye versión: index_v13_7.html
  - Finalizar cada sesión con prompt de handoff en archivo .md descargable
  - El GAS no requiere re-deploy si solo cambia el HTML
  - Al hacer re-deploy del GAS: nueva versión del deploy existente (no nuevo deploy)
  - GAS actual en producción: v13.4

─── HISTORIAL DE VERSIONES PARA EL .docx ────────────────────────────

v12.1 (Mayo 2026)
  GAS clima_v12.1.gs:
    a. Nueva acción reportData en doGet
    b. Nueva función getReportData(): stats completas mes actual + anterior
  Frontend index_v12.1.html:
    a. CDNs: jsPDF 2.5.1 + html2canvas 1.4.1
    b. Modal Informe PDF con selector de meses
    c. Generación PDF completa: div oculto → html2canvas → jsPDF A4

v12.2 → v12.6 (Mayo 2026)
  Mejoras PDF: botón reubicado, UX modal mejorada, escala html2canvas 3,
  height:1123px fijo, mapa OSM real con tiles individuales (CORS abierto),
  pin naranja dibujado en canvas, fallback SVG automático.

v13.0 (Mayo 2026)
  GAS clima_v13_0.gs:
    a. Nueva hoja Registros_OM (mismas columnas que Registros, Fuente="open-meteo")
    b. obtenerClimaOM(): consulta Open-Meteo /v1/forecast hourly por coordenadas y fecha
    c. convertirCodigoWMO(): 26 códigos WMO → español
    d. cargarDiarioOM(): trigger diario 05:00, carga día anterior
    e. cargarHistoricoOM(): carga retroactiva (reemplazada por tramos en v13.1)
    f. getDashboardDataOM() / getReportDataOM()
    g. doGet: nuevas acciones dataOM y reportDataOM
    h. Menú: opciones 6–9 para gestión Open-Meteo
  Frontend index_v13_0.html:
    a. VERSION_UI actualizada a v13.0

v13.1 (Mayo 2026)
  GAS clima_v13_1.gs:
    a. Carga histórica dividida en tramos por límite de 6 min de GAS
    b. Funciones cargarHistoricoOM_TramoA/B

v13.2 (Mayo 2026)
  GAS clima_v13_2.gs:
    a. obtenerClimaOMRango(): UNA sola llamada HTTP con todo el rango de fechas
    b. Eliminado loop día por día → 3 llamadas totales por tramo (una por obra)

v13.3 (Mayo 2026)
  GAS clima_v13_3.gs:
    a. Fix: función yaExisteRegistroOM() faltante (eliminada por error en v13.2)

v13.4 (Mayo 2026)
  GAS clima_v13_4.gs:
    a. _insertarRegistrosOM() reescrito con batch insert:
       · Carga hoja una vez en memoria al inicio
       · Set de claves existentes para chequeo O(1) de duplicados
       · Acumula filas nuevas en array
       · Una sola escritura con setValues() al final
    b. _cargarDiaOM() y _cargarRangoOM() simplificados

v13.5 (Mayo 2026)
  Frontend index_v13_5.html:
    a. Toggle wttr.in / Open-Meteo en header desktop
    b. cambiarFuente(): recarga dashboard completo con la fuente seleccionada
    c. cargarDashboard() y actualizarDatos() usan _actionData()
    d. Informe PDF usa _actionReport()
    e. Footer del PDF indica fuente activa
    f. Línea de versión muestra fuente activa

v13.6 (Mayo 2026)
  Frontend index_v13_6.html:
    a. Fix spinner: btn-refresh se resetea en iniciarDashboard()
    b. Botones header uniformes: clase btn-header (pill outline, hover naranja)
    c. Clase btn-accion para botones de acción primaria (pill naranja sólido)
    d. PDF footer: párrafo de metodología completo adaptado a la fuente activa
    e. Botón "📋 Metodología" en header → modal con 3 tabs:
       wttr.in / Open-Meteo / Alcance y limitaciones

v13.7 (Mayo 2026)
  Frontend index_v13_7.html:
    a. Modal PDF y Modal XLSX: UX unificada — header oscuro Bebas Neue naranja,
       border-radius 16px, X para cerrar, overlay bloquea fondo,
       click fuera cierra, Cancelar deshabilitado durante procesamiento
    b. Modal Metodología: border-radius 16px + tabs estilo pill uniforme
    c. cerrarExportarOverlay() y cerrarPDFOverlay() para click fuera
```

---

## Estado del deploy

- ✅ GAS v13.4 deployado y funcionando
- ✅ index_v13_7.html en producción (GitHub Pages)
- ✅ Trigger wttr.in activo (horario)
- ✅ Trigger Open-Meteo activo (diario 05:00)
- ✅ Hoja Registros_OM con datos desde 01/04/2026
- ✅ Toggle wttr.in / Open-Meteo funcionando
- ✅ Informe PDF funcional con ambas fuentes
- ✅ Modal Metodología con contenido completo de ambas fuentes
- ✅ UX unificada en todos los modales
- ✅ 3 obras activas

## Pendientes

### Funcionales
- [ ] Indicador visual "Preparando mapa..." en modal PDF si `_mapaBase64` es null al abrir
- [ ] `fuentes.html` standalone — actualizar con sección Open-Meteo (el modal ya tiene el contenido, falta reflejarlo en el archivo independiente)

### Mejoras / backlog
- [ ] `sw.js` → actualizar string de cache a `climaobra-v13`
- [ ] MailApp solicitud de acceso → `executeAs:ME` + `access:ANYONE`
- [ ] Alertas por email cuando lluvia o viento superan umbral de la obra
- [ ] Reporte semanal automático por email
- [ ] Dominio personalizado para GitHub Pages
- [ ] CacheService GAS para Config/Obras (performance)

---

*Generado al cierre de sesión — Mayo 2026*
