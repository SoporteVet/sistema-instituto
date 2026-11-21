import { CATALOG_CODES } from './catalog-seed.js';

const HEADER_ALIASES = {
  grupo: ['grupo', 'group', 'numero grupo', 'numero de grupo', 'no grupo', 'nro grupo', 'grupo num'],
  fechaInicio: ['fecha de inicio', 'fecha inicio', 'fecha ingres', 'fecha ingreso', 'fechainicio', 'ingreso'],
  nombreCompleto: ['nombre del estudiante', 'nombre estudiante', 'estudiante', 'nombre completo', 'nombrecompleto'],
  nombrePila: ['nombre'],
  apellido: ['apellidos', 'apellido'],
  documento: ['identificacion', 'identificación', 'cedula', 'cédula', 'documento', 'id'],
  telefono: ['telefono', 'teléfono', 'tel', 'whatsapp'],
  telcel: ['telcel', 'celular'],
  teldom: ['teldom', 'telefono domicilio'],
  teltrab: ['teltrab', 'telefono trabajo'],
  email: ['correo electronico', 'correo electrónico', 'correo', 'email', 'e mail'],
  email2: ['email2', 'correo 2', 'correo2'],
  fechaNacimiento: ['fecha nacimient', 'fecha nacimiento', 'fecha de nacimiento', 'fechanacimiento', 'nacimiento'],
  nombreFacturacion: ['nombrefacturacion', 'nombre facturacion', 'nombre de facturacion'],
  materia: ['materia', 'asignatura', 'curso', 'codigo materia'],
  profesor: ['profesor', 'docente', 'catedratico'],
  horario: ['horario', 'schedule'],
  nota: ['nota final', 'nota', 'calificacion', 'calificación'],
  estado: ['estado', 'resultado', 'status'],
};

function normalizeHeader(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapHeaders(headerRow) {
  const mapping = {};
  const normalized = headerRow.map(h => normalizeHeader(h));

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex(h => aliases.some(a => h === a || h.includes(a)));
    if (idx >= 0 && mapping[field] == null) mapping[field] = idx;
  }

  // "nombre" suelto no debe pisar nombrecompleto
  if (mapping.nombrePila != null && mapping.nombreCompleto != null) {
    const nIdx = normalized.findIndex(h => h === 'nombre');
    const ncIdx = normalized.findIndex(h => h.includes('nombrecompleto') || h === 'nombre completo');
    if (nIdx >= 0) mapping.nombrePila = nIdx;
    if (ncIdx >= 0) mapping.nombreCompleto = ncIdx;
  }

  return mapping;
}

function parseGrupoNumero(raw) {
  const n = Number(String(raw ?? '').replace(/\D/g, ''));
  return n > 0 ? n : null;
}

function detectImportFormat(headerRow, mapping) {
  const normalized = headerRow.map(normalizeHeader);
  const joined = normalized.join(' ');

  const hasApellidos = mapping.apellido != null || normalized.some(h => h.includes('apellido'));
  const hasNombre = mapping.nombrePila != null || mapping.nombreCompleto != null;
  const hasIdentificacion = mapping.documento != null;
  const hasMateria = mapping.materia != null || /atv-\d{3}/i.test(joined);
  const hasFechaIngreso = mapping.fechaInicio != null || joined.includes('fecha ingres');
  const hasNota = mapping.nota != null;
  const hasProfesor = mapping.profesor != null;

  // Listas por materia / notas
  if (hasMateria) return 'matricula';
  if (hasProfesor || hasNota) return 'matricula';

  // Padrón de estudiantes (puede incluir columna Grupo antes de identificación)
  if (hasIdentificacion && (hasApellidos || hasNombre || hasFechaIngreso)) {
    return 'estudiantes';
  }

  if (mapping.grupo != null && hasIdentificacion && hasNombre) return 'matricula';

  return hasIdentificacion && hasNombre ? 'estudiantes' : 'matricula';
}

function cellStr(val) {
  if (val == null || val === '') return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (val > 40000 && val < 60000) return excelSerialToISO(val);
    return String(val);
  }
  return String(val).trim();
}

