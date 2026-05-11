// ============================================================
//  CLIMAOBRA  v13.8  —  horasPorDia en getDashboardData / getDashboardDataOM
//  API principal: wttr.in (tiempo real, trigger horario)
//  API secundaria: Open-Meteo (datos históricos diarios, trigger 05:00)
//
//  HISTORIAL DE VERSIONES:
//  v13.0 - Integración Open-Meteo:
//          · Nueva hoja "Registros_OM" (mismas columnas que Registros)
//          · obtenerClimaOM(): consulta Open-Meteo /v1/forecast hourly
//          · convertirCodigoWMO(): código WMO → descripción en español
//          · cargarDiarioOM(): trigger 05:00, carga día anterior por obra
//          · cargarHistoricoOM(): carga retroactiva 01/04/2026–06/05/2026
//          · setupHojaRegistrosOM(): crea hoja Registros_OM con encabezados
//          · doGet: nueva acción "dataOM" para dashboard con fuente OM
//          · doGet: nueva acción "reportDataOM" para informe PDF con fuente OM
//          · Menú: nuevas opciones para OM
//  v1  - Versión inicial con Open-Meteo, trigger horario básico
//  v2  - Caché diario para evitar error 429 (Open-Meteo)
//  v3  - Cambio a wttr.in. Agrega sensación térmica y humedad
//  v4  - Anti-duplicados. Parámetros día perdido en Config
//  v5  - Fix parsearFechaArg(). Modo claro. Mapa OSM
//  v6  - Migración a GitHub Pages. API JSON. Login Google Identity
//  v7  - Campo "version" en respuesta API. Versión en dashboard
//  v8  - Campo "ultimoDia". Tabla evolución con mini barras
//  v9  - getDashboardData devuelve 28 días y "uptime60".
//        Selector de período 7/14/21/28 días. Gráfico uptime
//  v10 - Multi-obra:
//        · Nueva hoja "Obras": cada obra tiene sus propios
//          parámetros (coordenadas, horario, umbrales día perdido)
//        · Nueva hoja "Usuarios" v2: agrega columnas Rol
//          (ADMIN/USER) y Obras (lista de IDs separados por coma)
//        · Hoja "Registros" v2: agrega columnas ObraID y ObraDesc
//          al inicio (cols A-B), shifting las anteriores
//        · registrarClima() recorre todas las obras activas y
//          registra el clima de cada una en la misma pasada
//        · doGet() multi-acción: data, obras, usuarios, addObra,
//          editObra, deleteObra, addUsuario, editUsuario,
//          deleteUsuario, ping
//        · getDashboardData(obraId) filtra registros por obra
//        · leerObras() / leerUsuarios() para CRUD del frontend
//        · Migración: migrarRegistrosV10() agrega ObraID=0000
//          y ObraDesc="Casa AP" a los Registros existentes
//  v11.3 - Solicitud de acceso:
//        · Nueva acción doGet "solicitarAcceso" (sin auth):
//          envía email a datamegashare@gmail.com con asunto
//          "[ClimaObra] Solicitud de acceso — email" y datos
//          del solicitante (email, nombre Google, timestamp)
//  v11.2 - Fix ObraID texto en Registros:
//        · appendRow + setNumberFormat('@STRING@') en col A para
//          forzar ObraID como texto plano ("0000", "1320") e impedir
//          que Sheets lo convierta a número en registrarClima()
//  v11.1 - Fix ObraID padding:
//        · padStart(4,'0') defensivo en todos los puntos de
//          comparación de ObraID: getDashboardData, yaExisteRegistro,
//          leerObras, _editObra, _deleteObra
//        · Fix _addUsuario: orden correcto de columnas al escribir
//          (email, nombre, activo, rol, obras) — v10 saltaba Activo
//        · Nueva acción doGet "allObras": devuelve todas las obras
//          (activas e inactivas) para uso exclusivo del panel Admin
//
//  Hojas requeridas:
//    Obras     → ObraID | Descripción | Lat | Lon | HoraInicio |
//                HoraFin | LluviaDP | VientoDP | CondicionDP | Activa
//    Usuarios  → Email | Nombre | Activo | Rol | Obras
//    Registros → ObraID | ObraDesc | Timestamp | Fecha | Hora |
//                Latitud | Longitud | Temperatura | Sensación |
//                Precipitación | Humedad | Viento | Descripción | Fuente
//
//  Autor: generado con Claude
// ============================================================


// ─────────────────────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────────────────────
const VERSION_GAS = 'v13.8';
const TIMEZONE    = 'America/Argentina/Buenos_Aires';

// Columnas de Registros (1-based)
const COL_REG = {
  obraId:    1,
  obraDesc:  2,
  timestamp: 3,
  fecha:     4,
  hora:      5,
  latitud:   6,
  longitud:  7,
  temp:      8,
  sensacion: 9,
  precip:    10,
  humedad:   11,
  viento:    12,
  descrip:   13,
  fuente:    14
};
const TOTAL_COLS_REG = 14;

// Columnas de Obras (1-based)
const COL_OBR = {
  id:          1,
  descripcion: 2,
  latitud:     3,
  longitud:    4,
  horaInicio:  5,
  horaFin:     6,
  lluviaDP:    7,
  vientoDP:    8,
  condicionDP: 9,
  activa:      10
};

// Columnas de Usuarios (1-based)
const COL_USR = {
  email:  1,
  nombre: 2,
  activo: 3,
  rol:    4,
  obras:  5
};


// ─────────────────────────────────────────────────────────────
//  DESCRIPCIÓN DE CLIMA (códigos WWO de wttr.in)
// ─────────────────────────────────────────────────────────────
function descripcionClima(codigo) {
  const D = {
    113:'Despejado', 116:'Parcialmente nublado', 119:'Nublado',
    122:'Cubierto', 143:'Niebla', 176:'Lluvia leve cercana',
    179:'Nieve leve cercana', 182:'Aguanieve', 185:'Llovizna helada',
    200:'Tormenta cercana', 227:'Nieve con viento', 230:'Ventisca',
    248:'Niebla', 260:'Niebla helada', 263:'Llovizna leve',
    266:'Llovizna leve', 281:'Llovizna helada', 284:'Llovizna helada intensa',
    293:'Lluvia leve', 296:'Lluvia leve', 299:'Lluvia moderada',
    302:'Lluvia moderada', 305:'Lluvia intensa', 308:'Lluvia muy intensa',
    311:'Lluvia helada leve', 314:'Lluvia helada moderada',
    317:'Aguanieve leve', 320:'Aguanieve moderada',
    323:'Nieve leve', 326:'Nieve leve', 329:'Nieve moderada',
    332:'Nieve moderada', 335:'Nieve intensa', 338:'Nieve muy intensa',
    350:'Granizo', 353:'Chaparrones leves', 356:'Chaparrones moderados',
    359:'Chaparrones torrenciales', 362:'Aguanieve leve',
    365:'Aguanieve moderada', 368:'Nevadas leves', 371:'Nevadas intensas',
    374:'Granizo fino leve', 377:'Granizo fino moderado',
    386:'Tormenta con lluvia leve', 389:'Tormenta con lluvia intensa',
    392:'Tormenta con nieve leve', 395:'Tormenta con nieve intensa'
  };
  return D[codigo] || ('Código ' + codigo);
}


// ─────────────────────────────────────────────────────────────
//  LEER OBRAS — devuelve array de objetos obra
// ─────────────────────────────────────────────────────────────
function leerObras(ss, soloActivas) {
  const sheet = (ss || SpreadsheetApp.getActiveSpreadsheet()).getSheetByName('Obras');
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const filas = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  return filas
    .filter(f => {
      const id = String(f[COL_OBR.id - 1]).trim();
      if (!id) return false;
      if (soloActivas && f[COL_OBR.activa - 1] !== true) return false;
      return true;
    })
    .map(f => ({
      id:          String(f[COL_OBR.id - 1]).trim().padStart(4, '0'),
      descripcion: String(f[COL_OBR.descripcion - 1]).trim(),
      label:       String(f[COL_OBR.id - 1]).trim().padStart(4, '0') + ' - ' +
                   String(f[COL_OBR.descripcion - 1]).trim(),
      latitud:     parseFloat(f[COL_OBR.latitud - 1]),
      longitud:    parseFloat(f[COL_OBR.longitud - 1]),
      horaInicio:  parseInt(f[COL_OBR.horaInicio - 1]),
      horaFin:     parseInt(f[COL_OBR.horaFin - 1]),
      lluviaDP:    parseFloat(f[COL_OBR.lluviaDP - 1]) || 5,
      vientoDP:    parseFloat(f[COL_OBR.vientoDP - 1]) || 40,
      condicionDP: String(f[COL_OBR.condicionDP - 1] || 'ANY').toUpperCase(),
      activa:      f[COL_OBR.activa - 1] === true
    }));
}


// ─────────────────────────────────────────────────────────────
//  LEER USUARIOS — devuelve array de objetos usuario
// ─────────────────────────────────────────────────────────────
function leerUsuarios(ss) {
  const sheet = (ss || SpreadsheetApp.getActiveSpreadsheet()).getSheetByName('Usuarios');
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const filas = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  return filas
    .filter(f => String(f[COL_USR.email - 1]).trim())
    .map(f => ({
      email:  String(f[COL_USR.email - 1]).trim().toLowerCase(),
      nombre: String(f[COL_USR.nombre - 1]).trim(),
      activo: f[COL_USR.activo - 1] === true,
      rol:    String(f[COL_USR.rol - 1] || 'USER').toUpperCase(),
      obras:  String(f[COL_USR.obras - 1] || '').trim()
                .split(',').map(s => s.trim()).filter(s => s.length > 0)
    }));
}


// ─────────────────────────────────────────────────────────────
//  VERIFICAR USUARIO — retorna objeto usuario o null
// ─────────────────────────────────────────────────────────────
function verificarUsuario(email, ss) {
  if (!email) return null;
  const usuarios = leerUsuarios(ss);
  const u = usuarios.find(u =>
    u.email === email.trim().toLowerCase() && u.activo
  );
  return u || null;
}


// ─────────────────────────────────────────────────────────────
//  OBRAS PERMITIDAS para un usuario
//  - ADMIN con obras vacío → todas las obras activas
//  - USER con obras vacío  → todas las obras activas (selector)
//  - Cualquier rol con obras → solo las de su lista
// ─────────────────────────────────────────────────────────────
function obrasPermitidas(usuario, ss) {
  const todasActivas = leerObras(ss, true);
  if (!usuario.obras || usuario.obras.length === 0) return todasActivas;
  return todasActivas.filter(o => usuario.obras.includes(o.id));
}


// ─────────────────────────────────────────────────────────────
//  ANTI-DUPLICADOS — ahora filtra por obraId + fecha + hora
// ─────────────────────────────────────────────────────────────
function yaExisteRegistro(sheet, obraId, fechaStr, horaDisplay) {
  if (sheet.getLastRow() <= 1) return false;
  const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  return datos.some(fila => {
    const idFila    = String(fila[0]).trim().padStart(4, '0');
    const fechaFila = fila[3] instanceof Date
      ? Utilities.formatDate(fila[3], TIMEZONE, 'dd/MM/yyyy')
      : String(fila[3]).trim();
    const horaFila  = String(fila[4]).trim();
    return idFila === obraId && fechaFila === fechaStr && horaFila === horaDisplay;
  });
}


