# ClimaObra — Handoff v14.5
**Fecha:** Mayo 2026
**Archivos entregados esta sesión:** `index_v14_5.html` · `clima_v13_8.gs`

---

## Prompt para continuar en chat nuevo

```
Continuamos con ClimaObra (datamegashare.github.io/climaobra/).

Stack: GitHub Pages + Google Apps Script + Google Sheets + Google Identity Services (OAuth).
El GAS usa doGet (GET con parámetros), no doPost. Sin fix CORS necesario.

─── ARCHIVOS EN PRODUCCIÓN ───────────────────────────────────────────
  clima_v13_8.gs     → GAS backend (en producción desde esta sesión)
  index_v14_5.html   → Frontend PWA (subir como index.html a GitHub Pages)
  manifest.json      → PWA manifest
  sw.js              → Service Worker (cache climaobra-v11 — pendiente actualizar a v14)
  favicon.svg        → Ícono personalizado v2 (sol + nube + casco)
  fuentes.html       → Página standalone de metodología (pendiente actualizar con OM)

─── CREDENCIALES ─────────────────────────────────────────────────────
  CLIENT_ID = '985022387906-5h3qtmq6jifdl5jdv77o4amf9nb3mcdn.apps.googleusercontent.com'
  API_URL   = 'https://script.google.com/macros/s/AKfycbzH5slzkOQ8fvhCt9JXIoMFNxrBZghZv34fowPI2Yk948eTxhZmHFX37InwpnxmkVBU/exec'
  GCP Project: tokyo-rider-451113-n5
  VERSION_UI  = 'v14.5' (constante JS en index.html)
  VERSION_GAS = 'v13.8' (GAS en producción)

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

  Hoja Registros_OM: (mismas columnas que Registros, 14 cols)
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

─── ACCIONES doGet (GAS v13.8) ──────────────────────────────────────
  ?action=ping
  ?action=solicitarAcceso&emailSolicitante=x&nombreSolicitante=x
  ?action=obras&email=x
  ?action=allObras&email=x
  ?action=data&email=x&obraId=0000              → dashboard wttr.in
  ?action=dataOM&email=x&obraId=0000            → dashboard Open-Meteo
  ?action=usuarios&email=x
  ?action=addObra&email=x&...
  ?action=editObra&email=x&...
  ?action=deleteObra&email=x&id=x
  ?action=addUsuario&email=x&...
  ?action=editUsuario&email=x&...
  ?action=deleteUsuario&email=x&emailTarget=x
  ?action=exportData&email=x&obraId=x&fechaDesde=yyyy-MM-dd&fechaHasta=yyyy-MM-dd
  ?action=reportData&email=x&obraId=x&anio=2026&mes=4    → informe PDF wttr.in
  ?action=reportDataOM&email=x&obraId=x&anio=2026&mes=4  → informe PDF OM
  ?action=gethorasregistro&email=x&obraId=x&fecha=dd/MM/yyyy  → horas disponibles (fallback)
  ?action=getcomentarios&email=x&obraId=x&fechaDesde=dd/MM/yyyy&fechaHasta=dd/MM/yyyy
  ?action=savecomentario&email=x&obraId=x&fecha=x&hora=x&texto=x&criticidad=x
  ?action=editcomentario&email=x&obraId=x&fecha=x&hora=x&texto=x&criticidad=x
  ?action=cancelcomentario&email=x&obraId=x&fecha=x&hora=x

─── OPEN-METEO — endpoint auto-selección (v13.5+) ───────────────────
  obtenerClimaOMRango(): detecta automáticamente:
    fechaHasta > 3 días atrás → /v1/archive (ERA5)
    fechaHasta reciente       → /v1/forecast
  cargarCatchUpOM(): recupera días faltantes automáticamente (menú 7c)

─── COMENTARIOS — arquitectura (v13.7+) ─────────────────────────────
  Hoja "Comentarios" independiente — multi-fuente
  COL_COM: obraId=1, fecha=2, hora=3, texto=4, criticidad=5, usuario=6, estado=7
  _horaToStr(): convierte Date/decimal/string de Sheets → 'HH:mm'
  getDashboardData / getDashboardDataOM devuelven horasPorDia:
    { 'dd/MM/yyyy': ['08:00','09:00',...] } para últimos 28 días
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
  _descParaArchivo(desc): espacios y guiones → _ (guión bajo único)
  Ejemplo: "Anillo Pampa - CABA" → "Anillo_Pampa_CABA"
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
  6. Setup hoja Registros_OM
  6b. Setup hoja Comentarios (nueva — multi-fuente)
  7a. Histórico OM Tramo A: 16/04–30/04
  7b. Histórico OM Tramo B: 01/05–06/05
  7c. Catch-up OM — recuperar días faltantes (auto)
  8. Activar trigger diario OM (05:00)
  9. Pausar trigger diario OM

─── REGLAS DE ENTREGA ────────────────────────────────────────────────
  - Siempre generar archivos descargables, nunca código inline
  - VERSION_UI = constante JS en index.html — actualizar en cada entrega
  - VERSION_GAS = constante en GAS — actualizar en cada entrega
  - Nombre de archivo siempre incluye versión: index_v14_5.html
  - Finalizar cada sesión con prompt de handoff en archivo .md descargable
  - El GAS no requiere re-deploy si solo cambia el HTML
  - Al hacer re-deploy del GAS: nueva versión del deploy existente (no nuevo deploy)
  - Cada cambio = nueva versión (no acumular fixes en la misma versión)

─── HISTORIAL DE VERSIONES PARA EL .docx ────────────────────────────

v13.5 (Mayo 2026)
  GAS clima_v13_5.gs:
    a. obtenerClimaOMRango(): auto-selección /v1/archive vs /v1/forecast
       según antigüedad de la fecha (corte: 3 días)
    b. cargarCatchUpOM(): recupera días faltantes desde último registro
       hasta ayer (menú opción 7c)

v13.6 (Mayo 2026)
  GAS clima_v13_6.gs:
    a. Columnas ComentarioTexto/Criticidad/Usuario/Estado en Registros
       y Registros_OM (luego removidas en v13.7)
    b. 5 acciones doGet: gethorasregistro, getcomentarios, savecomentario,
       editcomentario, cancelcomentario

v13.7 (Mayo 2026)
  GAS clima_v13_7.gs:
    a. Hoja "Comentarios" independiente (multi-fuente, 7 columnas)
    b. COL_REG y TOTAL_COLS_REG vuelven a 14 (sin cols de comentarios)
    c. _horaToStr(): convierte Date/decimal/string → 'HH:mm'
    d. setupHojaComentarios() en menú 6b
    e. Funciones reescritas: getComentarios, saveComentario,
       editComentario, cancelComentario

v13.8 (Mayo 2026)
  GAS clima_v13_8.gs:
    a. getDashboardData(): agrega horasPorDia { 'dd/MM/yyyy': [...] }
       para los últimos 28 días en la respuesta
    b. getDashboardDataOM(): ídem para fuente Open-Meteo

v14.0 (Mayo 2026)
  Frontend index_v14_0.html:
    a. VERSION_UI actualizada a v14.0
    b. Mobile header: logo "🏗️ ClimaObra" + toggle wttr.in/Open-Meteo
    c. Recuadro obra desktop: text-overflow:ellipsis en nombre largo
    d. _descParaArchivo(): nombres de archivo unificados (sin guiones raros)
    e. Versión en PDF footer usa variable VERSION_UI

v14.1 (Mayo 2026)
  Frontend index_v14_1.html:
    a. Comentarios completos: CSS, modales HTML, JS (cargarComentarios,
       guardarComentario, abrirComDetalle, cancelarCom, abrirEditarCom,
       actualizarComentario, callGAS)
    b. renderDiasList: badges de comentarios con semáforo clickeables
    c. cambiarModo / getHeatClass: modo 'comentario' en heatmap anual
    d. actualizarBtnExportar: muestra/oculta btn-comentario

v14.2 (Mayo 2026)
  Frontend index_v14_2.html:
    a. Botón Comentario: estilo naranja btn-accion, posición izquierda de Informe PDF
    b. Botón Comentario Vista Anual: mismo pill que los demás
    c. cambiarModo: manejo uniforme del botón comentario-hm
    d. Recuadro obra: .obra-name-id (flex-shrink:0) + .obra-name-desc (ellipsis)
    e. abrirEditarCom: no cierra modal detalle hasta tener horas listas
    f. cancelarCom: inline confirm (sin confirm() nativo)
    g. Fuente visible en header del PDF

v14.3 (Mayo 2026)
  Frontend index_v14_3.html:
    a. Fix SyntaxError: comillas simples en onclick del inline confirm
       → extraído a función cerrarInlineConfirm()

v14.4 (Mayo 2026)
  Frontend index_v14_4.html:
    a. globalHorasPorDia: variable global, se carga desde data.horasPorDia
    b. cargarHorasComentario(): usa datos locales (instantáneo) para
       fechas en período de 28 días; fallback GAS para fechas más antiguas

v14.5 (Mayo 2026)
  Frontend index_v14_5.html:
    a. Fix: botón "Actualizar comentario" quedaba deshabilitado al abrir
       modal de edición — agregado disabled=false en abrirEditarCom()
    b. Fix: header del modal de detalle (#overlay-com-detalle) sin estilo
       → reemplazado por estilos inline (background:var(--dark), Bebas Neue)
```

