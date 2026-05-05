# ClimaObra — Handoff v11.5
**Fecha:** Mayo 2026
**Archivos entregados esta sesión:** `clima_v11.3.gs` + `index_v11.5.html` + `favicon.svg`

---

## Prompt para continuar en chat nuevo

```
Continuamos con ClimaObra (datamegashare.github.io/climaobra/).

Stack: GitHub Pages + Google Apps Script + Google Sheets + Google Identity Services (OAuth).
El GAS usa doGet (GET con parámetros), no doPost. Sin fix CORS necesario.

─── ARCHIVOS EN PRODUCCIÓN ───────────────────────────────────────────
  clima_v11.3.gs     → GAS backend multi-obra
  index_v11.5.html   → Frontend PWA multi-obra (subir como index.html)
  manifest.json      → PWA manifest
  sw.js              → Service Worker (cache climaobra-v11)
  favicon.svg        → Ícono personalizado v2 (sol + nube + casco)

─── CREDENCIALES ─────────────────────────────────────────────────────
  CLIENT_ID = '985022387906-5h3qtmq6jifdl5jdv77o4amf9nb3mcdn.apps.googleusercontent.com'
  API_URL   = 'https://script.google.com/macros/s/AKfycbzH5slzkOQ8fvhCt9JXIoMFNxrBZghZv34fowPI2Yk948eTxhZmHFX37InwpnxmkVBU/exec'
  GCP Project: tokyo-rider-451113-n5
  VERSION_UI = 'v11.5' (constante JS en index.html)

─── ESTRUCTURA DEL SHEET ─────────────────────────────────────────────
  Hoja Obras:
    ObraID (texto plano) | Descripción | Latitud | Longitud |
    Hora inicio | Hora fin | Lluvia DP (mm) | Viento DP (km/h) |
    Condición DP | Activa
    ⚠️ Columna A formateada como "Texto sin formato" — crítico para
       que ObraID no se convierta a número

  Hoja Usuarios:
    Email | Nombre | Activo (checkbox) | Rol (ADMIN/USER) | Obras (IDs separados por coma)

  Hoja Registros:
    ObraID | ObraDesc | Timestamp | Fecha | Hora | Latitud | Longitud |
    Temperatura | Sensación | Precipitación | Humedad | Viento | Descripción | Fuente
    ⚠️ Columna A formateada como "Texto sin formato" — crítico

  Obras activas:
    0000 - Casa AP (coords: -34.5856758, -58.5714108)
    1320 - Planta Potabilizadora Ensenada (coords: -34.8477494, -57.9332436)

─── ACCIONES doGet ───────────────────────────────────────────────────
  ?action=ping                              → test conectividad (sin auth)
  ?action=solicitarAcceso&emailSolicitante=x&nombreSolicitante=x
                                            → envía email admin (sin auth)
                                              ⚠️ PENDIENTE — problema de
                                              permisos MailApp sin resolver
  ?action=obras&email=x                     → obras permitidas del usuario + rol
  ?action=allObras&email=x                  → TODAS las obras (solo ADMIN)
  ?action=data&email=x&obraId=0000          → datos dashboard de una obra
  ?action=usuarios&email=x                  → lista usuarios (solo ADMIN)
  ?action=addObra&email=x&...              → nueva obra (solo ADMIN)
  ?action=editObra&email=x&...             → editar obra (solo ADMIN)
  ?action=deleteObra&email=x&id=x          → borrar obra (solo ADMIN)
  ?action=addUsuario&email=x&...           → nuevo usuario (solo ADMIN)
  ?action=editUsuario&email=x&...          → editar usuario (solo ADMIN)
  ?action=deleteUsuario&email=x&emailTarget=x → borrar usuario (solo ADMIN)

─── FLUJO DE LOGIN v11.5 ─────────────────────────────────────────────
  1. Google Identity → email guardado en localStorage ('co_email')
  2. Llama action=obras → obtiene lista de obras permitidas y rol
  3a. 1 obra → entra directo al dashboard
  3b. varias obras → pantalla selector de obra
  3c. obra guardada en localStorage ('co_obra') → entra directo sin selector
  4. action=data con obraId → carga dashboard
  5. ADMIN: botón ⚙ Admin en header → panel lateral con cards de obras y usuarios

─── PANEL ADMIN v11.5 ────────────────────────────────────────────────
  - Ancho: 720px
  - Obras y Usuarios usan cards (estilo Vale Digital), no tablas
  - Formulario con título dinámico (➕ Nueva / ✏️ Editando)
  - Defaults de nueva obra toman parámetros de obra 0000
  - Botón "Guardando..." con disabled mientras espera GAS
  - Card resaltada con borde naranja al editar
  - Validación de campos requeridos antes de enviar
  - Campo Obras en Usuarios: chips clickeables (no input de texto)
  - Tab Obras usa action=allObras (ve activas e inactivas)

─── MOBILE v11.5 ─────────────────────────────────────────────────────
  - Header mobile: nombre obra + botones ⇄ Obra / ↻ Actual. / ⬇ Instalar
  - Versión visible: "v11.5 · GAS v11.3" debajo del badge de usuario
  - Scroll vertical continuo nativo (tabs = anclas de scroll)
  - Cards de clima separadas del header con borde naranja superior
  - top-header (card con logo) oculto en mobile

─── REGLAS DE ENTREGA ────────────────────────────────────────────────
  - Siempre generar archivos descargables, nunca código inline
  - Versión visible en pantalla login (login-ver) y en header mobile (mob-version)
  - VERSION_UI = constante JS en index.html — actualizar en cada entrega
  - Nombre de archivo siempre incluye versión: index_v11.5.html, clima_v11.3.gs
  - Finalizar cada sesión con prompt de handoff en archivo .md descargable
  - El GAS no requiere re-deploy si solo cambia el HTML
  - Al hacer re-deploy del GAS: nueva versión del deploy existente (no nuevo deploy)

─── MENÚ DEL SHEET (onOpen) ─────────────────────────────────────────
  🏗️ ClimaObra
    1. Setup inicial — crear hojas (primera vez)
    2. Migrar Registros v9 → v10 (agrega ObraID)
    3. Activar registro automático
    4. Pausar registro automático
    5. Registrar clima ahora (prueba manual)

─── appsscript.json (configurado) ───────────────────────────────────
  {
    "timeZone": "America/Argentina/Buenos_Aires",
    "dependencies": {},
    "exceptionLogging": "STACKDRIVER",
    "runtimeVersion": "V8",
    "webapp": {
      "executeAs": "USER_DEPLOYING",
      "access": "ANYONE_ANONYMOUS"
    },
    "oauthScopes": [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/script.external_request",
      "https://www.googleapis.com/auth/script.send_mail"
    ]
  }
```