// ─────────────────────────────────────────────────────────────
//  OBTENER CLIMA desde wttr.in
// ─────────────────────────────────────────────────────────────
function obtenerClimaWttr(lat, lon) {
  const url = `https://wttr.in/${lat},${lon}?format=j1`;
  let resp;
  try {
    resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (e) {
    throw new Error('Error de red al llamar a wttr.in: ' + e.message);
  }
  if (resp.getResponseCode() !== 200) {
    throw new Error('HTTP ' + resp.getResponseCode() + ' en wttr.in');
  }
  const c = JSON.parse(resp.getContentText()).current_condition[0];
  return {
    temperatura:   parseFloat(c.temp_C),
    sensacion:     parseFloat(c.FeelsLikeC),
    precipitacion: parseFloat(c.precipMM),
    humedad:       parseInt(c.humidity),
    viento:        parseFloat(c.windspeedKmph),
    descripcion:   descripcionClima(parseInt(c.weatherCode))
  };
}


// ─────────────────────────────────────────────────────────────
//  REGISTRAR CLIMA — recorre todas las obras activas
// ─────────────────────────────────────────────────────────────
function registrarClima() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const obras     = leerObras(ss, true); // solo activas
  const sheetReg  = ss.getSheetByName('Registros');

  if (!sheetReg) {
    Logger.log('❌ No existe la hoja "Registros". Ejecutá setupHojas().');
    return;
  }
  if (obras.length === 0) {
    Logger.log('⚠️ No hay obras activas en la hoja "Obras".');
    return;
  }

  const ahora = new Date();

  obras.forEach(obra => {
    if (isNaN(obra.latitud) || isNaN(obra.longitud)) {
      Logger.log(`⚠️ Obra ${obra.id} — coordenadas inválidas. Omitida.`);
      return;
    }

    const horaActual = parseInt(Utilities.formatDate(ahora, TIMEZONE, 'H'));

    if (horaActual < obra.horaInicio || horaActual > obra.horaFin) {
      Logger.log(`⏭ Obra ${obra.id} — fuera de rango horario (${obra.horaInicio}-${obra.horaFin}hs). Hora: ${horaActual}hs`);
      return;
    }

    const fechaStr    = Utilities.formatDate(ahora, TIMEZONE, 'dd/MM/yyyy');
    const horaDisplay = String(horaActual).padStart(2, '0') + ':00';
    const timestamp   = Utilities.formatDate(ahora, TIMEZONE, 'dd/MM/yyyy HH:mm');

    if (yaExisteRegistro(sheetReg, obra.id, fechaStr, horaDisplay)) {
      Logger.log(`⏭ Obra ${obra.id} — ya existe registro ${fechaStr} ${horaDisplay}`);
      return;
    }

    let clima;
    try {
      clima = obtenerClimaWttr(obra.latitud, obra.longitud);
    } catch (e) {
      Logger.log(`⚠️ Obra ${obra.id} — error wttr.in: ${e.message}`);
      return;
    }

    sheetReg.appendRow([
      obra.id, obra.descripcion,
      timestamp, fechaStr, horaDisplay,
      obra.latitud, obra.longitud,
      clima.temperatura, clima.sensacion,
      clima.precipitacion, clima.humedad,
      clima.viento, clima.descripcion, 'wttr.in'
    ]);
    // Forzar ObraID como texto para evitar que Sheets lo convierta a número
    const nuevaFila = sheetReg.getLastRow();
    sheetReg.getRange(nuevaFila, 1).setNumberFormat('@STRING@').setValue(obra.id);

    Logger.log(
      `✅ Obra ${obra.id} (${obra.descripcion}) | ${timestamp} | ` +
      `${clima.temperatura}°C | ${clima.precipitacion}mm | ${clima.viento}km/h`
    );
  });
}


// ─────────────────────────────────────────────────────────────
//  PARSEAR FECHA desde columna Timestamp de Registros
// ─────────────────────────────────────────────────────────────
function parsearFechaArg(val) {
  try {
    if (val instanceof Date && !isNaN(val)) {
      return Utilities.formatDate(val, TIMEZONE, 'yyyy-MM-dd');
    }
    const s      = String(val).trim();
    const partes = s.split(' ')[0].split('/');
    if (partes.length < 3) return null;
    return `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`;
  } catch(e) { return null; }
}


// ─────────────────────────────────────────────────────────────
//  getDashboardData — datos de UNA obra filtrada por obraId
// ─────────────────────────────────────────────────────────────
function getDashboardData(obraId) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const obras = leerObras(ss, false);
  const obra  = obras.find(o => o.id === String(obraId).trim().padStart(4, '0'));

  if (!obra) throw new Error('Obra no encontrada: ' + obraId);

  const sheetReg = ss.getSheetByName('Registros');
  if (!sheetReg || sheetReg.getLastRow() <= 1) {
    return { version: VERSION_GAS, obra, ultimo: null, dias: [], anual: [], ultimoDia: null, uptime60: [] };
  }

  // Leer todos los registros y filtrar por obraId
  const todos  = sheetReg.getRange(2, 1, sheetReg.getLastRow() - 1, TOTAL_COLS_REG).getValues();
  const datos  = todos.filter(f => String(f[COL_REG.obraId - 1]).trim().padStart(4, '0') === obra.id);

  if (datos.length === 0) {
    return { version: VERSION_GAS, obra, ultimo: null, dias: [], anual: [], ultimoDia: null, uptime60: [] };
  }

  // Último registro
  const ult    = datos[datos.length - 1];
  const ultimo = {
    timestamp:     String(ult[COL_REG.timestamp - 1]),
    temperatura:   parseFloat(ult[COL_REG.temp - 1])     || 0,
    sensacion:     parseFloat(ult[COL_REG.sensacion - 1]) || 0,
    precipitacion: parseFloat(ult[COL_REG.precip - 1])   || 0,
    humedad:       parseInt(ult[COL_REG.humedad - 1])     || 0,
    viento:        parseFloat(ult[COL_REG.viento - 1])   || 0,
    descripcion:   String(ult[COL_REG.descrip - 1])
  };

  // Agrupar por fecha
  const porFecha = {};
  datos.forEach(fila => {
    const fecha = parsearFechaArg(fila[COL_REG.timestamp - 1]);
    if (!fecha) return;
    if (!porFecha[fecha]) porFecha[fecha] = { temps: [], vientos: [], lluvias: [] };
    porFecha[fecha].temps.push(parseFloat(fila[COL_REG.temp - 1])    || 0);
    porFecha[fecha].vientos.push(parseFloat(fila[COL_REG.viento - 1]) || 0);
    porFecha[fecha].lluvias.push(parseFloat(fila[COL_REG.precip - 1]) || 0);
  });

  // Calcular métricas diarias — usa umbrales de la obra
  const calcDia = fecha => {
    const d           = porFecha[fecha];
    const tempProm    = d.temps.reduce((a,b) => a+b, 0) / d.temps.length;
    const vientoMax   = Math.max(...d.vientos);
    const lluviaTotal = d.lluvias.reduce((a,b) => a+b, 0);
    const esPerdido   = obra.condicionDP === 'ALL'
      ? (lluviaTotal >= obra.lluviaDP && vientoMax >= obra.vientoDP)
      : (lluviaTotal >= obra.lluviaDP || vientoMax >= obra.vientoDP);
    return {
      fecha,
      tempProm:    Math.round(tempProm * 10) / 10,
      vientoMax:   Math.round(vientoMax),
      lluviaTotal: Math.round(lluviaTotal * 10) / 10,
      diaPerdido:  esPerdido
    };
  };

  const fechasOrdenadas = Object.keys(porFecha).sort();
  const ultimos28       = fechasOrdenadas.slice(-28).map(calcDia);
  const anual           = fechasOrdenadas.map(calcDia);

  // Registros horarios del último día
  const ultimaFecha    = fechasOrdenadas[fechasOrdenadas.length - 1];
  const horasPorUltimo = {};
  datos.forEach(fila => {
    if (parsearFechaArg(fila[COL_REG.timestamp - 1]) !== ultimaFecha) return;
    let horaStr = fila[COL_REG.hora - 1];
    if (horaStr instanceof Date && !isNaN(horaStr)) {
      horaStr = Utilities.formatDate(horaStr, TIMEZONE, 'HH:00');
    } else {
      horaStr = String(horaStr).trim();
      if (horaStr.length === 4) horaStr = '0' + horaStr;
    }
    horasPorUltimo[horaStr] = {
      temp:   parseFloat(fila[COL_REG.temp - 1])    || 0,
      viento: parseFloat(fila[COL_REG.viento - 1]) || 0,
      lluvia: parseFloat(fila[COL_REG.precip - 1]) || 0
    };
  });
  const ultimoDia = { fecha: ultimaFecha, horas: [], temps: [], vientos: [], lluvias: [] };
  Object.keys(horasPorUltimo).sort().forEach(h => {
    ultimoDia.horas.push(h);
    ultimoDia.temps.push(horasPorUltimo[h].temp);
    ultimoDia.vientos.push(horasPorUltimo[h].viento);
    ultimoDia.lluvias.push(horasPorUltimo[h].lluvia);
  });

  // Uptime 60 días
  const hoy      = new Date();
  const uptime60 = [];
  for (let d = 59; d >= 0; d--) {
    const dia      = new Date(hoy);
    dia.setDate(hoy.getDate() - d);
    const fechaDia = Utilities.formatDate(dia, TIMEZONE, 'yyyy-MM-dd');
    const calcado  = porFecha[fechaDia] ? calcDia(fechaDia) : null;
    uptime60.push({
      fecha:       fechaDia,
      estado:      calcado ? (calcado.diaPerdido ? 'perdido' : 'normal') : 'sinDatos',
      tempProm:    calcado ? calcado.tempProm    : null,
      vientoMax:   calcado ? calcado.vientoMax   : null,
      lluviaTotal: calcado ? calcado.lluviaTotal : null
    });
  }

  // Mapa horas disponibles por día (últimos 28) → usado por frontend para selector de horas
  const horasPorDia = {};
  const fechasUltimos28 = new Set(ultimos28.map(d => d.fecha));
  datos.forEach(fila => {
    const fecha = parsearFechaArg(fila[COL_REG.timestamp - 1]);
    if (!fecha || !fechasUltimos28.has(fecha)) return;
    // Convertir fecha yyyy-MM-dd → dd/MM/yyyy para que el frontend la use directamente
    const fp = fecha.split('-');
    const fechaArg = `${fp[2]}/${fp[1]}/${fp[0]}`;
    if (!horasPorDia[fechaArg]) horasPorDia[fechaArg] = new Set();
    let horaStr = fila[COL_REG.hora - 1];
    if (horaStr instanceof Date && !isNaN(horaStr)) {
      horaStr = Utilities.formatDate(horaStr, TIMEZONE, 'HH:mm');
    } else {
      horaStr = String(horaStr).trim();
      if (horaStr.length === 4) horaStr = '0' + horaStr;
    }
    if (horaStr) horasPorDia[fechaArg].add(horaStr);
  });
  // Convertir Sets a arrays ordenados
  const horasPorDiaObj = {};
  Object.keys(horasPorDia).forEach(f => {
    horasPorDiaObj[f] = [...horasPorDia[f]].sort();
  });

  return { version: VERSION_GAS, obra, ultimo, dias: ultimos28, anual, ultimoDia, uptime60, horasPorDia: horasPorDiaObj };
}


