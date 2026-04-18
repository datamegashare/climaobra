// ============================================================
//  REGISTRO HORARIO DE CLIMA - OBRA  v9 (GitHub Pages)
//  API: wttr.in (gratuita, sin API key, sin límite de requests)
//
//  HISTORIAL DE VERSIONES:
//  v1 - Versión inicial con Open-Meteo, trigger horario básico
//  v2 - Estrategia de caché diario para reducir llamadas a API
//       y evitar error 429 (límite de requests de Open-Meteo)
//  v3 - Cambio de API: Open-Meteo → wttr.in (sin límites)
//       Se eliminó el caché (ya no necesario)
//       Datos adicionales: sensación térmica y humedad
//  v4 - Anti-duplicados: no registra si ya hay fila para esa hora
//       Parámetros de "día perdido" en hoja Config
//       Web App dashboard (doGet + getDashboardData)
//  v5 - Fix crítico en parsearFechaArg(): Google Sheets devuelve
//       objetos Date (no texto) en columna A; se detecta el tipo
//       y se usa Utilities.formatDate() cuando corresponde
//       Dashboard: modo claro + tarjeta de ubicación
//  v6 - Migración a GitHub Pages: doGet() sirve JSON en lugar
//       de HTML. El dashboard vive en GitHub Pages y consume
//       este endpoint. Autenticación via Google Identity Services.
//       verificarUsuario() valida email contra hoja Usuarios.
//  v7 - Campo "version" en respuesta del API.
//       Versión visible en encabezado del dashboard.
//  v8 - Campo "ultimoDia" con registros horarios del último día
//       deduplicados y ordenados (último registro por hora).
//       Maneja columna C como objeto Date o string.
//       Dashboard: tabla invertida, tabla evolución con mini
//       barras de progreso por unidad de medida.
//  v9 - getDashboardData devuelve hasta 28 días y campo
//       "uptime60" con estado de los últimos 60 días calendario
//       (normal / perdido / sinDatos).
//       Dashboard: selector de período 7/14/21/28 días,
//       gráfico uptime 60 días estilo status-page,
//       tabla con scroll al inicio al actualizar.
//
//  Autor: generado con Claude
// ============================================================
//
//  ACTUALIZACIÓN DESDE v8:
//  1. Reemplazá TODO el código .gs con este archivo
//  2. Guardá (Ctrl+S)
//  3. Implementar → Administrar implementaciones →
//     editar → Nueva versión → Guardar
//  4. Reemplazá el index.html en GitHub con index_v9.html
//  5. No es necesario tocar el trigger ni la Config
// ============================================================


// ------------------------------------------------------------
//  DESCRIPCIÓN DE CLIMA según código wttr.in (códigos WWO)
// ------------------------------------------------------------
function descripcionClima(codigo) {
  const DESCRIPCIONES = {
    113: 'Despejado',
    116: 'Parcialmente nublado',
    119: 'Nublado',
    122: 'Cubierto',
    143: 'Niebla',
    176: 'Lluvia leve cercana',
    179: 'Nieve leve cercana',
    182: 'Aguanieve',
    185: 'Llovizna helada',
    200: 'Tormenta cercana',
    227: 'Nieve con viento',
    230: 'Ventisca',
    248: 'Niebla',
    260: 'Niebla helada',
    263: 'Llovizna leve',
    266: 'Llovizna leve',
    281: 'Llovizna helada',
    284: 'Llovizna helada intensa',
    293: 'Lluvia leve',
    296: 'Lluvia leve',
    299: 'Lluvia moderada',
    302: 'Lluvia moderada',
    305: 'Lluvia intensa',
    308: 'Lluvia muy intensa',
    311: 'Lluvia helada leve',
    314: 'Lluvia helada moderada',
    317: 'Aguanieve leve',
    320: 'Aguanieve moderada',
    323: 'Nieve leve',
    326: 'Nieve leve',
    329: 'Nieve moderada',
    332: 'Nieve moderada',
    335: 'Nieve intensa',
    338: 'Nieve muy intensa',
    350: 'Granizo',
    353: 'Chaparrones leves',
    356: 'Chaparrones moderados',
    359: 'Chaparrones torrenciales',
    362: 'Aguanieve leve',
    365: 'Aguanieve moderada',
    368: 'Nevadas leves',
    371: 'Nevadas intensas',
    374: 'Granizo fino leve',
    377: 'Granizo fino moderado',
    386: 'Tormenta con lluvia leve',
    389: 'Tormenta con lluvia intensa',
    392: 'Tormenta con nieve leve',
    395: 'Tormenta con nieve intensa'
  };
  return DESCRIPCIONES[codigo] || ('Código ' + codigo);
}