function excelSerialToISO(serial) {
  const utc = new Date(Math.round((serial - 25569) * 86400 * 1000));
  if (isNaN(utc.getTime())) return '';
  return utc.toISOString().slice(0, 10);
}

function parseDateInput(raw) {
  const s = cellStr(raw);
  if (!s || /^na$/i.test(s) || s === 'ND') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y.padStart(4, '0')}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

function cleanEmail(raw) {
  const s = cellStr(raw);
  if (!s || /^na$/i.test(s) || s === 'ND' || !s.includes('@')) return '';
  return s.toLowerCase();
}

function cleanPhone(...values) {
  for (const v of values) {
    const s = cellStr(v).replace(/\D/g, '');
    if (s.length >= 8) return s;
  }
  return '';
}

export function toTitleCase(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function splitNombreCompleto(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombre: '', apellido: '' };
  if (parts.length === 1) return { nombre: parts[0], apellido: '' };
  if (parts.length === 2) return { nombre: parts[0], apellido: parts[1] };
  return {
    nombre: parts.slice(0, -2).join(' ') || parts[0],
    apellido: parts.slice(-2).join(' '),
  };
}

export function extractCourseCode(materia) {
  const m = /ATV-\d{3}/i.exec(String(materia || ''));
  return m ? m[0].toUpperCase() : '';
}

function normalizeDocumento(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function parseNota(raw) {
  const s = cellStr(raw);
  if (!s || s === '—' || s === '-') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function mapEstadoEstudiante(raw) {
  const s = cellStr(raw).toUpperCase();
  if (!s || s === 'ND') return 'activo';
  if (s.includes('CONGEL')) return 'congelado';
  if (s.includes('INACTIV')) return 'inactivo';
  if (s.includes('GRADU')) return 'graduado';
  if (s.includes('RETIR')) return 'inactivo';
  if (s.includes('REVISION') || s.includes('REVISI')) return 'activo';
  if (s.includes('ACTIV')) return 'activo';
  return 'activo';
}

function parseEstadoMatricula(raw) {
  const s = cellStr(raw).toUpperCase();
  if (!s) return '';
  if (s.includes('CONGEL')) return 'congelado';
  if (s.includes('APROB')) return 'aprobado';
  if (s.includes('REPROB')) return 'reprobado';
  if (s.includes('RETIR')) return 'retirado';
  if (s.includes('GRADU')) return 'graduado';
  return s.toLowerCase();
}

function rowHasSuficiencia(cells) {
  return cells.some(c => String(c || '').toUpperCase().includes('SUFICIENCIA'));
}

export function inferFromFileName(fileName) {
  const base = String(fileName || '');
  const codigo = extractCourseCode(base);
  const grupoMatch = /grupo\s*(\d{1,2})/i.exec(base) || /\bG\s*(\d{1,2})\b/i.exec(base);
  const grupoNumero = grupoMatch ? Number(grupoMatch[1]) : null;
  return { codigoCurso: codigo, grupoNumero };
}

function validateMatriculaRow(row, lineNum) {
  const errors = [];
  if (!row.documento || row.documento.length < 9) {
    errors.push(`Fila ${lineNum}: cédula/identificación inválida o vacía`);
  }
  if (!row.nombreCompleto) {
    errors.push(`Fila ${lineNum}: nombre del estudiante requerido`);
  }
  if (!row.codigoCurso) {
    errors.push(`Fila ${lineNum}: no se encontró código ATV-XXX (columna Materia ni nombre de archivo)`);
  } else if (!CATALOG_CODES.includes(row.codigoCurso)) {
    errors.push(`Fila ${lineNum}: código ${row.codigoCurso} no está en el catálogo`);
  }
  if (row.grupoNumero == null || Number.isNaN(row.grupoNumero)) {
    errors.push(`Fila ${lineNum}: número de grupo inválido (columna Grupo ni nombre de archivo)`);
  }
  return errors;
}

function validateEstudianteRow(row, lineNum) {
  const errors = [];
  if (!row.documento || row.documento.length < 9) {
    errors.push(`Fila ${lineNum}: identificación inválida o vacía`);
  }
  if (!row.nombre && !row.apellido && !row.nombreCompleto) {
    errors.push(`Fila ${lineNum}: nombre o apellidos requeridos`);
  }
  return errors;
}

function buildSummary(rows) {
  const validRows = rows.filter(r => r.valid);
  const matriculaValid = validRows.filter(r => r.rowType === 'matricula');
  const estudianteValid = validRows.filter(r => r.rowType === 'estudiante');

  return {
    totalFilas: rows.length,
    filasValidas: validRows.length,
    filasConError: rows.length - validRows.length,
    formatos: {
      estudiantes: estudianteValid.length,
      matricula: matriculaValid.length,
    },
    grupos: new Set([
      ...matriculaValid.map(r => r.grupoNumero),
      ...estudianteValid.map(r => r.grupoNumero),
    ].filter(Boolean)).size,
    estudiantes: new Set(validRows.map(r => r.documento)).size,
    inscripciones: matriculaValid.length,
    materias: new Set(matriculaValid.map(r => r.codigoCurso).filter(Boolean)).size,
  };
}

function findHeaderIndex(matrix) {
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i].map(cellStr);
    const joined = row.join(' ').toLowerCase();
    if (
      (joined.includes('identificacion') || joined.includes('cedula')) &&
      (joined.includes('nombre') || joined.includes('apellido'))
    ) return i;
    if (joined.includes('grupo') && joined.includes('identificacion')) return i;
    if (
      joined.includes('nombre') &&
      (joined.includes('grupo') || joined.includes('materia') || joined.includes('atv'))
    ) return i;
  }
  return 0;
}