---

## Estado del deploy

- ✅ GAS v11.3 deployado y funcionando
- ✅ index_v11.5.html en producción (GitHub Pages)
- ✅ favicon.svg v2 en producción (sol + nube + casco)
- ✅ 2 obras activas: 0000 Casa AP + 1320 Planta Potabilizadora Ensenada
- ✅ Columnas ObraID en Obras y Registros formateadas como "Texto sin formato"
- ✅ Trigger horario activo — registra clima de todas las obras activas
- ✅ ObraID se guarda como texto con setNumberFormat('@STRING@') en registrarClima()

---

## Pendientes

### Prioridad alta
- [ ] **MailApp solicitud de acceso** — pendiente resolver permisos
  - El problema: `executeAs: USER_DEPLOYING` con `access: ANYONE_ANONYMOUS`
    no permite MailApp aunque el scope esté en appsscript.json
  - Solución identificada: cambiar deploy a `executeAs: ME` + `access: ANYONE`
    (requiere que usuarios estén logueados con Google — ya lo están)
  - Actualmente: pantalla "Acceso denegado" muestra link mailto: como workaround

### Backlog
- [ ] Documentación técnica v11 (actualizar ClimaObra_Documentacion.docx)
- [ ] Alertas por email cuando lluvia o viento superan umbral de la obra
- [ ] Reporte semanal automático por email (resumen días perdidos)
- [ ] Dominio personalizado para GitHub Pages
- [ ] Aplicar CacheService GAS para Config/Obras (performance)
  (ver documento Mejora_Performance_WebApp_GAS_v2.docx)