// ------------------------------------------------------------
//  SETUP COMPLETO: crea hojas Config y Registros desde cero
// ------------------------------------------------------------
function setupHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Hoja Config
  let config = ss.getSheetByName('Config');
  if (!config) config = ss.insertSheet('Config');
  config.clearContents();

  const headersConfig = [
    ['Parámetro',                 'Valor'],
    ['Nombre obra',               'Mi Obra'],
    ['Latitud',                   '-34.6037'],
    ['Longitud',                  '-58.3816'],
    ['Hora inicio (0-23)',        '6'],
    ['Hora fin (0-23)',           '18'],
    ['Zona horaria',              'America/Argentina/Buenos_Aires'],
    ['Lluvia día perdido (mm)',   '5'],
    ['Viento día perdido (km/h)', '40'],
    ['Condición día perdido',     'ANY']
  ];
  config.getRange(1, 1, headersConfig.length, 2).setValues(headersConfig);
  config.getRange(1, 1, 1, 2)
    .setBackground('#1e2128').setFontColor('#f0a500').setFontWeight('bold');
  config.getRange(8, 1, 3, 2).setBackground('#f0f4ff');
  config.setColumnWidth(1, 240);
  config.setColumnWidth(2, 280);

  // Nota aclaratoria
  config.getRange(12, 1).setValue(
    '* Condición día perdido: ANY = basta con una condición, ALL = deben cumplirse ambas'
  );
  config.getRange(12, 1).setFontStyle('italic').setFontColor('#888888');
  config.getRange(12, 1, 1, 2).merge();

  // Hoja Registros
  let registros = ss.getSheetByName('Registros');
  if (!registros) registros = ss.insertSheet('Registros');
  if (registros.getLastRow() === 0) _crearEncabezadosRegistros(registros);

  SpreadsheetApp.getUi().alert(
    '✅ Hojas creadas correctamente.\n\n' +
    'Completá los datos en la hoja "Config" y luego ejecutá crearTrigger().'
  );
}


// ------------------------------------------------------------
//  ACTUALIZAR CONFIG: agrega parámetros nuevos sin borrar datos
//  Usar al migrar desde v3
// ------------------------------------------------------------
function actualizarConfig() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const config = ss.getSheetByName('Config');
  if (!config) {
    SpreadsheetApp.getUi().alert('No existe la hoja Config. Ejecutá setupHojas() primero.');
    return;
  }

  const ultimaFila = config.getLastRow();
  const valores    = config.getRange(2, 1, ultimaFila - 1, 1).getValues().flat();
  const yaExiste   = valores.some(v => String(v).includes('día perdido'));

  if (!yaExiste) {
    config.getRange(8, 1, 3, 2).setValues([
      ['Lluvia día perdido (mm)',   '5'],
      ['Viento día perdido (km/h)', '40'],
      ['Condición día perdido',     'ANY']
    ]);
    config.getRange(8, 1, 3, 2).setBackground('#f0f4ff');
    config.getRange(12, 1).setValue(
      '* Condición día perdido: ANY = basta con una condición, ALL = deben cumplirse ambas'
    );
    config.getRange(12, 1).setFontStyle('italic').setFontColor('#888888');
    config.getRange(12, 1, 1, 2).merge();
  }

  SpreadsheetApp.getUi().alert('✅ Config actualizada con parámetros de día perdido.');
}


// ------------------------------------------------------------
//  HELPER: crea encabezados en hoja Registros
// ------------------------------------------------------------
function _crearEncabezadosRegistros(registros) {
  const headersReg = [[
    'Timestamp', 'Fecha', 'Hora', 'Obra',
    'Latitud', 'Longitud',
    'Temperatura (°C)', 'Sensación térmica (°C)',
    'Precipitación (mm)', 'Humedad (%)',
    'Viento (km/h)', 'Descripción clima', 'Fuente'
  ]];
  registros.getRange(1, 1, 1, headersReg[0].length).setValues(headersReg);
  registros.getRange(1, 1, 1, headersReg[0].length)
    .setBackground('#1e2128').setFontColor('#f0a500').setFontWeight('bold');
  registros.setFrozenRows(1);
  [160,100,60,140,90,90,120,130,120,100,110,180,100]
    .forEach((w, i) => registros.setColumnWidth(i + 1, w));
}