// ─────────────────────────────────────────────────────────────
//  doGet — endpoint JSON multi-acción
//
//  Acciones públicas (sin auth):
//    ?action=ping
//
//  Acciones autenticadas (requieren &email=xxx):
//    ?action=data&email=x&obraId=0000   → datos dashboard de la obra
//    ?action=obras&email=x              → lista obras permitidas del usuario
//    ?action=usuarios&email=x           → lista usuarios (solo ADMIN)
//
//  Acciones CRUD — solo ADMIN:
//    ?action=addObra&email=x&...        → nueva obra
//    ?action=editObra&email=x&...       → editar obra existente
//    ?action=deleteObra&email=x&id=x   → borrar obra
//    ?action=addUsuario&email=x&...     → nuevo usuario
//    ?action=editUsuario&email=x&...    → editar usuario
//    ?action=deleteUsuario&email=x&id=x → borrar usuario
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  const p      = e && e.parameter ? e.parameter : {};
  const action = (p.action || 'data').toLowerCase();
  const email  = (p.email  || '').trim().toLowerCase();

  // ── ping — sin auth ───────────────────────────────────────
  if (action === 'ping') {
    output.setContent(JSON.stringify({ ok: true, version: VERSION_GAS }));
    return output;
  }

  // ── solicitarAcceso — sin auth ────────────────────────────
  if (action === 'solicitaraccceso' || action === 'solicitaracceso') {
    try {
      const emailSol  = (p.emailSolicitante || '').trim();
      const nombreSol = (p.nombreSolicitante || '').trim() || '(sin nombre)';
      if (!emailSol) {
        output.setContent(JSON.stringify({ ok: false, error: 'email_requerido' }));
        return output;
      }
      const timestamp = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm');
      MailApp.sendEmail({
        to:      'datamegashare@gmail.com',
        subject: '[ClimaObra] Solicitud de acceso — ' + emailSol,
        body:
          'Se recibió una solicitud de acceso a ClimaObra.\n\n' +
          'Email:     ' + emailSol  + '\n' +
          'Nombre:    ' + nombreSol + '\n' +
          'Fecha/hora: ' + timestamp + '\n\n' +
          'Para dar de alta al usuario, agregalo en la hoja Usuarios del Sheet de ClimaObra.\n' +
          'https://docs.google.com/spreadsheets/d/' + SpreadsheetApp.getActiveSpreadsheet().getId()
      });
      output.setContent(JSON.stringify({ ok: true }));
    } catch(err) {
      output.setContent(JSON.stringify({ ok: false, error: err.message }));
    }
    return output;
  }

  // ── autenticación ─────────────────────────────────────────
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const usuario = verificarUsuario(email, ss);
  if (!usuario) {
    output.setContent(JSON.stringify({ error: 'acceso_denegado', email }));
    return output;
  }

  const esAdmin = usuario.rol === 'ADMIN';

  try {
    let result;

    switch (action) {

      // ── datos del dashboard ───────────────────────────────
      case 'data': {
        const obraId = (p.obraId || '').trim().padStart(4, '0');
        // Verificar que el usuario tiene permiso sobre esta obra
        const permitidas = obrasPermitidas(usuario, ss);
        if (!permitidas.find(o => o.id === obraId)) {
          result = { error: 'obra_no_permitida', obraId };
        } else {
          result = getDashboardData(obraId);
          result.usuarioNombre = usuario.nombre;
          result.usuarioRol    = usuario.rol;
        }
        break;
      }

      // ── lista de obras permitidas ─────────────────────────
      case 'obras': {
        result = {
          ok:    true,
          obras: obrasPermitidas(usuario, ss),
          rol:   usuario.rol
        };
        break;
      }

      // ── todas las obras — solo ADMIN (para panel de gestión) ──
      case 'allobras': {
        if (!esAdmin) { result = { error: 'sin_permiso' }; break; }
        result = { ok: true, obras: leerObras(ss, false), rol: usuario.rol };
        break;
      }

      // ── lista de usuarios — solo ADMIN ────────────────────
      case 'usuarios': {
        if (!esAdmin) { result = { error: 'sin_permiso' }; break; }
        result = { ok: true, usuarios: leerUsuarios(ss) };
        break;
      }

      // ── CRUD Obras — solo ADMIN ───────────────────────────
      case 'addobra': {
        if (!esAdmin) { result = { error: 'sin_permiso' }; break; }
        result = _addObra(ss, p);
        break;
      }
      case 'editobra': {
        if (!esAdmin) { result = { error: 'sin_permiso' }; break; }
        result = _editObra(ss, p);
        break;
      }
      case 'deleteobra': {
        if (!esAdmin) { result = { error: 'sin_permiso' }; break; }
        result = _deleteObra(ss, p);
        break;
      }

      // ── CRUD Usuarios — solo ADMIN ────────────────────────
      case 'addusuario': {
        if (!esAdmin) { result = { error: 'sin_permiso' }; break; }
        result = _addUsuario(ss, p);
        break;
      }
      case 'editusuario': {
        if (!esAdmin) { result = { error: 'sin_permiso' }; break; }
        result = _editUsuario(ss, p);
        break;
      }
      case 'deleteusuario': {
        if (!esAdmin) { result = { error: 'sin_permiso' }; break; }
        result = _deleteUsuario(ss, p);
        break;
      }

      // ── datos del dashboard — fuente Open-Meteo ──────────
      case 'dataom': {
        const obraIdOM = (p.obraId || '').trim().padStart(4, '0');
        const permitidasOM = obrasPermitidas(usuario, ss);
        if (!permitidasOM.find(o => o.id === obraIdOM)) {
          result = { error: 'obra_no_permitida', obraId: obraIdOM };
        } else {
          result = getDashboardDataOM(obraIdOM);
          result.usuarioNombre = usuario.nombre;
          result.usuarioRol    = usuario.rol;
        }
        break;
      }

      // ── informe PDF mensual — fuente Open-Meteo ───────────
      case 'reportdataom': {
        const obraIdROM    = (p.obraId || '').trim().padStart(4, '0');
        const permitidasROM = obrasPermitidas(usuario, ss);
        if (!esAdmin && !permitidasROM.find(o => o.id === obraIdROM)) {
          result = { error: 'obra_no_permitida' }; break;
        }
        const anioROM = parseInt(p.anio || new Date().getFullYear());
        const mesROM  = parseInt(p.mes  || (new Date().getMonth() + 1));
        result = getReportDataOM(ss, obraIdROM, anioROM, mesROM);
        break;
      }

      // ── informe PDF mensual ───────────────────────────────
      case 'reportdata': {
        const obraIdR     = (p.obraId || '').trim().padStart(4, '0');
        const permitidasR = obrasPermitidas(usuario, ss);
        if (!esAdmin && !permitidasR.find(o => o.id === obraIdR)) {
          result = { error: 'obra_no_permitida' }; break;
        }
        const anioR = parseInt(p.anio || new Date().getFullYear());
        const mesR  = parseInt(p.mes  || (new Date().getMonth() + 1));
        result = getReportData(ss, obraIdR, anioR, mesR);
        break;
      }

      default:

      // ── exportar registros crudos de una obra ─────────────
      case 'exportdata': {
        const obraId2 = (p.obraId || '').trim().padStart(4, '0');
        const permitidas2 = obrasPermitidas(usuario, ss);
        if (!esAdmin && !permitidas2.find(o => o.id === obraId2)) {
          result = { error: 'obra_no_permitida' }; break;
        }
        const desde = (p.fechaDesde || '').trim();
        const hasta  = (p.fechaHasta  || '').trim();
        result = getExportData(ss, obraId2, desde, hasta);
        break;
      }

      // ── comentarios ───────────────────────────────────────
      case 'gethorasregistro': {
        const obraId3  = (p.obraId || '').trim().padStart(4, '0');
        const fechaStr = (p.fecha  || '').trim(); // 'dd/MM/yyyy'
        const horas    = _getHorasRegistro(ss, obraId3, fechaStr);
        result = { ok: true, horas };
        break;
      }

      case 'getcomentarios': {
        const obraId3  = (p.obraId || '').trim().padStart(4, '0');
        const permitidas3 = obrasPermitidas(usuario, ss);
        if (!esAdmin && !permitidas3.find(o => o.id === obraId3)) {
          result = { error: 'obra_no_permitida' }; break;
        }
        const desde3 = (p.fechaDesde || '').trim();
        const hasta3  = (p.fechaHasta  || '').trim();
        result = { ok: true, comentarios: getComentarios(ss, obraId3, desde3, hasta3) };
        break;
      }

      case 'savecomentario': {
        const obraId3   = (p.obraId      || '').trim().padStart(4, '0');
        const fechaStr  = (p.fecha        || '').trim();
        const hora      = (p.hora         || '').trim();
        const texto     = (p.texto        || '').trim();
        const criticidad = (p.criticidad  || 'normal').trim();
        if (!texto) { result = { ok: false, error: 'texto_vacio' }; break; }
        result = saveComentario(ss, obraId3, fechaStr, hora, texto, criticidad, email);
        break;
      }

      case 'editcomentario': {
        const obraId3    = (p.obraId      || '').trim().padStart(4, '0');
        const fechaStr   = (p.fecha        || '').trim();
        const hora       = (p.hora         || '').trim();
        const texto      = (p.texto        || '').trim();
        const criticidad = (p.criticidad   || '').trim();
        result = editComentario(ss, obraId3, fechaStr, hora, texto, criticidad, email);
        break;
      }

      case 'cancelcomentario': {
        const obraId3  = (p.obraId || '').trim().padStart(4, '0');
        const fechaStr = (p.fecha  || '').trim();
        const hora     = (p.hora   || '').trim();
        result = cancelComentario(ss, obraId3, fechaStr, hora, email);
        break;
      }

        result = { error: 'accion_desconocida', action };
    }

    output.setContent(JSON.stringify(result));

  } catch (err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }

  return output;
}


// ─────────────────────────────────────────────────────────────
//  CRUD OBRAS (privados — llamados desde doGet)
// ─────────────────────────────────────────────────────────────

function _addObra(ss, p) {
  const sheet = ss.getSheetByName('Obras');
  if (!sheet) return { ok: false, error: 'Hoja Obras no encontrada' };

  const id = String(p.id || '').trim().padStart(4, '0');
  if (!id || id === '0000') return { ok: false, error: 'ID de obra inválido' };

  // Verificar duplicado
  const existentes = leerObras(ss, false);
  if (existentes.find(o => o.id === id)) return { ok: false, error: 'Ya existe obra con ID ' + id };

  sheet.appendRow([
    id,
    String(p.descripcion || '').trim(),
    parseFloat(p.latitud  || 0),
    parseFloat(p.longitud || 0),
    parseInt(p.horaInicio || 6),
    parseInt(p.horaFin    || 18),
    parseFloat(p.lluviaDP  || 5),
    parseFloat(p.vientoDP  || 40),
    String(p.condicionDP   || 'ANY').toUpperCase(),
    true  // activa por defecto
  ]);
  return { ok: true, id };
}

function _editObra(ss, p) {
  const sheet = ss.getSheetByName('Obras');
  if (!sheet || sheet.getLastRow() <= 1) return { ok: false, error: 'Hoja Obras vacía' };

  const id    = String(p.id || '').trim().padStart(4, '0');
  const filas = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  const idx   = filas.findIndex(f => String(f[0]).trim().padStart(4,'0') === id);
  if (idx === -1) return { ok: false, error: 'Obra no encontrada: ' + id };

  const fila     = filas[idx].slice();
  const filaNum  = idx + 2;
  if (p.descripcion !== undefined) fila[1] = String(p.descripcion).trim();
  if (p.latitud     !== undefined) fila[2] = parseFloat(p.latitud);
  if (p.longitud    !== undefined) fila[3] = parseFloat(p.longitud);
  if (p.horaInicio  !== undefined) fila[4] = parseInt(p.horaInicio);
  if (p.horaFin     !== undefined) fila[5] = parseInt(p.horaFin);
  if (p.lluviaDP    !== undefined) fila[6] = parseFloat(p.lluviaDP);
  if (p.vientoDP    !== undefined) fila[7] = parseFloat(p.vientoDP);
  if (p.condicionDP !== undefined) fila[8] = String(p.condicionDP).toUpperCase();
  if (p.activa      !== undefined) fila[9] = p.activa === 'true' || p.activa === true;

  sheet.getRange(filaNum, 1, 1, 10).setValues([fila]);
  return { ok: true, id };
}

function _deleteObra(ss, p) {
  const sheet = ss.getSheetByName('Obras');
  if (!sheet || sheet.getLastRow() <= 1) return { ok: false, error: 'Hoja Obras vacía' };

  const id    = String(p.id || '').trim().padStart(4, '0');
  const filas = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const idx   = filas.findIndex(f => String(f[0]).trim().padStart(4,'0') === id);
  if (idx === -1) return { ok: false, error: 'Obra no encontrada: ' + id };

  sheet.deleteRow(idx + 2);
  return { ok: true, id };
}


// ─────────────────────────────────────────────────────────────
//  CRUD USUARIOS (privados — llamados desde doGet)
// ─────────────────────────────────────────────────────────────

