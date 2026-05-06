# ClimaObra — Handoff v12.6
**Fecha:** Mayo 2026
**Archivos entregados esta sesión:** `index_v12.6.html` (GAS sin cambios, sigue en v12.1 deployado)

---

## Prompt para continuar en chat nuevo

```
Continuamos con ClimaObra (datamegashare.github.io/climaobra/).

Stack: GitHub Pages + Google Apps Script + Google Sheets + Google Identity Services (OAuth).
El GAS usa doGet (GET con parámetros), no doPost. Sin fix CORS necesario.

─── ARCHIVOS EN PRODUCCIÓN ───────────────────────────────────────────
  clima_v12.1.gs     → GAS backend (en producción, NO re-deployado desde v12.1)
  index_v12.6.html   → Frontend PWA (subir como index.html a GitHub Pages)
  manifest.json      → PWA manifest
  sw.js              → Service Worker (cache climaobra-v11 — pendiente actualizar)
  favicon.svg        → Ícono personalizado v2 (sol + nube + casco)

─── CREDENCIALES ─────────────────────────────────────────────────────
  CLIENT_ID = '985022387906-5h3qtmq6jifdl5jdv77o4amf9nb3mcdn.apps.googleusercontent.com'
  API_URL   = 'https://script.google.com/macros/s/AKfycbzH5slzkOQ8fvhCt9JXIoMFNxrBZghZv34fowPI2Yk948eTxhZmHFX37InwpnxmkVBU/exec'
  GCP Project: tokyo-rider-451113-n5
  VERSION_UI  = 'v12.6' (constante JS en index.html)
  VERSION_GAS = 'v12.1' (GAS en producción, no tocar salvo cambio de backend)

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

  Obras activas:
    0000 - Casa AP (coords: -34.5856758, -58.5714108)
    1320 - Planta Potabilizadora Ensenada (coords: -34.8477494, -57.9332436)
    1333 - Anillo Pampa - CABA (coords: -34.5517153, -58.4349864)

─── ACCIONES doGet (GAS v12.1) ──────────────────────────────────────
  ?action=ping
  ?action=solicitarAcceso&emailSolicitante=x&nombreSolicitante=x
  ?action=obras&email=x
  ?action=allObras&email=x
  ?action=data&email=x&obraId=0000
  ?action=usuarios&email=x
  ?action=addObra&email=x&...
  ?action=editObra&email=x&...
  ?action=deleteObra&email=x&id=x
  ?action=addUsuario&email=x&...
  ?action=editUsuario&email=x&...
  ?action=deleteUsuario&email=x&emailTarget=x
  ?action=exportData&email=x&obraId=x&fechaDesde=yyyy-MM-dd&fechaHasta=yyyy-MM-dd
  ?action=reportData&email=x&obraId=x&anio=2026&mes=4
    → Devuelve: ok, obra, periodo{mesesDisponibles[]}, mesActual{}, mesAnterior{}
    → mesActual/mesAnterior: diasRegistrados, diasTotales, diasNormales, diasPerdidos,
      sinRegistro, operatividad, tempMax/Min/Prom + fechas, vientoMax/Min/Prom + fecha,
      lluviaMaxDia + fecha, lluviaAcum, diasConLluvia, condiciones[], dias[]

─── INFORME PDF — FUNCIONANDO COMPLETO en v12.6 ─────────────────────
  Tecnología: jsPDF 2.5.1 + html2canvas 1.4.1 + Chart.js (ya en la app)
  CDNs en <head>:
    https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
    https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js

  Flujo completo:
    1. Al cargar la obra → pre-carga mapa OSM en canvas (tiles + pin) → _mapaBase64
    2. Botón "↓ Informe PDF" en sección Periodo (desktop only)
    3. Modal abre → select + btn-pdf-ok deshabilitados mientras carga períodos
    4. Llama action=reportData para obtener mesesDisponibles → puebla select
    5. Usuario elige mes → "Generar PDF" → todo deshabilitado mientras genera
    6. Llama action=reportData con anio+mes seleccionados
    7. Renderiza HTML del informe en #pdf-render-container (div oculto, width:794px)
    8. Dibuja gráfico Chart.js en canvas 1444x260 (CSS: 722x130) → alta resolución
    9. html2canvas captura con scale:3
    10. jsPDF genera A4 y descarga
    11. Limpia container, rehabilita modal completamente (reset de estado)

  Nombre archivo: ClimaObra_ID_Desc_Mes_Anio_DDMMaaaa_HHmm.pdf

  Contenido del informe (una carilla A4):
    · Header: logo + obra + período izquierda | Mapa OSM real derecha
    · KPIs (8 cards): temp prom/max/min, días perdidos, lluvia acum,
      días lluvia, viento max/prom
    · Condiciones críticas: 3 bloques con ícono SVG (temp, viento, lluvia)
    · Gráfico combo: temp prom (línea naranja) + viento máx (barras azules)
      + lluvia (barras rojas)
    · Strip días del mes: cuadraditos coloreados + leyenda + % operatividad
    · Mes anterior: bloque compacto con 5 stats en línea (sin gráfico ni strip)
    · Distribución condiciones: barras horizontales con %
    · Footer: URL + fecha generación + versión

─── MAPA EN EL PDF — SOLUCIÓN DEFINITIVA ────────────────────────────
  Variable global: _mapaBase64 (null hasta que cargan los tiles)

  Al cargar la obra → función anónima IIFE:
    1. Calcula tile XY del centro (lon2tile, lat2tile)
    2. Crea canvas 155x116
    3. Carga 9 tiles vecinos (3x3) desde tile.openstreetmap.org
       (CORS abierto — clave del éxito)
    4. Dibuja cada tile en el canvas con offset calculado
    5. Al terminar todos: dibuja pin naranja (gota + halo + punto blanco)
    6. canvas.toDataURL('image/png') → _mapaBase64

  En construirHTMLInforme():
    _mapaBase64
      ? <img src="_mapaBase64"> (mapa real OSM)
      : generarMapaSVG() (fallback SVG manzanas)

  ⚠️ TIMING: esperar 2-3 segundos después de cargar el dashboard antes
     de abrir el modal — los tiles necesitan ese tiempo para descargarse.
     PENDIENTE: agregar indicador visual en el modal si _mapaBase64 es null.

─── MODAL INFORME PDF — estructura HTML ─────────────────────────────
  #overlay-informe-pdf      → overlay fijo z-index:2100
    #pdf-mes-select         → select de períodos (disabled al abrir, se habilita al cargar)
    #pdf-msg                → mensaje de estado
    #btn-pdf-ok             → "Generar PDF" (disabled al abrir)
    #btn-pdf-cancel         → "Cancelar"
  #pdf-render-container     → div oculto (left:-9999px) donde se renderiza el informe

  cerrarInformePDF() resetea TODO el estado:
    sel.innerHTML=''; sel.disabled=true;
    btnOk.disabled=true; btnOk.textContent='Generar PDF';
    btnCx.disabled=false;
    pdf-msg.textContent='';
    pdf-render-container.innerHTML='';

─── FUNCIONES JS DEL INFORME PDF ────────────────────────────────────
  abrirInformePDF()         → abre modal, deshabilita todo, fetch mesesDisponibles
  cerrarInformePDF()        → cierra modal, reset completo de estado
  generarInformePDF()       → deshabilita todo, fetch reportData, renderizarYCapturar
  renderizarYCapturar()     → construye HTML, renderiza gráfico, html2canvas, jsPDF
  renderizarGrafico()       → dibuja Chart.js en canvas 1444x260 del informe
  construirHTMLInforme()    → genera string HTML completo del A4
  generarMapaSVG(lat,lon)   → fallback SVG si _mapaBase64 es null
  kpiSection(), kpiCard()   → bloques KPIs
  criticoSection(), critItem() → condiciones críticas con íconos SVG
  masItem()                 → item del bloque mes anterior

─── REGLAS DE ENTREGA ────────────────────────────────────────────────
  - Siempre generar archivos descargables, nunca código inline
  - VERSION_UI = constante JS en index.html — actualizar en cada entrega
  - Nombre de archivo siempre incluye versión: index_v12.6.html
  - Finalizar cada sesión con prompt de handoff en archivo .md descargable
  - El GAS no requiere re-deploy si solo cambia el HTML
  - Al hacer re-deploy del GAS: nueva versión del deploy existente (no nuevo deploy)
  - GAS actual en producción: v12.1 — NO re-deployar salvo cambio de backend

─── HISTORIAL DE VERSIONES PARA EL .docx ────────────────────────────

v12.1 (Mayo 2026)
  GAS clima_v12.1.gs:
    a. Nueva acción reportData en doGet
    b. Nueva función getReportData(): stats completas mes actual + anterior

  Frontend index_v12.1.html:
    a. CDNs: jsPDF 2.5.1 + html2canvas 1.4.1
    b. Modal Informe PDF con selector de meses
    c. Generación PDF completa: div oculto → html2canvas → jsPDF A4
    d. Contenido: header, KPIs, condiciones críticas, gráfico, strip días,
       mes anterior, distribución condiciones, footer

v12.2 (Mayo 2026)
  Frontend index_v12.2.html:
    a. Botón movido a sección Periodo, al lado de Exportar XLSX
    b. Modal UX: elementos deshabilitados mientras carga y mientras genera
    c. Nombre archivo con _DDMMaaaa_HHmm
    d. scale html2canvas: 2 → 3
    e. height:1123px fijo en div del informe (mapeo A4 exacto)
    f. Bug PNG corregido: container limpio en todos los paths

v12.3 (Mayo 2026)
  Frontend index_v12.3.html:
    a. Botón Informe PDF: estilo igual a Exportar XLSX (naranja sólido, ↓)
    b. Mapa: reemplazado img OSM por SVG generado (CORS workaround)
    c. Gráfico: canvas 1444x260 (doble resolución) → mejora notable nitidez

v12.4 (Mayo 2026)
  Frontend index_v12.4.html:
    a. Fix cerrarInformePDF(): reset completo — modal funciona al re-abrir
    b. Mapa SVG rediseñado: manzanas mejor proporcionadas, pin con gota,
       halo, sombra, punto interior bicolor

v12.5 (Mayo 2026)
  Frontend index_v12.5.html:
    a. Intento pre-fetch mapa via fetch()+FileReader → fallaba por CORS
       en staticmap.openstreetmap.de (descartado)

v12.6 (Mayo 2026)
  Frontend index_v12.6.html:
    a. Mapa OSM real en PDF: tiles individuales tile.openstreetmap.org
       (CORS abierto) cargados en canvas + pin naranja dibujado encima
       → guardado como _mapaBase64 al cargar la obra
    b. Fallback automático a SVG si tiles no cargan
    c. ✅ FUNCIONANDO EN PRODUCCIÓN
```

---

## Estado del deploy

- ✅ GAS v12.1 deployado y funcionando
- ✅ index_v12.6.html en producción (GitHub Pages)
- ✅ Informe PDF 100% funcional:
  - Mapa OSM real
  - Gráfico alta resolución
  - Modal con UX correcta
  - Re-apertura del modal sin bugs
- ✅ 3 obras activas
- ✅ Trigger horario activo

## Pendientes

### Mejoras al informe PDF
- [ ] Indicador visual "Preparando mapa..." en el modal si `_mapaBase64`
      es null cuando el usuario abre el modal (timing de carga de tiles)

### Backlog general
- [ ] sw.js: actualizar string de cache a climaobra-v12
- [ ] MailApp solicitud de acceso — cambiar deploy a executeAs:ME + access:ANYONE
- [ ] Alertas por email cuando lluvia o viento superan umbral de la obra
- [ ] Reporte semanal automático por email
- [ ] Dominio personalizado para GitHub Pages
- [ ] CacheService GAS para Config/Obras (performance)

---

*Generado al cierre de sesión — Mayo 2026*