function parseEstudianteRows(matrix, meta, headerIdx, headerRow, mapping) {
  const rows = [];
  const rowErrors = [];

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const cells = matrix[i].map(cellStr);
    if (cells.every(c => !c)) continue;

    const get = field => (mapping[field] != null ? cells[mapping[field]] : '');

    let nombre = toTitleCase(get('nombrePila'));
    let apellido = toTitleCase(get('apellido'));
    let nombreCompleto = toTitleCase(get('nombreCompleto'));

    if (!nombreCompleto && (nombre || apellido)) {
      nombreCompleto = `${nombre} ${apellido}`.trim();
    }
    if (!nombre && !apellido && nombreCompleto) {
      const split = splitNombreCompleto(nombreCompleto);
      nombre = toTitleCase(split.nombre);
      apellido = toTitleCase(split.apellido);
    }

    const nombreFacturacion = toTitleCase(get('nombreFacturacion'));
    const notasExtra = nombreFacturacion ? `Facturación: ${nombreFacturacion}` : '';
    const grupoNumero = parseGrupoNumero(get('grupo'));

    const row = {
      lineNum: i + 1,
      rowType: 'estudiante',
      sourceFile: meta.sourceFile || '',
      sourceSheet: meta.sourceSheet || '',
      grupoNumero,
      grupoNombre: grupoNumero ? `Grupo ${grupoNumero}` : '',
      documento: normalizeDocumento(get('documento')),
      nombre,
      apellido,
      nombreCompleto: nombreCompleto || `${nombre} ${apellido}`.trim(),
      email: cleanEmail(get('email')),
      email2: cleanEmail(get('email2')),
      telefono: cleanPhone(get('telcel'), get('teldom'), get('telefono')),
      teldom: cleanPhone(get('teldom')),
      telcel: cleanPhone(get('telcel')),
      fechaIngreso: parseDateInput(get('fechaInicio')),
      fechaNacimiento: parseDateInput(get('fechaNacimiento')),
      estado: mapEstadoEstudiante(get('estado')),
      notas: notasExtra,
      valid: true,
      errors: [],
    };

    row.errors = validateEstudianteRow(row, row.lineNum);
    row.valid = row.errors.length === 0;
    if (!row.valid) rowErrors.push(...row.errors);
    rows.push(row);
  }

  return { rows, rowErrors };
}