function _addUsuario(ss, p) {
  const sheet = ss.getSheetByName('Usuarios');
  if (!sheet) return { ok: false, error: 'Hoja Usuarios no encontrada' };

  const email = String(p.nuevoEmail || p.emailNuevo || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Email requerido' };

  const existentes = leerUsuarios(ss);
  if (existentes.find(u => u.email === email)) return { ok: false, error: 'Ya existe usuario: ' + email };

  const filaNum = sheet.getLastRow() + 1;
  sheet.getRange(filaNum, 1, 1, 5).setValues([[
    email,
    String(p.nombre || '').trim(),
    true,
    String(p.rol    || 'USER').toUpperCase(),
    String(p.obras  || '').trim()
  ]]);
  // checkbox en columna Activo (col 3)
  sheet.getRange(filaNum, COL_USR.activo).insertCheckboxes();
  sheet.getRange(filaNum, COL_USR.activo).setValue(true);

  return { ok: true, email };
}

function _editUsuario(ss, p) {
  const sheet = ss.getSheetByName('Usuarios');
  if (!sheet || sheet.getLastRow() <= 1) return { ok: false, error: 'Hoja Usuarios vacía' };

  const email = String(p.emailTarget || p.email || '').trim().toLowerCase();
  const filas = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const idx   = filas.findIndex(f => String(f[0]).trim().toLowerCase() === email);
  if (idx === -1) return { ok: false, error: 'Usuario no encontrado: ' + email };

  const fila    = filas[idx].slice();
  const filaNum = idx + 2;
  if (p.nombre !== undefined) fila[1] = String(p.nombre).trim();
  if (p.activo !== undefined) fila[2] = p.activo === 'true' || p.activo === true;
  if (p.rol    !== undefined) fila[3] = String(p.rol).toUpperCase();
  if (p.obras  !== undefined) fila[4] = String(p.obras).trim();

  sheet.getRange(filaNum, 1, 1, 5).setValues([fila]);
  return { ok: true, email };
}

function _deleteUsuario(ss, p) {
  const sheet = ss.getSheetByName('Usuarios');
  if (!sheet || sheet.getLastRow() <= 1) return { ok: false, error: 'Hoja Usuarios vacía' };

  const email = String(p.emailTarget || '').trim().toLowerCase();
  const filas = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const idx   = filas.findIndex(f => String(f[0]).trim().toLowerCase() === email);
  if (idx === -1) return { ok: false, error: 'Usuario no encontrado: ' + email };

  sheet.deleteRow(idx + 2);
  return { ok: true, email };
}


// ─────────────────────────────────────────────────────────────
//  SETUP — crea todas las hojas desde cero (primera vez)
// ─────────────────────────────────────────────────────────────
function setupHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // ── Hoja Obras ────────────────────────────────────────────
  let shObras = ss.getSheetByName('Obras');
  if (!shObras) shObras = ss.insertSheet('Obras');
  shObras.clearContents();
  const hObras = [['ObraID','Descripción','Latitud','Longitud',
    'Hora inicio','Hora fin','Lluvia DP (mm)','Viento DP (km/h)',
    'Condición DP','Activa']];
  shObras.getRange(1, 1, 1, 10).setValues(hObras);
  shObras.getRange(1, 1, 1, 10)
    .setBackground('#1e2128').setFontColor('#f0a500').setFontWeight('bold');
  shObras.setFrozenRows(1);
  [80,200,100,100,90,80,110,120,100,70]
    .forEach((w,i) => shObras.setColumnWidth(i+1, w));

  // ── Hoja Usuarios ─────────────────────────────────────────
  let shUsr = ss.getSheetByName('Usuarios');
  if (!shUsr) shUsr = ss.insertSheet('Usuarios');
  shUsr.clearContents();
  shUsr.getRange(1, 1, 1, 5)
    .setValues([['Email','Nombre','Activo','Rol','Obras']]);
  shUsr.getRange(1, 1, 1, 5)
    .setBackground('#1e2128').setFontColor('#f0a500').setFontWeight('bold');
  shUsr.setFrozenRows(1);
  // Primer usuario = dueño del Sheet
  const ownerEmail = Session.getActiveUser().getEmail();
  shUsr.getRange(2, 1, 1, 4).setValues([[ownerEmail, 'Administrador', 'ADMIN', '']]);
  shUsr.getRange(2, COL_USR.activo).insertCheckboxes();
  shUsr.getRange(2, COL_USR.activo).setValue(true);
  [240,160,70,80,200].forEach((w,i) => shUsr.setColumnWidth(i+1, w));

  // ── Hoja Registros ────────────────────────────────────────
  let shReg = ss.getSheetByName('Registros');
  if (!shReg) {
    shReg = ss.insertSheet('Registros');
    _crearEncabezadosRegistros(shReg);
  }

  // ── Hoja Config (compatibilidad — ya no se usa para parámetros de obra) ──
  let shCfg = ss.getSheetByName('Config');
  if (!shCfg) {
    shCfg = ss.insertSheet('Config');
    shCfg.getRange(1,1).setValue('ClimaObra v10 — Los parámetros se configuran en la hoja "Obras"');
    shCfg.getRange(1,1).setFontStyle('italic').setFontColor('#888888');
  }

  ui.alert(
    '✅ ClimaObra v10 — Hojas creadas\n\n' +
    '1. Completá la hoja "Obras" con tus obras.\n' +
    '2. La hoja "Usuarios" ya tiene tu email como ADMIN.\n' +
    '3. Activá el registro con "Activar registro automático".\n' +
    '4. Implementá el GAS como Web App (nueva versión).'
  );
}


// ─────────────────────────────────────────────────────────────
//  MIGRAR REGISTROS v9 → v10
//  Inserta columnas ObraID y ObraDesc al inicio con valores
//  "0000" y "Casa AP" para conservar los datos históricos
// ─────────────────────────────────────────────────────────────
function migrarRegistrosV10() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ui  = SpreadsheetApp.getUi();
  const reg = ss.getSheetByName('Registros');

  if (!reg) {
    ui.alert('❌ No existe la hoja "Registros".');
    return;
  }

  // Verificar si ya tiene las columnas nuevas
  const primerEncabezado = String(reg.getRange(1,1).getValue()).trim();
  if (primerEncabezado === 'ObraID') {
    ui.alert('ℹ️ La hoja "Registros" ya está en formato v10. No se realizaron cambios.');
    return;
  }

  const confirm = ui.alert(
    'Migrar Registros v9 → v10',
    'Se insertarán 2 columnas al inicio:\n' +
    '  Col A: ObraID = "0000"\n' +
    '  Col B: ObraDesc = "Casa AP"\n\n' +
    '¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const ultimaFila = reg.getLastRow();

  // Insertar 2 columnas al inicio
  reg.insertColumnsBefore(1, 2);

  // Encabezados nuevos
  reg.getRange(1, 1, 1, 2).setValues([['ObraID', 'ObraDesc']]);
  reg.getRange(1, 1, 1, 2)
    .setBackground('#1e2128').setFontColor('#f0a500').setFontWeight('bold');

  // Rellenar datos existentes
  if (ultimaFila > 1) {
    const rangoObraId   = reg.getRange(2, 1, ultimaFila - 1, 1);
    const rangoObraDesc = reg.getRange(2, 2, ultimaFila - 1, 1);
    rangoObraId.setValue('0000');
    rangoObraDesc.setValue('Casa AP');
  }

  // Agregar la obra 0000 a la hoja Obras si no existe
  let shObras = ss.getSheetByName('Obras');
  if (!shObras) {
    shObras = ss.insertSheet('Obras');
    _crearEncabezadosObras(shObras);
  }
  const obrasExistentes = leerObras(ss, false);
  if (!obrasExistentes.find(o => o.id === '0000')) {
    shObras.appendRow(['0000','Casa AP',-34.5856758,-58.5714108,8,17,5,40,'ANY',true]);
    Logger.log('Obra 0000 - Casa AP agregada a la hoja Obras.');
  }

  // Actualizar encabezados completos de Registros
  _crearEncabezadosRegistros(reg, true);

  ui.alert(
    '✅ Migración completada.\n\n' +
    `${ultimaFila - 1} registros actualizados con ObraID=0000 y ObraDesc="Casa AP".\n\n` +
    'La obra "0000 - Casa AP" fue agregada a la hoja Obras.\n' +
    'Verificá sus coordenadas y parámetros antes de activar el trigger.'
  );
}


// ─────────────────────────────────────────────────────────────
//  HELPERS de setup
// ─────────────────────────────────────────────────────────────
function _crearEncabezadosRegistros(sheet, soloEncabezados) {
  const headers = [[
    'ObraID', 'ObraDesc', 'Timestamp', 'Fecha', 'Hora',
    'Latitud', 'Longitud',
    'Temperatura (°C)', 'Sensación térmica (°C)',
    'Precipitación (mm)', 'Humedad (%)',
    'Viento (km/h)', 'Descripción clima', 'Fuente'
  ]];
  sheet.getRange(1, 1, 1, TOTAL_COLS_REG).setValues(headers);
  sheet.getRange(1, 1, 1, TOTAL_COLS_REG)
    .setBackground('#1e2128').setFontColor('#f0a500').setFontWeight('bold');
  if (!soloEncabezados) sheet.setFrozenRows(1);
  [80,140,150,100,60,90,90,120,130,120,100,110,180,80]
    .forEach((w,i) => sheet.setColumnWidth(i+1, w));
}