// ------------------------------------------------------------
//  LEE CONFIGURACIÓN desde la hoja Config
// ------------------------------------------------------------
function leerConfig() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const config = ss.getSheetByName('Config');
  if (!config) throw new Error('No existe la hoja "Config". Ejecutá setupHojas() primero.');

  const data = config.getRange(2, 1, 9, 2).getValues();
  return {
    nombre:           data[0][1] || 'Obra',
    latitud:          parseFloat(data[1][1]),
    longitud:         parseFloat(data[2][1]),
    horaInicio:       parseInt(data[3][1]),
    horaFin:          parseInt(data[4][1]),
    timezone:         data[5][1] || 'America/Argentina/Buenos_Aires',
    lluviaDiaPerdido: parseFloat(data[6][1]) || 5,
    vientoDiaPerdido: parseFloat(data[7][1]) || 40,
    condicionDP:      String(data[8][1] || 'ANY').toUpperCase()
  };
}


// ------------------------------------------------------------
//  ANTI-DUPLICADOS: verifica si ya existe registro para fecha+hora
// ------------------------------------------------------------
function yaExisteRegistro(registros, fechaStr, horaDisplay) {
  const ultimaFila = registros.getLastRow();
  if (ultimaFila <= 1) return false;

  const datos = registros.getRange(2, 2, ultimaFila - 1, 2).getValues();
  return datos.some(fila => {
    const fechaFila = Utilities.formatDate(
      new Date(fila[0]), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy'
    );
    const horaFila = String(fila[1]).trim();
    return fechaFila === fechaStr && horaFila === horaDisplay;
  });
}