function parseMatriculaRows(matrix, meta, headerIdx, headerRow, mapping) {
  const fileInfer = inferFromFileName(meta.sourceFile || '');
  const rows = [];
  const rowErrors = [];

  const optionalMissing = [];
  if (mapping.grupo == null && !fileInfer.grupoNumero) optionalMissing.push('grupo');
  if (mapping.materia == null && !fileInfer.codigoCurso) optionalMissing.push('materia (ATV-XXX)');
  if (optionalMissing.length) {
    rowErrors.push(`${meta.sourceFile || 'Archivo'}: sin columnas ${optionalMissing.join(', ')} — se usará el nombre del archivo si aplica.`);
  }

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const cells = matrix[i].map(cellStr);
    if (cells.every(c => !c)) continue;

    const get = field => (mapping[field] != null ? cells[mapping[field]] : '');

    const materia = get('materia');
    const codigoCurso = extractCourseCode(materia) || fileInfer.codigoCurso;
    const grupoNumero = parseGrupoNumero(get('grupo')) || fileInfer.grupoNumero || null;
    const nombreCompletoRaw = get('nombreCompleto') || `${get('nombrePila')} ${get('apellido')}`.trim();
    const nombreCompleto = toTitleCase(nombreCompletoRaw);
    const split = splitNombreCompleto(nombreCompleto);

    const row = {
      lineNum: i + 1,
      rowType: 'matricula',
      sourceFile: meta.sourceFile || '',
      sourceSheet: meta.sourceSheet || '',
      grupoNumero,
      grupoNombre: grupoNumero ? `Grupo ${grupoNumero}` : '',
      fechaIngreso: parseDateInput(get('fechaInicio')),
      fechaInicio: parseDateInput(get('fechaInicio')),
      nombreCompleto,
      nombre: split.nombre,
      apellido: split.apellido,
      documento: normalizeDocumento(get('documento')),
      telefono: cleanPhone(get('telcel'), get('telefono')),
      email: cleanEmail(get('email')),
      materia: materia || codigoCurso,
      codigoCurso,
      profesor: get('profesor'),
      horario: get('horario'),
      nota: parseNota(get('nota')),
      estadoImport: parseEstadoMatricula(get('estado')),
      estado: mapEstadoEstudiante(get('estado')),
      tipoMatricula: rowHasSuficiencia(cells) ? 'suficiencia' : 'normal',
      valid: true,
      errors: [],
    };

    row.errors = validateMatriculaRow(row, row.lineNum);
    row.valid = row.errors.length === 0;
    if (!row.valid) rowErrors.push(...row.errors);
    rows.push(row);
  }

  return { rows, rowErrors };
}

function parseDataRows(matrix, meta = {}) {
  if (!matrix || matrix.length < 2) {
    return { rows: [], errors: ['El archivo no tiene encabezados y datos.'], summary: {}, format: 'unknown' };
  }

  const headerIdx = findHeaderIndex(matrix);
  const headerRow = matrix[headerIdx].map(cellStr);
  const mapping = mapHeaders(headerRow);
  const format = detectImportFormat(headerRow, mapping);

  if (mapping.documento == null) {
    return {
      rows: [],
      errors: [`${meta.sourceFile || 'Archivo'}: no se encontró columna de identificación/cédula. Encabezados: ${headerRow.join(' | ')}`],
      summary: {},
      format,
      headerRow,
      mapping,
    };
  }

  let parsed;
  if (format === 'estudiantes') {
    parsed = parseEstudianteRows(matrix, meta, headerIdx, headerRow, mapping);
  } else {
    parsed = parseMatriculaRows(matrix, meta, headerIdx, headerRow, mapping);
  }

  return {
    rows: parsed.rows,
    errors: parsed.rowErrors,
    summary: buildSummary(parsed.rows),
    format,
    headerRow,
    mapping,
  };
}

function mergeParseResults(results) {
  const rows = [];
  const errors = [];
  const files = [];
  const formats = { estudiantes: 0, matricula: 0 };

  for (const r of results) {
    if (!r) continue;
    rows.push(...(r.rows || []));
    errors.push(...(r.errors || []));
    if (r.format === 'estudiantes') formats.estudiantes += r.rows?.length ?? 0;
    if (r.format === 'matricula') formats.matricula += r.rows?.length ?? 0;
    if (r.sourceFile) {
      files.push({
        name: r.sourceFile,
        format: r.format || 'mixto',
        sheets: r.sheetsParsed ?? 1,
        totalFilas: r.rows?.length ?? 0,
        filasValidas: r.rows?.filter(x => x.valid).length ?? 0,
      });
    }
  }

  const summary = buildSummary(rows);
  summary.formatos = {
    estudiantes: rows.filter(r => r.valid && r.rowType === 'estudiante').length,
    matricula: rows.filter(r => r.valid && r.rowType === 'matricula').length,
  };

  return { rows, errors, summary, files, formats };
}