- [ ] sw.js: actualizar string de cache a climaobra-v11.5

---

## Resumen de lo hecho en esta sesión

### Bugs corregidos
- **ObraID como número** — padStart(4,'0') defensivo en getDashboardData,
  yaExisteRegistro, leerObras, _editObra, _deleteObra (v11.1)
- **Dashboard sin datos** — raíz: Sheets guardaba ObraID como número 0
  en vez de string "0000". Fix doble: formato "Texto sin formato" en Sheet
  + setNumberFormat('@STRING@') en appendRow del GAS (v11.1 + v11.2)
- **_addUsuario columnas** — orden correcto: email, nombre, activo, rol, obras (v11.1)
- **Panel Admin cierre** — eliminado cierre al tocar fuera del overlay (v11.2)
- **Scroll horizontal tablas** — eliminado en panel Admin (v11.2)
- **Cambio de obra desde Admin** — cerrarAdmin() antes de mostrar selector (v11.2)

### Nuevas funcionalidades
- **action=allObras** — devuelve todas las obras para el panel Admin (v11.1)
- **Panel Admin rediseñado** — cards estilo Vale Digital para obras y usuarios (v11.4)
- **Mobile scroll** — scroll vertical continuo nativo, tabs como anclas (v11.2)
- **Mobile header** — sin duplicado, botones ⇄ Obra / ↻ Actual. / ⬇ Instalar (v11.2 + v11.4 + v11.5)
- **Versión visible en mobile** — "v11.5 · GAS v11.3" en header (v11.5)
- **Favicon personalizado** — sol + nube con gotas + casco de obra blanco (v11.3 + v11.4)
- **Pantalla acceso denegado** — link mailto: a datamegashare@gmail.com (v11.4)
- **Formulario obras** — defaults de nueva obra desde parámetros de obra 0000 (v11.1)
- **Chips de obras** — selector visual en formulario de usuarios (v11.1)

---

## Historial de versiones para el .docx

```
v11.1 (Mayo 2026)
  GAS clima_v11.1.gs:
    a. Fix ObraID padding: padStart(4,'0') defensivo en yaExisteRegistro
       y getDashboardData
    b. Fix _addUsuario: orden correcto de columnas
    c. Nueva acción allObras en doGet

  Frontend index_v11.1.html:
    a. Panel Admin usa action=allObras
    b. Formulario con título dinámico y defaults de obra 0000
    c. Botón "Guardando..." con disabled
    d. Borde naranja y card resaltada en modo edición
    e. Validación de campos requeridos
    f. Chips clickeables para obras en formulario de usuarios

v11.2 (Mayo 2026)
  GAS clima_v11.2.gs:
    a. appendRow ObraID con setNumberFormat('@STRING@')

  Frontend index_v11.2.html:
    a. Panel Admin: sin cierre al tocar fuera
    b. Tablas sin scroll horizontal
    c. cambiarObra() cierra Admin antes de mostrar selector
    d. Mobile: top-header oculto, scroll vertical nativo
    e. Mobile: tabs como anclas de scroll
    f. Mobile: botón Instalar PWA en header mobile

v11.3 (Mayo 2026)
  GAS clima_v11.3.gs:
    a. Nueva acción solicitarAcceso (sin auth) — pendiente permisos

  Frontend index_v11.3.html:
    a. Panel Admin: ancho 720px
    b. Colgroup en tablas con anchos fijos
    c. Mobile cards con borde naranja superior
    d. Pantalla acceso denegado con link mailto:
    e. Favicon v2: sol + nube + casco

v11.4 (Mayo 2026)
  Frontend index_v11.4.html:
    a. Panel Admin Obras: rediseño con cards
    b. Panel Admin Usuarios: rediseño con cards
    c. Mobile: botón ⇄ Obra en header mobile
    d. Acceso denegado: link mailto: a datamegashare@gmail.com

v11.5 (Mayo 2026)
  Frontend index_v11.5.html:
    a. Constante VERSION_UI = 'v11.5' en JS
    b. Mobile: botón ↻ Actual. siempre visible en header
    c. Mobile: versión UI + GAS visible en header
```

---

*Generado al cierre de sesión — Mayo 2026*