// ------------------------------------------------------------
//  LLAMA A wttr.in Y DEVUELVE DATOS DEL CLIMA ACTUAL
//  Sin límites diarios, sin API key requerida
// ------------------------------------------------------------
function obtenerClimaWttr(cfg) {
  const url = `https://wttr.in/${cfg.latitud},${cfg.longitud}?format=j1`;

  let respuesta;
  try {
    respuesta = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (e) {
    throw new Error('Error de red al llamar a wttr.in: ' + e.message);
  }

  const codigo = respuesta.getResponseCode();
  if (codigo !== 200) throw new Error('Error HTTP ' + codigo + ' al llamar a wttr.in.');

  const json    = JSON.parse(respuesta.getContentText());
  const current = json.current_condition[0];

  return {
    temperatura:   parseFloat(current.temp_C),
    sensacion:     parseFloat(current.FeelsLikeC),
    precipitacion: parseFloat(current.precipMM),
    humedad:       parseInt(current.humidity),
    viento:        parseFloat(current.windspeedKmph),
    descripcion:   descripcionClima(parseInt(current.weatherCode))
  };
}


// ------------------------------------------------------------
//  FUNCIÓN PRINCIPAL: registra el clima de la hora actual
// ------------------------------------------------------------
function registrarClima() {
  const cfg = leerConfig();

  if (isNaN(cfg.latitud) || isNaN(cfg.longitud)) {
    Logger.log('Error: coordenadas inválidas en Config.');
    return;
  }

  const ahora      = new Date();
  const horaActual = parseInt(Utilities.formatDate(ahora, cfg.timezone, 'H'));

  // Verificar rango horario configurado
  if (horaActual < cfg.horaInicio || horaActual > cfg.horaFin) {
    Logger.log(`Fuera de rango horario (${cfg.horaInicio}hs - ${cfg.horaFin}hs). Hora actual: ${horaActual}hs`);
    return;
  }

  const fechaStr    = Utilities.formatDate(ahora, cfg.timezone, 'dd/MM/yyyy');
  const horaDisplay = String(horaActual).padStart(2, '0') + ':00';

  // Verificar duplicado antes de llamar a la API
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const registros = ss.getSheetByName('Registros');
  if (!registros) { Logger.log('No existe la hoja "Registros".'); return; }

  if (yaExisteRegistro(registros, fechaStr, horaDisplay)) {
    Logger.log(`⏭ Ya existe registro para ${fechaStr} ${horaDisplay}. Omitido.`);
    return;
  }

  // Obtener clima desde wttr.in
  let clima;
  try {
    clima = obtenerClimaWttr(cfg);
    Logger.log('🌐 Clima obtenido de wttr.in correctamente.');
  } catch (e) {
    Logger.log('⚠️ ' + e.message);
    return;
  }

  const timestamp = Utilities.formatDate(ahora, cfg.timezone, 'dd/MM/yyyy HH:mm');

  registros.appendRow([
    timestamp, fechaStr, horaDisplay, cfg.nombre,
    cfg.latitud, cfg.longitud,
    clima.temperatura, clima.sensacion,
    clima.precipitacion, clima.humedad,
    clima.viento, clima.descripcion, 'wttr.in'
  ]);

  Logger.log(
    `✅ Registrado: ${timestamp} | ${clima.temperatura}°C ` +
    `(ST ${clima.sensacion}°C) | ${clima.precipitacion}mm | ` +
    `Hum ${clima.humedad}% | ${clima.viento}km/h | ${clima.descripcion}`
  );
}


// ------------------------------------------------------------
//  WEB APP: endpoint JSON para GitHub Pages
//
//  CONFIGURACIÓN REQUERIDA:
//  - Ejecutar como: Yo
//  - Quién tiene acceso: Cualquier persona
//
//  Parámetros GET:
//  ?action=data&email=xxx   → verifica usuario y devuelve datos
//  ?action=ping             → test de conectividad
// ------------------------------------------------------------
function doGet(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  var params = e && e.parameter ? e.parameter : {};
  var action = params.action || 'data';
  var email  = params.email  || '';

  // Test de conectividad
  if (action === 'ping') {
    output.setContent(JSON.stringify({ ok: true }));
    return output;
  }

  // Verificar acceso del usuario
  if (!email || !verificarUsuario(email)) {
    output.setContent(JSON.stringify({ error: 'acceso_denegado', email: email }));
    return output;
  }

  // Devolver datos del dashboard
  try {
    var data = getDashboardData();
    data.usuarioNombre = getNombreUsuario(email);
    output.setContent(JSON.stringify(data));
  } catch(err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }

  return output;
}


// ------------------------------------------------------------
//  VERIFICA si el email está habilitado en hoja Usuarios
// ------------------------------------------------------------
function verificarUsuario(email) {
  if (!email || email === '') return false;
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var usuarios = ss.getSheetByName('Usuarios');
  if (!usuarios || usuarios.getLastRow() <= 1) return false;

  var datos = usuarios.getRange(2, 1, usuarios.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < datos.length; i++) {
    var emailFila = String(datos[i][0]).trim().toLowerCase();
    var activo    = datos[i][2];
    if (emailFila === email.trim().toLowerCase() && activo === true) {
      return true;
    }
  }
  return false;
}


// ------------------------------------------------------------
//  DEVUELVE el nombre del usuario desde hoja Usuarios
// ------------------------------------------------------------
function getNombreUsuario(email) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var usuarios = ss.getSheetByName('Usuarios');
  if (!usuarios || usuarios.getLastRow() <= 1) return '';

  var datos = usuarios.getRange(2, 1, usuarios.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < datos.length; i++) {
    var emailFila = String(datos[i][0]).trim().toLowerCase();
    if (emailFila === email.trim().toLowerCase()) {
      return String(datos[i][1]).trim();
    }
  }
  return '';
}


