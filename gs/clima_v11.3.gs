// ============================================================
//  CLIMAOBRA  v11.1  —  Multi-obra + Fix ObraID padding
//  API: wttr.in (gratuita, sin API key, sin límite de requests)
//
//  HISTORIAL DE VERSIONES:
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
const VERSION_GAS = 'v11.3';
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

  return { version: VERSION_GAS, obra, ultimo, dias: ultimos28, anual, ultimoDia, uptime60 };
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

      default:
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
    .addItem('1. Setup inicial — crear hojas (primera vez)',     'setupHojas')
    .addItem('2. Migrar Registros v9 → v10 (agrega ObraID)',     'migrarRegistrosV10')
    .addSeparator()
    .addItem('3. Activar registro automático',                   'crearTrigger')
    .addItem('4. Pausar registro automático',                    'eliminarTrigger')
    .addSeparator()
    .addItem('5. Registrar clima ahora (prueba manual)',         'registrarAhora')
    .addToUi();
}