---

## Estado del deploy

- ✅ GAS v13.8 deployado y funcionando
- ✅ index_v14_5.html en producción (GitHub Pages)
- ✅ Trigger wttr.in activo (horario)
- ✅ Trigger Open-Meteo activo (diario 05:00)
- ✅ Hoja Registros_OM con datos desde 01/04/2026
- ✅ Hoja Comentarios creada y operativa
- ✅ Toggle wttr.in / Open-Meteo funcionando (desktop + mobile)
- ✅ Informe PDF funcional con ambas fuentes + fuente visible en header
- ✅ Comentarios: carga, edición, cancelación, badges en vista Días
- ✅ Vista Anual modo comentario con heat-map de criticidad
- ✅ Selector de horas instantáneo (datos locales)
- ✅ 3 obras activas

## Pendientes

### Funcionales
- [ ] `fuentes.html` standalone — actualizar con sección Open-Meteo
- [ ] Indicador visual "Preparando mapa..." en modal PDF si `_mapaBase64` es null
- [ ] Comentarios en mobile — botón "💬 Comentario" no visible en mobile
- [ ] Comentarios en informe PDF — incluir tabla de comentarios del mes

### Mejoras / backlog
- [ ] `sw.js` → actualizar string de cache a `climaobra-v14`
- [ ] MailApp solicitud de acceso → `executeAs:ME` + `access:ANYONE`
- [ ] Alertas por email cuando lluvia o viento superan umbral
- [ ] Reporte semanal automático por email
- [ ] Dominio personalizado para GitHub Pages
- [ ] CacheService GAS para Config/Obras (performance)
- [ ] Loading spinners en dashboard.js (KPI cards) y materiales.js

---

*Generado al cierre de sesión — Mayo 2026*