// ------------------------------------------------------------
//  HELPER: parsea fecha desde columna A de Registros
//
//  FIX v5: Google Sheets devuelve objetos Date (tipo "object"),
//  no strings. La versión anterior usaba split('/') sobre el
//  valor crudo, lo que fallaba silenciosamente y devolvía null
//  para todas las filas → gráficos vacíos.
//  Solución: detectar el tipo y usar Utilities.formatDate()
//  cuando es un objeto Date, o parsear manualmente si es texto.
// ------------------------------------------------------------
function parsearFechaArg(val) {
  try {
    // Caso más común: Google Sheets devuelve objeto Date
    if (val instanceof Date && !isNaN(val)) {
      return Utilities.formatDate(val, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    }
    // Fallback: texto en formato "DD/MM/YYYY HH:mm" o "DD/MM/YYYY"
    const s      = String(val).trim();
    const partes = s.split(' ')[0].split('/');
    if (partes.length < 3) return null;
    return `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`;
  } catch(e) {
    return null;
  }
}


// ------------------------------------------------------------
//  WEB APP: devuelve los datos procesados al dashboard
// ------------------------------------------------------------
function getDashboardData() {
  try {
    const cfg       = leerConfig();
    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const registros = ss.getSheetByName('Registros');

    if (!registros || registros.getLastRow() <= 1) {
      return { version: 'v9', config: cfg, ultimo: null, dias: [], anual: [], ultimoDia: null, uptime60: [] };
    }

    const datos = registros.getRange(2, 1, registros.getLastRow() - 1, 13).getValues();

    // Último registro (fila más reciente)
    const ult    = datos[datos.length - 1];
    const ultimo = {
      timestamp:     String(ult[0]),
      temperatura:   parseFloat(ult[6])  || 0,
      sensacion:     parseFloat(ult[7])  || 0,
      precipitacion: parseFloat(ult[8])  || 0,
      humedad:       parseInt(ult[9])    || 0,
      viento:        parseFloat(ult[10]) || 0,
      descripcion:   String(ult[11])
    };

    // Agrupar registros por fecha (clave YYYY-MM-DD)
    // Usa parsearFechaArg() que maneja tanto objetos Date como texto
    const porFecha = {};
    datos.forEach(fila => {
      const fecha = parsearFechaArg(fila[0]);
      if (!fecha) return;
      if (!porFecha[fecha]) porFecha[fecha] = { temps: [], vientos: [], lluvias: [] };
      porFecha[fecha].temps.push(parseFloat(fila[6])  || 0);
      porFecha[fecha].vientos.push(parseFloat(fila[10]) || 0);
      porFecha[fecha].lluvias.push(parseFloat(fila[8])  || 0);
    });

    // Calcular métricas diarias y clasificar días perdidos
    const calcDia = (fecha) => {
      const d           = porFecha[fecha];
      const tempProm    = d.temps.reduce((a,b)  => a+b, 0) / d.temps.length;
      const vientoMax   = Math.max(...d.vientos);
      const lluviaTotal = d.lluvias.reduce((a,b) => a+b, 0);
      const esPerdido   = cfg.condicionDP === 'ALL'
        ? (lluviaTotal >= cfg.lluviaDiaPerdido && vientoMax >= cfg.vientoDiaPerdido)
        : (lluviaTotal >= cfg.lluviaDiaPerdido || vientoMax >= cfg.vientoDiaPerdido);
      return {
        fecha,
        tempProm:    Math.round(tempProm * 10) / 10,
        vientoMax:   Math.round(vientoMax),
        lluviaTotal: Math.round(lluviaTotal * 10) / 10,
        diaPerdido:  esPerdido
      };
    };

    const fechasOrdenadas = Object.keys(porFecha).sort();

    // Últimos 28 días para selector de período
    const ultimos28 = fechasOrdenadas.slice(-28).map(calcDia);

    // Datos anuales para heatmap
    const anual = fechasOrdenadas.map(calcDia);

    // Registros horarios del último día con datos
    const ultimaFecha = fechasOrdenadas[fechasOrdenadas.length - 1];
    const horasPorUltimo = {};
    datos.forEach(fila => {
      const fecha = parsearFechaArg(fila[0]);
      if (fecha !== ultimaFecha) return;
      var horaStr;
      if (fila[2] instanceof Date && !isNaN(fila[2])) {
        horaStr = Utilities.formatDate(fila[2], 'America/Argentina/Buenos_Aires', 'HH:00');
      } else {
        horaStr = String(fila[2]).trim();
        if (horaStr.length === 4) horaStr = '0' + horaStr;
      }
      horasPorUltimo[horaStr] = {
        temp:   parseFloat(fila[6])  || 0,
        viento: parseFloat(fila[10]) || 0,
        lluvia: parseFloat(fila[8])  || 0
      };
    });
    const ultimoDia = { fecha: ultimaFecha, horas: [], temps: [], vientos: [], lluvias: [] };
    Object.keys(horasPorUltimo).sort().forEach(h => {
      ultimoDia.horas.push(h);
      ultimoDia.temps.push(horasPorUltimo[h].temp);
      ultimoDia.vientos.push(horasPorUltimo[h].viento);
      ultimoDia.lluvias.push(horasPorUltimo[h].lluvia);
    });

    // Uptime 60 días: genera array de los últimos 60 días calendario
    // con estado: "normal", "perdido" o "sinDatos"
    const hoy = new Date();
    const uptime60 = [];
    for (var d = 59; d >= 0; d--) {
      var dia = new Date(hoy);
      dia.setDate(hoy.getDate() - d);
      var fechaDia = Utilities.formatDate(dia, cfg.timezone, 'yyyy-MM-dd');
      var calcado  = porFecha[fechaDia] ? calcDia(fechaDia) : null;
      uptime60.push({
        fecha:     fechaDia,
        estado:    calcado ? (calcado.diaPerdido ? 'perdido' : 'normal') : 'sinDatos',
        tempProm:  calcado ? calcado.tempProm  : null,
        vientoMax: calcado ? calcado.vientoMax : null,
        lluviaTotal: calcado ? calcado.lluviaTotal : null
      });
    }

    return { version: 'v9', config: cfg, ultimo, dias: ultimos28, anual, ultimoDia, uptime60 };

  } catch(e) {
    throw new Error('getDashboardData falló: ' + e.message);
  }
}


// ------------------------------------------------------------
//  CREAR TRIGGER horario automático
// ------------------------------------------------------------
function crearTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'registrarClima') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('registrarClima').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert(
    '✅ Trigger creado.\nEl clima se registrará automáticamente cada hora.'
  );
}