function _crearEncabezadosObras(sheet) {
  sheet.getRange(1,1,1,10).setValues([[
    'ObraID','Descripción','Latitud','Longitud',
    'Hora inicio','Hora fin','Lluvia DP (mm)','Viento DP (km/h)',
    'Condición DP','Activa'
  ]]);
  sheet.getRange(1,1,1,10)
    .setBackground('#1e2128').setFontColor('#f0a500').setFontWeight('bold');
  sheet.setFrozenRows(1);
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — códigos WMO → descripción en español
// ─────────────────────────────────────────────────────────────
function convertirCodigoWMO(codigo) {
  const D = {
    0:  'Despejado',
    1:  'Principalmente despejado', 2: 'Parcialmente nublado', 3: 'Cubierto',
    45: 'Niebla', 48: 'Niebla con escarcha',
    51: 'Llovizna leve', 53: 'Llovizna moderada', 55: 'Llovizna intensa',
    56: 'Llovizna helada leve', 57: 'Llovizna helada intensa',
    61: 'Lluvia leve', 63: 'Lluvia moderada', 65: 'Lluvia intensa',
    66: 'Lluvia helada leve', 67: 'Lluvia helada intensa',
    71: 'Nieve leve', 73: 'Nieve moderada', 75: 'Nieve intensa',
    77: 'Nieve granizada',
    80: 'Chaparrones leves', 81: 'Chaparrones moderados', 82: 'Chaparrones violentos',
    85: 'Nevadas leves', 86: 'Nevadas intensas',
    95: 'Tormenta', 96: 'Tormenta con granizo leve', 99: 'Tormenta con granizo intensa'
  };
  return D[codigo] || ('Código WMO ' + codigo);
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — obtener datos horarios de UN rango de fechas
//  UNA SOLA llamada HTTP por obra para todo el período
//  Devuelve array de { fechaISO, fechaStr, hora, temperatura,
//    sensacion, precipitacion, humedad, viento, descripcion }
//  Solo horas dentro del rango horaInicio–horaFin de la obra
// ─────────────────────────────────────────────────────────────
function obtenerClimaOMRango(lat, lon, fechaDesde, fechaHasta, horaInicio, horaFin) {
  // fechaDesde / fechaHasta: 'yyyy-MM-dd'
  // Si fechaHasta tiene más de 3 días de antigüedad → /v1/archive (ERA5)
  // Si es reciente → /v1/forecast
  const hoy      = new Date();
  const corte    = new Date(hoy);
  corte.setDate(corte.getDate() - 3);
  const corteISO = Utilities.formatDate(corte, TIMEZONE, 'yyyy-MM-dd');
  const endpoint = (fechaHasta <= corteISO) ? 'archive' : 'forecast';

  const url =
    `https://api.open-meteo.com/v1/${endpoint}` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,apparent_temperature,precipitation,` +
    `relative_humidity_2m,wind_speed_10m,weather_code` +
    `&timezone=America%2FArgentina%2FBuenos_Aires` +
    `&start_date=${fechaDesde}&end_date=${fechaHasta}`;

  let resp;
  try {
    resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch(e) {
    throw new Error('Error de red Open-Meteo: ' + e.message);
  }
  if (resp.getResponseCode() !== 200) {
    throw new Error('HTTP ' + resp.getResponseCode() + ' en Open-Meteo: ' + resp.getContentText().substring(0, 200));
  }

  const data    = JSON.parse(resp.getContentText());
  const hourly  = data.hourly;
  const times   = hourly.time;
  const temps   = hourly.temperature_2m;
  const feels   = hourly.apparent_temperature;
  const precips = hourly.precipitation;
  const hums    = hourly.relative_humidity_2m;
  const winds   = hourly.wind_speed_10m;
  const codes   = hourly.weather_code;

  const resultado = [];
  for (let i = 0; i < times.length; i++) {
    // times[i] = 'yyyy-MM-ddTHH:00'
    const partes  = times[i].split('T');
    const fechaISO = partes[0]; // 'yyyy-MM-dd'
    const hora    = parseInt(partes[1].split(':')[0]);

    if (hora < horaInicio || hora > horaFin) continue;

    // Convertir fechaISO → dd/MM/yyyy
    const fp      = fechaISO.split('-');
    const fechaStr = `${fp[2]}/${fp[1]}/${fp[0]}`;

    resultado.push({
      fechaISO,
      fechaStr,
      hora:          String(hora).padStart(2, '0') + ':00',
      temperatura:   parseFloat(temps[i])   || 0,
      sensacion:     parseFloat(feels[i])   || 0,
      precipitacion: parseFloat(precips[i]) || 0,
      humedad:       parseInt(hums[i])       || 0,
      viento:        parseFloat(winds[i])   || 0,
      descripcion:   convertirCodigoWMO(codes[i])
    });
  }
  return resultado;
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — obtener datos horarios de un día específico
//  (wrapper de compatibilidad — usa la función de rango)
// ─────────────────────────────────────────────────────────────
function obtenerClimaOM(lat, lon, fechaISO, horaInicio, horaFin) {
  return obtenerClimaOMRango(lat, lon, fechaISO, fechaISO, horaInicio, horaFin);
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — setup hoja Registros_OM
// ─────────────────────────────────────────────────────────────
function setupHojaRegistrosOM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh   = ss.getSheetByName('Registros_OM');
  if (!sh) {
    sh = ss.insertSheet('Registros_OM');
    Logger.log('Hoja Registros_OM creada.');
  }
  _crearEncabezadosRegistros(sh);
  SpreadsheetApp.getUi().alert('✅ Hoja "Registros_OM" lista.\nMismas columnas que Registros.\nColumna Fuente = "open-meteo".');
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — anti-duplicados para Registros_OM
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — insertar registros en Registros_OM (BATCH)
//  v13.4: carga hoja una vez en memoria, chequea duplicados con Set,
//  acumula filas y hace una sola escritura con setValues
// ─────────────────────────────────────────────────────────────
function _insertarRegistrosOM(ss, obra, registros) {
  const sheetOM = ss.getSheetByName('Registros_OM');
  if (!sheetOM) { Logger.log('❌ No existe hoja Registros_OM.'); return 0; }
  if (registros.length === 0) return 0;

  // Cargar claves existentes en Set para chequeo O(1)
  const existentes = new Set();
  const lastRow = sheetOM.getLastRow();
  if (lastRow > 1) {
    sheetOM.getRange(2, 1, lastRow - 1, 5).getValues().forEach(f => {
      const id    = String(f[0]).trim().padStart(4, '0');
      const fecha = f[3] instanceof Date
        ? Utilities.formatDate(f[3], TIMEZONE, 'dd/MM/yyyy')
        : String(f[3]).trim();
      const hora  = String(f[4]).trim();
      existentes.add(`${id}|${fecha}|${hora}`);
    });
  }

  // Acumular solo filas nuevas
  const filas = [];
  registros.forEach(r => {
    if (existentes.has(`${obra.id}|${r.fechaStr}|${r.hora}`)) return;
    filas.push([
      obra.id, obra.descripcion,
      `${r.fechaStr} ${r.hora}`, r.fechaStr, r.hora,
      obra.latitud, obra.longitud,
      r.temperatura, r.sensacion,
      r.precipitacion, r.humedad,
      r.viento, r.descripcion, 'open-meteo'
    ]);
  });

  if (filas.length === 0) {
    Logger.log(`⏭ Obra ${obra.id} — sin filas nuevas.`);
    return 0;
  }

  // Una sola escritura batch
  const primera = sheetOM.getLastRow() + 1;
  sheetOM.getRange(primera, 1, filas.length, TOTAL_COLS_REG).setValues(filas);
  sheetOM.getRange(primera, 1, filas.length, 1).setNumberFormat('@STRING@');
  Logger.log(`✅ Obra ${obra.id}: ${filas.length} filas en batch.`);
  return filas.length;
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — cargar UN día para TODAS las obras activas
//  (trigger diario 05:00)
// ─────────────────────────────────────────────────────────────
function _cargarDiaOM(ss, fechaISO) {
  const obras = leerObras(ss, true);
  let total = 0;
  obras.forEach(obra => {
    if (isNaN(obra.latitud) || isNaN(obra.longitud)) return;
    try {
      const regs = obtenerClimaOMRango(obra.latitud, obra.longitud, fechaISO, fechaISO, obra.horaInicio, obra.horaFin);
      total += _insertarRegistrosOM(ss, obra, regs);
    } catch(e) { Logger.log(`⚠️ Obra ${obra.id} — ${e.message}`); }
    Utilities.sleep(300);
  });
  return total;
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — cargar RANGO completo (histórico / catch-up)
//  UNA llamada HTTP por obra + batch insert
// ─────────────────────────────────────────────────────────────
function _cargarRangoOM(ss, fechaDesde, fechaHasta) {
  let sheetOM = ss.getSheetByName('Registros_OM');
  if (!sheetOM) {
    sheetOM = ss.insertSheet('Registros_OM');
    _crearEncabezadosRegistros(sheetOM);
  }
  const obras = leerObras(ss, true);
  let total = 0;
  obras.forEach(obra => {
    if (isNaN(obra.latitud) || isNaN(obra.longitud)) return;
    Logger.log(`▶ Obra ${obra.id} — OM ${fechaDesde} → ${fechaHasta}`);
    try {
      const regs = obtenerClimaOMRango(obra.latitud, obra.longitud, fechaDesde, fechaHasta, obra.horaInicio, obra.horaFin);
      total += _insertarRegistrosOM(ss, obra, regs);
    } catch(e) { Logger.log(`⚠️ Obra ${obra.id} — ${e.message}`); }
    Utilities.sleep(300);
  });
  return total;
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — trigger diario 05:00
//  Carga el día anterior para todas las obras activas
// ─────────────────────────────────────────────────────────────
function cargarDiarioOM() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const fechaISO = Utilities.formatDate(ayer, TIMEZONE, 'yyyy-MM-dd');
  Logger.log(`▶ cargarDiarioOM() — cargando ${fechaISO}`);
  _cargarDiaOM(ss, fechaISO);
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — carga histórica por tramos
//  v13.2: UNA sola llamada HTTP por obra por tramo
//  3 obras × 1 llamada = 3 llamadas totales → entra en 6 min
//
//  Ya cargado: 01/04 → 15/04 (tramos anteriores)
//  Pendiente:  16/04 → 06/05 — dividido en 2 tramos
// ─────────────────────────────────────────────────────────────
function _cargarTramoOM(fechaDesde, fechaHasta, nTramo, totalTramos) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ui  = SpreadsheetApp.getUi();

  Logger.log(`▶ Iniciando Tramo ${nTramo}: ${fechaDesde} → ${fechaHasta}`);
  const totalInsertados = _cargarRangoOM(ss, fechaDesde, fechaHasta);

  ui.alert(
    `✅ Tramo ${nTramo} completado\n\n` +
    `Período: ${fechaDesde} → ${fechaHasta}\n` +
    `Registros insertados: ${totalInsertados}\n\n` +
    (nTramo < totalTramos
      ? `Ahora corré el Tramo ${nTramo + 1} desde el menú.`
      : '¡Carga histórica completa! ✅\nActivá el trigger diario con la opción 8.')
  );
}

// Tramo A: 16/04/2026 → 30/04/2026  (15 días — 1 llamada por obra)
function cargarHistoricoOM_TramoA() { _cargarTramoOM('2026-04-16', '2026-04-30', 1, 2); }

// Tramo B: 01/05/2026 → 06/05/2026  (6 días — 1 llamada por obra)
function cargarHistoricoOM_TramoB() { _cargarTramoOM('2026-05-01', '2026-05-06', 2, 2); }

// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — catch-up automático
//  v13.5: detecta último registro en Registros_OM y carga
//  todos los días faltantes hasta ayer inclusive.
//  Usa /v1/archive para fechas >3 días, /v1/forecast para recientes.
// ─────────────────────────────────────────────────────────────
function cargarCatchUpOM() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheetOM = ss.getSheetByName('Registros_OM');
  if (!sheetOM) {
    SpreadsheetApp.getUi().alert('❌ No existe la hoja Registros_OM.\nEjecutá primero la opción 6.');
    return;
  }

  // Encontrar la fecha máxima en Registros_OM (col D = Fecha)
  const lastRow = sheetOM.getLastRow();
  let fechaMax  = null;
  if (lastRow > 1) {
    const fechas = sheetOM.getRange(2, 4, lastRow - 1, 1).getValues();
    fechas.forEach(f => {
      const v = f[0];
      if (!v) return;
      // Puede ser Date o string 'dd/MM/yyyy'
      let d;
      if (v instanceof Date) {
        d = Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd');
      } else {
        const parts = String(v).trim().split('/');
        if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      if (d && (!fechaMax || d > fechaMax)) fechaMax = d;
    });
  }

  // Calcular rango faltante: día siguiente al último → ayer
  const ayer    = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const ayerISO = Utilities.formatDate(ayer, TIMEZONE, 'yyyy-MM-dd');

  let desde;
  if (!fechaMax) {
    SpreadsheetApp.getUi().alert('❌ No se encontraron registros en Registros_OM.\nUsá las opciones 7a/7b para cargar el histórico primero.');
    return;
  }
  // día siguiente al último registrado
  const dMax  = new Date(fechaMax + 'T12:00:00');
  dMax.setDate(dMax.getDate() + 1);
  desde = Utilities.formatDate(dMax, TIMEZONE, 'yyyy-MM-dd');

  if (desde > ayerISO) {
    SpreadsheetApp.getUi().alert(
      `✅ Registros_OM al día.\nÚltimo registro: ${fechaMax}\nNo hay días faltantes.`
    );
    return;
  }

  Logger.log(`▶ cargarCatchUpOM() — catch-up ${desde} → ${ayerISO}`);
  const total = _cargarRangoOM(ss, desde, ayerISO);

  SpreadsheetApp.getUi().alert(
    `✅ Catch-up completado.\n` +
    `Rango cargado: ${desde} → ${ayerISO}\n` +
    `Filas nuevas insertadas: ${total}`
  );
}


// Función original — redirige a instrucciones
function cargarHistoricoOM() {
  SpreadsheetApp.getUi().alert(
    'ℹ️ Carga histórica — estado actual\n\n' +
    'Ya cargado: 01/04 → 15/04\n\n' +
    'Pendiente:\n' +
    '  · Tramo A (opción 7a): 16/04 → 30/04\n' +
    '  · Tramo B (opción 7b): 01/05 → 06/05\n\n' +
    'Corré cada tramo desde el menú, uno por vez.'
  );
}


// ─────────────────────────────────────────────────────────────
//  OPEN-METEO — trigger diario setup/eliminar
// ─────────────────────────────────────────────────────────────
function crearTriggerOM() {
  // Eliminar triggers previos de cargarDiarioOM
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'cargarDiarioOM') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cargarDiarioOM')
    .timeBased()
    .atHour(5)
    .everyDays(1)
    .create();
  SpreadsheetApp.getUi().alert(
    '✅ Trigger Open-Meteo activado.\n' +
    'cargarDiarioOM() se ejecutará todos los días a las 05:00.\n' +
    'Carga el día anterior para todas las obras activas.'
  );
}

function eliminarTriggerOM() {
  let eliminados = 0;
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'cargarDiarioOM') {
      ScriptApp.deleteTrigger(t); eliminados++;
    }
  });
  SpreadsheetApp.getUi().alert(`✅ ${eliminados} trigger(s) Open-Meteo eliminado(s).`);
}


// ─────────────────────────────────────────────────────────────
//  COMENTARIOS — v13.7
//  Hoja independiente "Comentarios" (multi-fuente):
//  ObraID | Fecha | Hora | ComentarioTexto | ComentarioCriticidad |
//  ComentarioUsuario | ComentarioEstado
// ─────────────────────────────────────────────────────────────

const COL_COM = {
  obraId:     1, fecha: 2, hora: 3,
  texto: 4, criticidad: 5, usuario: 6, estado: 7
};
const TOTAL_COLS_COM = 7;

function setupHojaComentarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh   = ss.getSheetByName('Comentarios');
  if (!sh) sh = ss.insertSheet('Comentarios');
  sh.getRange(1, 1, 1, TOTAL_COLS_COM).setValues([[
    'ObraID','Fecha','Hora','ComentarioTexto',
    'ComentarioCriticidad','ComentarioUsuario','ComentarioEstado'
  ]]).setBackground('#1e2128').setFontColor('#f0a500').setFontWeight('bold');
  sh.setFrozenRows(1);
  [80,100,60,220,120,200,90].forEach((w,i) => sh.setColumnWidth(i+1, w));
  SpreadsheetApp.getUi().alert('✅ Hoja "Comentarios" lista.');
}

// Convierte valor de celda Hora → string 'HH:mm'
// Sheets puede devolver: Date object, número decimal (0.5=12:00), o string
function _horaToStr(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) return Utilities.formatDate(val, TIMEZONE, 'HH:mm');
  if (typeof val === 'number') {
    const totalMin = Math.round(val * 24 * 60);
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
  }
  return String(val).trim();
}

// Horas disponibles para obraId+fechaStr en Registros y Registros_OM
function _getHorasRegistro(ss, obraId, fechaStr) {
  const horasSet = new Set();
  ['Registros', 'Registros_OM'].forEach(nombre => {
    const sh = ss.getSheetByName(nombre);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(f => {
      const id    = String(f[0]).trim().padStart(4, '0');
      const fecha = f[3] instanceof Date
        ? Utilities.formatDate(f[3], TIMEZONE, 'dd/MM/yyyy')
        : String(f[3]).trim();
      if (id === obraId && fecha === fechaStr) {
        const h = _horaToStr(f[4]);
        if (h) horasSet.add(h);
      }
    });
  });
  return [...horasSet].sort();
}

// Busca fila en hoja Comentarios para obraId+fecha+hora
function _encontrarFilaComentario(ss, obraId, fechaStr, hora) {
  const sh = ss.getSheetByName('Comentarios');
  if (!sh || sh.getLastRow() < 2) return null;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  for (let i = 0; i < vals.length; i++) {
    const id    = String(vals[i][0]).trim().padStart(4, '0');
    const fecha = vals[i][1] instanceof Date
      ? Utilities.formatDate(vals[i][1], TIMEZONE, 'dd/MM/yyyy')
      : String(vals[i][1]).trim();
    const horaF = _horaToStr(vals[i][2]);
    if (id === obraId && fecha === fechaStr && horaF === hora) {
      return { sheet: sh, rowIndex: i + 2 };
    }
  }
  return null;
}

// Comentarios de una obra en un rango de fechas ('dd/MM/yyyy')
function getComentarios(ss, obraId, fechaDesde, fechaHasta) {
  const sh = ss.getSheetByName('Comentarios');
  if (!sh || sh.getLastRow() < 2) return [];
  const dDesde = parsearFechaArg(fechaDesde + ' 00:00');
  const dHasta = parsearFechaArg(fechaHasta + ' 23:59');
  const resultado = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, TOTAL_COLS_COM).getValues().forEach(f => {
    const id = String(f[0]).trim().padStart(4, '0');
    if (id !== obraId) return;
    const texto = String(f[3]).trim();
    if (!texto) return;
    const fecha = f[1] instanceof Date
      ? Utilities.formatDate(f[1], TIMEZONE, 'dd/MM/yyyy')
      : String(f[1]).trim();
    const dFecha = parsearFechaArg(fecha + ' 00:00');
    if (dFecha < dDesde || dFecha > dHasta) return;
    resultado.push({
      fecha, hora: _horaToStr(f[2]), texto,
      criticidad: String(f[4]).trim() || 'normal',
      usuario:    String(f[5]).trim(),
      estado:     String(f[6]).trim() || 'activo'
    });
  });
  resultado.sort((a, b) => {
    const ka = a.fecha.split('/').reverse().join('') + a.hora;
    const kb = b.fecha.split('/').reverse().join('') + b.hora;
    return ka.localeCompare(kb);
  });
  return resultado;
}

function saveComentario(ss, obraId, fechaStr, hora, texto, criticidad, emailUsuario) {
  const existente = _encontrarFilaComentario(ss, obraId, fechaStr, hora);
  if (existente) {
    const estado = String(existente.sheet.getRange(existente.rowIndex, COL_COM.estado).getValue()).trim();
    if (estado !== 'cancelado') return { ok: false, error: 'ya_tiene_comentario' };
  }
  const sh = ss.getSheetByName('Comentarios');
  if (!sh) return { ok: false, error: 'hoja_comentarios_no_existe' };
  const nuevaFila = sh.getLastRow() + 1;
  sh.getRange(nuevaFila, 1, 1, TOTAL_COLS_COM).setValues([[
    obraId, fechaStr, hora, texto, criticidad || 'normal', emailUsuario, 'activo'
  ]]);
  sh.getRange(nuevaFila, 1).setNumberFormat('@STRING@');
  return { ok: true };
}

function editComentario(ss, obraId, fechaStr, hora, texto, criticidad, emailUsuario) {
  const fila = _encontrarFilaComentario(ss, obraId, fechaStr, hora);
  if (!fila) return { ok: false, error: 'comentario_no_encontrado' };
  const { sheet, rowIndex } = fila;
  const autor  = String(sheet.getRange(rowIndex, COL_COM.usuario).getValue()).trim().toLowerCase();
  const estado = String(sheet.getRange(rowIndex, COL_COM.estado).getValue()).trim();
  if (autor !== emailUsuario.toLowerCase()) return { ok: false, error: 'sin_permiso' };
  if (estado === 'cancelado') return { ok: false, error: 'comentario_cancelado' };
  if (texto)      sheet.getRange(rowIndex, COL_COM.texto).setValue(texto);
  if (criticidad) sheet.getRange(rowIndex, COL_COM.criticidad).setValue(criticidad);
  return { ok: true };
}

function cancelComentario(ss, obraId, fechaStr, hora, emailUsuario) {
  const fila = _encontrarFilaComentario(ss, obraId, fechaStr, hora);
  if (!fila) return { ok: false, error: 'comentario_no_encontrado' };
  const { sheet, rowIndex } = fila;
  const autor = String(sheet.getRange(rowIndex, COL_COM.usuario).getValue()).trim().toLowerCase();
  if (autor !== emailUsuario.toLowerCase()) return { ok: false, error: 'sin_permiso' };
  sheet.getRange(rowIndex, COL_COM.estado).setValue('cancelado');
  return { ok: true };
}




//  de Registros_OM en lugar de Registros
// ─────────────────────────────────────────────────────────────
function getDashboardDataOM(obraId) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const obras = leerObras(ss, false);
  const obra  = obras.find(o => o.id === String(obraId).trim().padStart(4, '0'));
  if (!obra) throw new Error('Obra no encontrada: ' + obraId);

  const sheetReg = ss.getSheetByName('Registros_OM');
  if (!sheetReg || sheetReg.getLastRow() <= 1) {
    return { version: VERSION_GAS, obra, ultimo: null, dias: [], anual: [], ultimoDia: null, uptime60: [], fuente: 'open-meteo' };
  }

  const todos = sheetReg.getRange(2, 1, sheetReg.getLastRow() - 1, TOTAL_COLS_REG).getValues();
  const datos = todos.filter(f => String(f[COL_REG.obraId - 1]).trim().padStart(4, '0') === obra.id);

  if (datos.length === 0) {
    return { version: VERSION_GAS, obra, ultimo: null, dias: [], anual: [], ultimoDia: null, uptime60: [], fuente: 'open-meteo' };
  }

  const ult    = datos[datos.length - 1];
  const ultimo = {
    timestamp:     String(ult[COL_REG.timestamp - 1]),
    temperatura:   parseFloat(ult[COL_REG.temp - 1])      || 0,
    sensacion:     parseFloat(ult[COL_REG.sensacion - 1])  || 0,
    precipitacion: parseFloat(ult[COL_REG.precip - 1])    || 0,
    humedad:       parseInt(ult[COL_REG.humedad - 1])      || 0,
    viento:        parseFloat(ult[COL_REG.viento - 1])    || 0,
    descripcion:   String(ult[COL_REG.descrip - 1])
  };

  const porFecha = {};
  datos.forEach(fila => {
    const fecha = parsearFechaArg(fila[COL_REG.timestamp - 1]);
    if (!fecha) return;
    if (!porFecha[fecha]) porFecha[fecha] = { temps: [], vientos: [], lluvias: [] };
    porFecha[fecha].temps.push(parseFloat(fila[COL_REG.temp - 1])    || 0);
    porFecha[fecha].vientos.push(parseFloat(fila[COL_REG.viento - 1]) || 0);
    porFecha[fecha].lluvias.push(parseFloat(fila[COL_REG.precip - 1]) || 0);
  });

  const calcDia = fecha => {
    const d           = porFecha[fecha];
    const tempProm    = d.temps.reduce((a,b) => a+b, 0) / d.temps.length;
    const vientoMax   = Math.max(...d.vientos);
    const lluviaTotal = d.lluvias.reduce((a,b) => a+b, 0);
    const esPerdido   = obra.condicionDP === 'ALL'
      ? (lluviaTotal >= obra.lluviaDP && vientoMax >= obra.vientoDP)
      : (lluviaTotal >= obra.lluviaDP || vientoMax >= obra.vientoDP);
    return { fecha, tempProm: Math.round(tempProm*10)/10, vientoMax: Math.round(vientoMax), lluviaTotal: Math.round(lluviaTotal*10)/10, diaPerdido: esPerdido };
  };

  const fechasOrdenadas = Object.keys(porFecha).sort();
  const ultimos28       = fechasOrdenadas.slice(-28).map(calcDia);
  const anual           = fechasOrdenadas.map(calcDia);

  const ultimaFecha    = fechasOrdenadas[fechasOrdenadas.length - 1];
  const horasPorUltimo = {};
  datos.forEach(fila => {
    if (parsearFechaArg(fila[COL_REG.timestamp - 1]) !== ultimaFecha) return;
    let horaStr = fila[COL_REG.hora - 1];
    if (horaStr instanceof Date && !isNaN(horaStr)) {
      horaStr = Utilities.formatDate(horaStr, TIMEZONE, 'HH:00');
    } else {
      horaStr = String(horaStr).trim();
      if (horaStr.length === 4) horaStr = '0' + horaStr;
    }
    horasPorUltimo[horaStr] = {
      temp:   parseFloat(fila[COL_REG.temp - 1])    || 0,
      viento: parseFloat(fila[COL_REG.viento - 1]) || 0,
      lluvia: parseFloat(fila[COL_REG.precip - 1]) || 0
    };
  });
  const ultimoDia = { fecha: ultimaFecha, horas: [], temps: [], vientos: [], lluvias: [] };
  Object.keys(horasPorUltimo).sort().forEach(h => {
    ultimoDia.horas.push(h);
    ultimoDia.temps.push(horasPorUltimo[h].temp);
    ultimoDia.vientos.push(horasPorUltimo[h].viento);
    ultimoDia.lluvias.push(horasPorUltimo[h].lluvia);
  });

  const hoy      = new Date();
  const uptime60 = [];
  for (let d = 59; d >= 0; d--) {
    const dia      = new Date(hoy);
    dia.setDate(hoy.getDate() - d);
    const fechaDia = Utilities.formatDate(dia, TIMEZONE, 'yyyy-MM-dd');
    const calcado  = porFecha[fechaDia] ? calcDia(fechaDia) : null;
    uptime60.push({
      fecha:       fechaDia,
      estado:      calcado ? (calcado.diaPerdido ? 'perdido' : 'normal') : 'sinDatos',
      tempProm:    calcado ? calcado.tempProm    : null,
      vientoMax:   calcado ? calcado.vientoMax   : null,
      lluviaTotal: calcado ? calcado.lluviaTotal : null
    });
  }

  // Mapa horas disponibles por día (últimos 28)
  const horasPorDiaOM = {};
  const fechasUltimos28OM = new Set(ultimos28.map(d => d.fecha));
  datos.forEach(fila => {
    const fecha = parsearFechaArg(fila[COL_REG.timestamp - 1]);
    if (!fecha || !fechasUltimos28OM.has(fecha)) return;
    const fp = fecha.split('-');
    const fechaArg = `${fp[2]}/${fp[1]}/${fp[0]}`;
    if (!horasPorDiaOM[fechaArg]) horasPorDiaOM[fechaArg] = new Set();
    let horaStr = fila[COL_REG.hora - 1];
    if (horaStr instanceof Date && !isNaN(horaStr)) {
      horaStr = Utilities.formatDate(horaStr, TIMEZONE, 'HH:mm');
    } else {
      horaStr = String(horaStr).trim();
      if (horaStr.length === 4) horaStr = '0' + horaStr;
    }
    if (horaStr) horasPorDiaOM[fechaArg].add(horaStr);
  });
  const horasPorDiaObjOM = {};
  Object.keys(horasPorDiaOM).forEach(f => {
    horasPorDiaObjOM[f] = [...horasPorDiaOM[f]].sort();
  });

  return { version: VERSION_GAS, obra, ultimo, dias: ultimos28, anual, ultimoDia, uptime60, horasPorDia: horasPorDiaObjOM, fuente: 'open-meteo' };
}


// ─────────────────────────────────────────────────────────────
//  getReportDataOM — igual que getReportData pero usa Registros_OM
// ─────────────────────────────────────────────────────────────
function getReportDataOM(ss, obraId, anio, mes) {
  const obras = leerObras(ss, false);
  const obra  = obras.find(o => o.id === String(obraId).trim().padStart(4, '0'));
  if (!obra) return { ok: false, error: 'Obra no encontrada: ' + obraId };

  const sheetReg = ss.getSheetByName('Registros_OM');
  if (!sheetReg || sheetReg.getLastRow() <= 1) {
    return { ok: false, error: 'Sin registros en Registros_OM' };
  }

  // Reutilizamos la lógica de getReportData reemplazando la hoja de origen
  // Hacemos un swap temporal del nombre de hoja dentro de getReportData
  // en realidad es más limpio llamar directamente con la misma lógica:
  const todos  = sheetReg.getRange(2, 1, sheetReg.getLastRow() - 1, TOTAL_COLS_REG).getValues();
  const deObra = todos.filter(f =>
    String(f[COL_REG.obraId - 1]).trim().padStart(4, '0') === obra.id
  );

  const mesesSet = new Set();
  deObra.forEach(f => {
    const fecha = parsearFechaArg(f[COL_REG.timestamp - 1]);
    if (fecha) mesesSet.add(fecha.substring(0, 7));
  });
  const mesesDisponibles = Array.from(mesesSet).sort();

  function calcularMes(anioM, mesM) {
    const prefijo  = `${anioM}-${String(mesM).padStart(2, '0')}`;
    const diasMes  = new Date(anioM, mesM, 0).getDate();
    const registros = deObra.filter(f => {
      const fecha = parsearFechaArg(f[COL_REG.timestamp - 1]);
      return fecha && fecha.startsWith(prefijo);
    });
    if (registros.length === 0) return null;

    const porDia = {};
    registros.forEach(f => {
      const fecha = parsearFechaArg(f[COL_REG.timestamp - 1]);
      if (!fecha) return;
      if (!porDia[fecha]) porDia[fecha] = { temps: [], vientos: [], lluvias: [], condiciones: [] };
      porDia[fecha].temps.push(parseFloat(f[COL_REG.temp - 1]) || 0);
      porDia[fecha].vientos.push(parseFloat(f[COL_REG.viento - 1]) || 0);
      porDia[fecha].lluvias.push(parseFloat(f[COL_REG.precip - 1]) || 0);
      porDia[fecha].condiciones.push(String(f[COL_REG.descrip - 1]).trim());
    });

    const fechasDia = Object.keys(porDia).sort();
    const diasRegistrados = fechasDia.length;
    const metricasDia = fechasDia.map(fecha => {
      const d           = porDia[fecha];
      const tempProm    = d.temps.reduce((a,b)=>a+b,0) / d.temps.length;
      const vientoMax   = Math.max(...d.vientos);
      const vientoMin   = Math.min(...d.vientos);
      const lluviaTotal = Math.max(...d.lluvias);
      const esPerdido   = obra.condicionDP === 'ALL'
        ? (lluviaTotal >= obra.lluviaDP && vientoMax >= obra.vientoDP)
        : (lluviaTotal >= obra.lluviaDP || vientoMax >= obra.vientoDP);
      const freqCond = {};
      d.condiciones.forEach(c => freqCond[c] = (freqCond[c]||0) + 1);
      const condFrec = Object.entries(freqCond).sort((a,b)=>b[1]-a[1])[0][0];
      return { fecha, tempProm: Math.round(tempProm*10)/10, vientoMax, vientoMin, lluviaTotal: Math.round(lluviaTotal*10)/10, diaPerdido: esPerdido, condicion: condFrec };
    });

    const allTemps   = metricasDia.map(d => d.tempProm);
    const tempMaxRaw = Math.max(...deObra.filter(f=>{const fe=parsearFechaArg(f[COL_REG.timestamp-1]);return fe&&fe.startsWith(prefijo);}).map(f=>parseFloat(f[COL_REG.temp-1])||0));
    const tempMinRaw = Math.min(...deObra.filter(f=>{const fe=parsearFechaArg(f[COL_REG.timestamp-1]);return fe&&fe.startsWith(prefijo);}).map(f=>parseFloat(f[COL_REG.temp-1])||0));
    const tempProm   = Math.round((allTemps.reduce((a,b)=>a+b,0)/allTemps.length)*10)/10;
    const diaMaxTemp = metricasDia.reduce((a,b)=>b.tempProm>a.tempProm?b:a);
    const diaMinTemp = metricasDia.reduce((a,b)=>b.tempProm<a.tempProm?b:a);
    const vientoMax  = Math.max(...metricasDia.map(d=>d.vientoMax));
    const vientoMin  = Math.min(...metricasDia.map(d=>d.vientoMin));
    const vientoProm = Math.round(metricasDia.reduce((a,d)=>a+d.vientoMax,0)/metricasDia.length*10)/10;
    const diaMaxViento = metricasDia.reduce((a,b)=>b.vientoMax>a.vientoMax?b:a);
    const lluviaAcum   = Math.round(metricasDia.reduce((a,d)=>a+d.lluviaTotal,0)*10)/10;
    const lluviaMaxDia = Math.max(...metricasDia.map(d=>d.lluviaTotal));
    const diaMaxLluvia = metricasDia.reduce((a,b)=>b.lluviaTotal>a.lluviaTotal?b:a);
    const diasConLluvia = metricasDia.filter(d=>d.lluviaTotal>0).length;
    const diasPerdidos = metricasDia.filter(d=>d.diaPerdido).length;
    const diasNormales = diasRegistrados - diasPerdidos;
    const sinRegistro  = diasMes - diasRegistrados;
    const operatividad = Math.round(diasNormales / diasRegistrados * 100);
    const freqTotal = {};
    registros.forEach(f=>{const c=String(f[COL_REG.descrip-1]).trim();freqTotal[c]=(freqTotal[c]||0)+1;});
    const totalRegs  = registros.length;
    const condiciones = Object.entries(freqTotal).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([nombre,cantidad])=>({nombre,cantidad,pct:Math.round(cantidad/totalRegs*100)}));
    function fmt(isoFecha){const p=isoFecha.split('-');return `${p[2]}/${p[1]}`;}
    return { diasTotales:diasMes, diasRegistrados, diasNormales, diasPerdidos, sinRegistro, operatividad, tempMax:tempMaxRaw, tempMaxFecha:fmt(diaMaxTemp.fecha), tempMin:tempMinRaw, tempMinFecha:fmt(diaMinTemp.fecha), tempProm, vientoMax, vientoMaxFecha:fmt(diaMaxViento.fecha), vientoMin, vientoProm, lluviaMaxDia, lluviaMaxFecha:fmt(diaMaxLluvia.fecha), lluviaAcum, diasConLluvia, condiciones, dias:metricasDia.map(d=>({fecha:d.fecha,estado:d.diaPerdido?'perdido':'normal',tempProm:d.tempProm,vientoMax:d.vientoMax,lluviaTotal:d.lluviaTotal})) };
  }

  const mesNombres = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesActual  = calcularMes(anio, mes);
  const mesAntAnio = mes === 1 ? anio - 1 : anio;
  const mesAntMes  = mes === 1 ? 12 : mes - 1;
  const mesAnterior = calcularMes(mesAntAnio, mesAntMes);

  return { ok: true, obra, fuente: 'open-meteo', periodo: { anio, mes, nombre: mesNombres[mes]+' '+anio, nombreAnt: mesNombres[mesAntMes]+' '+mesAntAnio, mesesDisponibles }, mesActual, mesAnterior };
}


// ─────────────────────────────────────────────────────────────
//  TRIGGER
// ─────────────────────────────────────────────────────────────
function crearTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'registrarClima') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('registrarClima').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert(
    '✅ Trigger activado.\nEl clima de todas las obras activas se registrará cada hora.'
  );
}

function eliminarTrigger() {
  const triggers  = ScriptApp.getProjectTriggers();
  let eliminados  = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'registrarClima') {
      ScriptApp.deleteTrigger(t); eliminados++;
    }
  });
  SpreadsheetApp.getUi().alert(`✅ ${eliminados} trigger(s) eliminado(s). Registro pausado.`);
}

function registrarAhora() {
  registrarClima();
  SpreadsheetApp.getUi().alert('✅ Registro manual completado. Revisá la hoja "Registros".');
}


// ─────────────────────────────────────────────────────────────
//  MENÚ PERSONALIZADO
// ─────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏗️ ClimaObra')
    .addItem('1. Setup inicial — crear hojas (primera vez)',          'setupHojas')
    .addItem('2. Migrar Registros v9 → v10 (agrega ObraID)',          'migrarRegistrosV10')
    .addSeparator()
    .addItem('3. Activar registro automático (wttr.in)',              'crearTrigger')
    .addItem('4. Pausar registro automático (wttr.in)',               'eliminarTrigger')
    .addSeparator()
    .addItem('5. Registrar clima ahora (prueba manual)',              'registrarAhora')
    .addSeparator()
    .addItem('6. Setup hoja Registros_OM (Open-Meteo)',               'setupHojaRegistrosOM')
    .addItem('6b. Setup hoja Comentarios (nueva — multi-fuente)',       'setupHojaComentarios')
    .addItem('7a. Histórico OM — Tramo A: 16/04–30/04 (1 llamada/obra)',  'cargarHistoricoOM_TramoA')
    .addItem('7b. Histórico OM — Tramo B: 01/05–06/05 (1 llamada/obra)',  'cargarHistoricoOM_TramoB')
    .addItem('7c. Catch-up OM — recuperar días faltantes (auto)',         'cargarCatchUpOM')
    .addItem('8. Activar trigger diario OM (05:00)',                  'crearTriggerOM')
    .addItem('9. Pausar trigger diario OM',                          'eliminarTriggerOM')
    .addToUi();
}


// ─────────────────────────────────────────────────────────────
//  getExportData — devuelve registros crudos de una obra
//  filtrados por rango de fechas (yyyy-MM-dd)
// ─────────────────────────────────────────────────────────────
function getExportData(ss, obraId, desde, hasta) {
  const sheetReg = ss.getSheetByName('Registros');
  if (!sheetReg || sheetReg.getLastRow() <= 1) {
    return { ok: true, headers: [], rows: [] };
  }

  const todos = sheetReg.getRange(2, 1, sheetReg.getLastRow() - 1, TOTAL_COLS_REG).getValues();

  const rows = todos
    .filter(f => {
      const id = String(f[COL_REG.obraId - 1]).trim().padStart(4, '0');
      if (id !== obraId) return false;
      const fecha = parsearFechaArg(f[COL_REG.timestamp - 1]);
      if (!fecha) return false;
      if (desde && fecha < desde) return false;
      if (hasta  && fecha > hasta)  return false;
      return true;
    })
    .map(f => {
      // Formatear fecha y hora para que lleguen como strings limpios
      const ts    = f[COL_REG.timestamp - 1];
      const fecha = f[COL_REG.fecha - 1];
      const hora  = f[COL_REG.hora  - 1];
      return [
        String(f[COL_REG.obraId   - 1]).trim().padStart(4, '0'),
        String(f[COL_REG.obraDesc - 1]).trim(),
        ts instanceof Date
          ? Utilities.formatDate(ts, TIMEZONE, 'dd/MM/yyyy HH:mm')
          : String(ts).trim(),
        fecha instanceof Date
          ? Utilities.formatDate(fecha, TIMEZONE, 'dd/MM/yyyy')
          : String(fecha).trim(),
        hora instanceof Date
          ? Utilities.formatDate(hora, TIMEZONE, 'HH:mm')
          : String(hora).trim(),
        parseFloat(f[COL_REG.latitud  - 1]) || 0,
        parseFloat(f[COL_REG.longitud - 1]) || 0,
        parseFloat(f[COL_REG.temp     - 1]) || 0,
        parseFloat(f[COL_REG.sensacion- 1]) || 0,
        parseFloat(f[COL_REG.precip   - 1]) || 0,
        parseInt(f[COL_REG.humedad    - 1]) || 0,
        parseFloat(f[COL_REG.viento   - 1]) || 0,
        String(f[COL_REG.descrip - 1]).trim(),
        String(f[COL_REG.fuente  - 1]).trim()
      ];
    });

  return {
    ok: true,
    headers: [
      'ObraID','ObraDesc','Timestamp','Fecha','Hora',
      'Latitud','Longitud',
      'Temperatura (°C)','Sensación térmica (°C)',
      'Precipitación (mm)','Humedad (%)','Viento (km/h)',
      'Descripción clima','Fuente'
    ],
    rows
  };
}


// ─────────────────────────────────────────────────────────────
//  getReportData — datos completos para informe PDF mensual
//  Parámetros: obraId (string), anio (int), mes (int 1-12)
//  Devuelve:
//    ok, obra, periodo, mesActual, mesAnterior
//
//  mesActual y mesAnterior tienen la misma estructura:
//    diasRegistrados, diasTotales, diasNormales, diasPerdidos,
//    sinRegistro, operatividad,
//    tempMax, tempMaxFecha, tempMin, tempMinFecha, tempProm,
//    vientoMax, vientoMaxFecha, vientoMin, vientoProm,
//    lluviaMaxDia, lluviaMaxFecha, lluviaAcum, diasConLluvia,
//    condiciones [ {nombre, cantidad, pct} ],
//    dias [ {fecha, estado, tempProm, vientoMax, lluviaTotal} ]
// ─────────────────────────────────────────────────────────────
function getReportData(ss, obraId, anio, mes) {
  const obras = leerObras(ss, false);
  const obra  = obras.find(o => o.id === String(obraId).trim().padStart(4, '0'));
  if (!obra) return { ok: false, error: 'Obra no encontrada: ' + obraId };

  const sheetReg = ss.getSheetByName('Registros');
  if (!sheetReg || sheetReg.getLastRow() <= 1) {
    return { ok: false, error: 'Sin registros' };
  }

  const todos = sheetReg.getRange(2, 1, sheetReg.getLastRow() - 1, TOTAL_COLS_REG).getValues();

  // Filtrar registros de la obra
  const deObra = todos.filter(f =>
    String(f[COL_REG.obraId - 1]).trim().padStart(4, '0') === obra.id
  );

  // Detectar meses disponibles (yyyy-MM únicos con datos)
  const mesesSet = new Set();
  deObra.forEach(f => {
    const fecha = parsearFechaArg(f[COL_REG.timestamp - 1]);
    if (fecha) mesesSet.add(fecha.substring(0, 7));
  });
  const mesesDisponibles = Array.from(mesesSet).sort();

  // Calcular stats de un mes dado
  function calcularMes(anioM, mesM) {
    const prefijo  = `${anioM}-${String(mesM).padStart(2, '0')}`;
    const diasMes  = new Date(anioM, mesM, 0).getDate(); // días totales del mes

    const registros = deObra.filter(f => {
      const fecha = parsearFechaArg(f[COL_REG.timestamp - 1]);
      return fecha && fecha.startsWith(prefijo);
    });

    if (registros.length === 0) return null;

    // Agrupar por día
    const porDia = {};
    registros.forEach(f => {
      const fecha = parsearFechaArg(f[COL_REG.timestamp - 1]);
      if (!fecha) return;
      if (!porDia[fecha]) porDia[fecha] = { temps: [], vientos: [], lluvias: [], condiciones: [] };
      porDia[fecha].temps.push(parseFloat(f[COL_REG.temp - 1]) || 0);
      porDia[fecha].vientos.push(parseFloat(f[COL_REG.viento - 1]) || 0);
      porDia[fecha].lluvias.push(parseFloat(f[COL_REG.precip - 1]) || 0);
      porDia[fecha].condiciones.push(String(f[COL_REG.descrip - 1]).trim());
    });

    const fechasDia   = Object.keys(porDia).sort();
    const diasRegistrados = fechasDia.length;

    // Métricas por día
    const metricasDia = fechasDia.map(fecha => {
      const d           = porDia[fecha];
      const tempProm    = d.temps.reduce((a,b)=>a+b,0) / d.temps.length;
      const vientoMax   = Math.max(...d.vientos);
      const vientoMin   = Math.min(...d.vientos);
      const lluviaTotal = Math.max(...d.lluvias); // max del día (acumulada puntual)
      const esPerdido   = obra.condicionDP === 'ALL'
        ? (lluviaTotal >= obra.lluviaDP && vientoMax >= obra.vientoDP)
        : (lluviaTotal >= obra.lluviaDP || vientoMax >= obra.vientoDP);
      // Condición más frecuente del día
      const freqCond = {};
      d.condiciones.forEach(c => freqCond[c] = (freqCond[c]||0) + 1);
      const condFrec = Object.entries(freqCond).sort((a,b)=>b[1]-a[1])[0][0];
      return { fecha, tempProm: Math.round(tempProm*10)/10, vientoMax, vientoMin,
               lluviaTotal: Math.round(lluviaTotal*10)/10, diaPerdido: esPerdido,
               condicion: condFrec };
    });

    // Temperatura global del mes
    const allTemps    = metricasDia.map(d => d.tempProm);
    const tempMax     = Math.max(...metricasDia.map(d=>d.tempProm)); // máx de promedios diarios
    const tempMaxRaw  = Math.max(...deObra.filter(f=>{
      const fecha=parsearFechaArg(f[COL_REG.timestamp-1]);
      return fecha && fecha.startsWith(prefijo);
    }).map(f=>parseFloat(f[COL_REG.temp-1])||0)); // temp horaria más alta
    const tempMinRaw  = Math.min(...deObra.filter(f=>{
      const fecha=parsearFechaArg(f[COL_REG.timestamp-1]);
      return fecha && fecha.startsWith(prefijo);
    }).map(f=>parseFloat(f[COL_REG.temp-1])||0));
    const tempProm    = Math.round((allTemps.reduce((a,b)=>a+b,0)/allTemps.length)*10)/10;

    // Fecha de temp máx / mín
    const diaMaxTemp  = metricasDia.reduce((a,b)=>b.tempProm>a.tempProm?b:a);
    const diaMinTemp  = metricasDia.reduce((a,b)=>b.tempProm<a.tempProm?b:a);

    // Viento
    const vientoMax   = Math.max(...metricasDia.map(d=>d.vientoMax));
    const vientoMin   = Math.min(...metricasDia.map(d=>d.vientoMin));
    const vientoProm  = Math.round(metricasDia.reduce((a,d)=>a+d.vientoMax,0)/metricasDia.length*10)/10;
    const diaMaxViento = metricasDia.reduce((a,b)=>b.vientoMax>a.vientoMax?b:a);

    // Lluvia
    const lluviaAcum   = Math.round(metricasDia.reduce((a,d)=>a+d.lluviaTotal,0)*10)/10;
    const lluviaMaxDia = Math.max(...metricasDia.map(d=>d.lluviaTotal));
    const diaMaxLluvia = metricasDia.reduce((a,b)=>b.lluviaTotal>a.lluviaTotal?b:a);
    const diasConLluvia = metricasDia.filter(d=>d.lluviaTotal>0).length;

    // Días perdidos / normales
    const diasPerdidos = metricasDia.filter(d=>d.diaPerdido).length;
    const diasNormales = diasRegistrados - diasPerdidos;
    const sinRegistro  = diasMes - diasRegistrados;
    const operatividad = Math.round(diasNormales / diasRegistrados * 100);

    // Condiciones climáticas — frecuencia de registros horarios
    const freqTotal = {};
    registros.forEach(f => {
      const c = String(f[COL_REG.descrip-1]).trim();
      freqTotal[c] = (freqTotal[c]||0) + 1;
    });
    const totalRegs = registros.length;
    const condiciones = Object.entries(freqTotal)
      .sort((a,b)=>b[1]-a[1])
      .slice(0, 6)
      .map(([nombre, cantidad]) => ({
        nombre,
        cantidad,
        pct: Math.round(cantidad/totalRegs*100)
      }));

    // Formatear fecha dd/MM
    function fmt(isoFecha) {
      const p = isoFecha.split('-');
      return `${p[2]}/${p[1]}`;
    }

    return {
      diasTotales:    diasMes,
      diasRegistrados,
      diasNormales,
      diasPerdidos,
      sinRegistro,
      operatividad,
      tempMax:        tempMaxRaw,
      tempMaxFecha:   fmt(diaMaxTemp.fecha),
      tempMin:        tempMinRaw,
      tempMinFecha:   fmt(diaMinTemp.fecha),
      tempProm,
      vientoMax,
      vientoMaxFecha: fmt(diaMaxViento.fecha),
      vientoMin,
      vientoProm,
      lluviaMaxDia,
      lluviaMaxFecha: fmt(diaMaxLluvia.fecha),
      lluviaAcum,
      diasConLluvia,
      condiciones,
      dias: metricasDia.map(d => ({
        fecha:       d.fecha,
        estado:      d.diaPerdido ? 'perdido' : 'normal',
        tempProm:    d.tempProm,
        vientoMax:   d.vientoMax,
        lluviaTotal: d.lluviaTotal
      }))
    };
  }

  const mesNombres = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const mesActual   = calcularMes(anio, mes);
  // Mes anterior
  const mesAntAnio  = mes === 1 ? anio - 1 : anio;
  const mesAntMes   = mes === 1 ? 12 : mes - 1;
  const mesAnterior = calcularMes(mesAntAnio, mesAntMes);

  return {
    ok: true,
    obra,
    periodo: {
      anio, mes,
      nombre:       mesNombres[mes] + ' ' + anio,
      nombreAnt:    mesNombres[mesAntMes] + ' ' + mesAntAnio,
      mesesDisponibles
    },
    mesActual,
    mesAnterior
  };
}