export function parseCsvText(text, meta = {}) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const matrix = lines.map(line => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if ((ch === ',' || ch === ';') && !inQuotes) { result.push(cur); cur = ''; }
      else cur += ch;
    }
    result.push(cur);
    return result.map(c => c.replace(/^"|"$/g, '').trim());
  }).filter(row => row.some(c => c));
  return parseDataRows(matrix, meta);
}

function parseWorkbook(wb, sourceFile) {
  const merged = { rows: [], errors: [], sheetsParsed: 0, format: null };
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    if (!matrix?.length) continue;
    const parsed = parseDataRows(matrix, { sourceFile, sourceSheet: sheetName });
    merged.rows.push(...parsed.rows);
    merged.errors.push(...parsed.errors);
    merged.format = parsed.format || merged.format;
    merged.sheetsParsed++;
  }
  merged.summary = buildSummary(merged.rows);
  merged.sourceFile = sourceFile;
  return merged;
}

export async function parseImportFile(file) {
  const name = (file.name || '').toLowerCase();
  const sourceFile = file.name || 'archivo';

  if (name.endsWith('.csv')) {
    const text = await file.text();
    const parsed = parseCsvText(text, { sourceFile });
    parsed.files = [{ name: sourceFile, format: parsed.format, sheets: 1, totalFilas: parsed.rows?.length ?? 0, filasValidas: parsed.rows?.filter(r => r.valid).length ?? 0 }];
    return { ...parsed, sourceFile, sheetsParsed: 1 };
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    if (!window.XLSX) {
      return { rows: [], errors: ['La librería Excel no está cargada. Recarga la página.'], summary: {}, sourceFile };
    }
    const buffer = await file.arrayBuffer();
    const wb = window.XLSX.read(buffer, { type: 'array', cellDates: true });
    const parsed = parseWorkbook(wb, sourceFile);
    parsed.files = [{ name: sourceFile, format: parsed.format, sheets: parsed.sheetsParsed, totalFilas: parsed.rows.length, filasValidas: parsed.rows.filter(r => r.valid).length }];
    return parsed;
  }

  return { rows: [], errors: [`Formato no soportado: ${sourceFile}. Usa .xlsx, .xls o .csv`], summary: {}, sourceFile };
}

export async function parseImportFiles(files) {
  const list = [...files];
  if (!list.length) {
    return { rows: [], errors: ['No hay archivos seleccionados.'], summary: {}, files: [] };
  }
  const results = [];
  for (const file of list) results.push(await parseImportFile(file));
  return mergeParseResults(results);
}

export const TEMPLATE_CSV = `Grupo,Fecha de inicio,Nombre del estudiante,Identificación,Teléfono,Correo electrónico,Materia,Profesor,Horario,Nota Final,Estado
11,2026-06-04,Juan Carlos Pérez Mora,109012345,88887777,juan@email.com,ATV-001 Anatomía,Javier Artavia Cappella,Lunes - Martes 6pm - 10pm,85,APROBADO
11,2026-06-04,María José Jiménez Méndez,119570770,88886666,maria@email.com,ATV-001 Anatomía,Javier Artavia Cappella,Lunes - Martes 6pm - 10pm,66,REPROBADO
`;

export const TEMPLATE_ESTUDIANTES_CSV = `Grupo,identificacion,apellidos,nombre,nombrecompleto,nombrefacturacion,Email,email2,teldom,telcel,teltrab,Fecha Ingres,Fecha Nacimient,edad,Estado
11,119970751,ZUÑIGA GUTIERREZ,ABMER ALONSO,ABMER ALONSO ZUÑIGA GUTIERREZ,,alzu2008@gmail.com,NA,88009312,87142036,NA,24/4/2023,20/6/2007,21,Activo
11,119570770,JIMENEZ MENDEZ,MARIA JOSE,MARIA JOSE JIMENEZ MENDEZ,,maria@email.com,,88886666,88886666,,4/6/2026,15/3/2005,21,Activo
`;