// ------------------------------------------------------------
//  ELIMINAR TRIGGER (pausar registro automático)
// ------------------------------------------------------------
function eliminarTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let eliminados = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'registrarClima') {
      ScriptApp.deleteTrigger(t); eliminados++;
    }
  });
  SpreadsheetApp.getUi().alert(`✅ ${eliminados} trigger(s) eliminado(s).`);
}


// ------------------------------------------------------------
//  REGISTRO MANUAL (sin esperar el trigger)
// ------------------------------------------------------------
function registrarAhora() {
  registrarClima();
  SpreadsheetApp.getUi().alert('✅ Registro manual completado. Revisá la hoja "Registros".');
}


// ------------------------------------------------------------
//  AGREGAR HOJA USUARIOS
// ------------------------------------------------------------
function agregarHojaUsuarios() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var usuarios = ss.getSheetByName('Usuarios');

  if (usuarios) {
    SpreadsheetApp.getUi().alert('La hoja Usuarios ya existe.');
    return;
  }

  usuarios = ss.insertSheet('Usuarios');
  usuarios.getRange(1, 1, 1, 3).setValues([['Usuario', 'Nombre', 'Activo']]);
  usuarios.getRange(1, 1, 1, 3)
    .setBackground('#1e2128').setFontColor('#f0a500').setFontWeight('bold');

  var emailOwner = Session.getActiveUser().getEmail();
  usuarios.getRange(2, 1, 1, 2).setValues([[emailOwner, 'Administrador']]);
  usuarios.getRange(2, 3).insertCheckboxes();
  usuarios.getRange(2, 3).setValue(true);
  usuarios.setColumnWidth(1, 260);
  usuarios.setColumnWidth(2, 180);
  usuarios.setColumnWidth(3, 80);

  SpreadsheetApp.getUi().alert(
    'Hoja Usuarios creada.\n\n' +
    'Tu email (' + emailOwner + ') fue agregado como Administrador.\n\n' +
    'Agregá los demas usuarios en las filas siguientes.'
  );
}


// ------------------------------------------------------------
//  MENÚ PERSONALIZADO en el Sheet
// ------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌤 Clima Obra')
    .addItem('1. Crear hojas (primera vez)',      'setupHojas')
    .addItem('1b. Actualizar Config (desde v3)',  'actualizarConfig')
    .addItem('1c. Agregar hoja Usuarios',         'agregarHojaUsuarios')
    .addItem('2. Activar registro automático',    'crearTrigger')
    .addSeparator()
    .addItem('Registrar ahora (manual)',          'registrarAhora')
    .addSeparator()
    .addItem('⏸ Pausar registro automático',      'eliminarTrigger')
    .addToUi();
}