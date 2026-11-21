/**
 * Generación de PDFs institucionales (jsPDF + autoTable).
 * Requiere scripts en index.html: jspdf.umd + jspdf-autotable.
 */

const LOGO_PATH = 'assets/logo.png';
const LOGO_MAX_H = 18;
/** Carta US: 8.5 × 11 in → 215.9 × 279.4 mm */
const LETTER_FORMAT = [215.9, 279.4];
const PAGE_MARGIN = 14;

let logoCache = null;

function getJsPDF() {
  const lib = window.jspdf?.jsPDF || window.jsPDF;
  if (!lib) throw new Error('La librería jsPDF no está cargada. Recarga la página.');
  return lib;
}

/** Crea un documento jsPDF en tamaño carta (portrait o landscape). */
function createLetterPdf(orientation = 'portrait') {
  return new (getJsPDF())({
    orientation,
    unit: 'mm',
    format: LETTER_FORMAT,
  });
}

async function getInstituteLogo() {
  if (logoCache) return logoCache;

  const res = await fetch(LOGO_PATH);
  if (!res.ok) throw new Error('No se pudo cargar el logo institucional.');

  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const dims = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });

  const height = LOGO_MAX_H;
  const width = height * (dims.w / dims.h);
  logoCache = { dataUrl, width, height };
  return logoCache;
}

/** Encabezado con logo + título. Devuelve la coordenada Y para el contenido. */
async function instituteHeader(doc, title, subtitle = '') {
  const margin = PAGE_MARGIN;
  const pageW = doc.internal.pageSize.getWidth();
  const topY = 10;
  let textX = margin;
  let blockBottom = topY + 14;

  try {
    const logo = await getInstituteLogo();
    doc.addImage(logo.dataUrl, 'PNG', margin, topY, logo.width, logo.height);
    textX = margin + logo.width + 5;
    blockBottom = Math.max(blockBottom, topY + logo.height);
  } catch (err) {
    console.warn('Logo no disponible en PDF:', err);
  }

  let textY = topY + 5;
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text('Instituto Veterinario San Martín de Porres', textX, textY);
  textY += 6;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(title, textX, textY);
  textY += 5;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    const lines = doc.splitTextToSize(subtitle, pageW - textX - margin);
    doc.text(lines, textX, textY);
    textY += lines.length * 4;
    doc.setTextColor(0);
  }

  const lineY = Math.max(blockBottom, textY) + 3;
  doc.setDrawColor(29, 77, 143);
  doc.setLineWidth(0.4);
  doc.line(margin, lineY, pageW - margin, lineY);
  return lineY + 5;
}

function saveDoc(doc, filename) {
  doc.save(filename.replace(/[^\w\s.-áéíóúñÁÉÍÓÚÑ]/gi, '_'));
}

function tableOptions(startY, extra = {}) {
  return {
    startY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, top: PAGE_MARGIN },
    pageBreak: 'auto',
    showHead: 'everyPage',
    ...extra,
  };
}

/** 1. PDF asistencia / notas por mes */
export async function exportAsistenciaMesPdf({
  group, course, year, month, rows, fechasMes,
}) {
  const doc = createLetterPdf('landscape');
  const mesLabel = `${String(month).padStart(2, '0')}/${year}`;
  const startY = await instituteHeader(
    doc,
    'Registro de asistencia y notas',
    `${group?.nombre || `Grupo ${group?.numero || ''}`} · ${course?.codigo || ''} ${course?.nombre || ''} · ${mesLabel}`
  );

  const head = [
    ['#', 'Estudiante', 'Cédula', ...fechasMes.map(f => f.slice(8, 10) + '/' + f.slice(5, 7)), 'Nota', 'Estado'],
  ];
  const body = rows.map((r, i) => [
    i + 1,
    r.nombre,
    r.cedula,
    ...fechasMes.map(f => r.asistencia[f] || '—'),
    r.notaFinal !== null && r.notaFinal !== undefined ? String(r.notaFinal) : '—',
    r.estado || '—',
  ]);

  doc.autoTable(tableOptions(startY, {
    head,
    body,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [29, 77, 143], textColor: 255, fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 246, 243] },
  }));

  saveDoc(doc, `asistencia_${group?.numero || 'grupo'}_${course?.codigo || 'materia'}_${year}-${month}.pdf`);
}

/** 2. PDF historial académico por estudiante */
export async function exportHistorialEstudiantePdf({ student, rows, bloqueado }) {
  const doc = createLetterPdf('portrait');
  const nombre = `${student?.nombre || ''} ${student?.apellido || ''}`.trim();
  const startY = await instituteHeader(
    doc,
    'Historial académico del estudiante',
    `${nombre} · Cédula: ${student?.documento || '—'} · ${bloqueado ? 'CON CURSOS BLOQUEADOS' : 'Sin bloqueos actuales'}`
  );

  doc.autoTable(tableOptions(startY, {
    head: [['Código', 'Materia', 'Nota ord.', 'Nota extra.', 'Nota final', 'Estado', 'Bloqueado']],
    body: rows.map(r => [
      r.codigo,
      r.materia,
      r.notaOrdinaria ?? '—',
      r.notaExtra ?? '—',
      r.notaFinal ?? '—',
      r.estado || '—',
      r.bloqueado ? 'SÍ' : 'No',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 77, 143], textColor: 255 },
    columnStyles: {
      1: { cellWidth: 55 },
      6: { halign: 'center' },
    },
  }));

  saveDoc(doc, `historial_${student?.documento || student?.id || 'estudiante'}.pdf`);
}

/** 3. PDF historial académico de materia por grupo */
export async function exportHistorialMateriaGrupoPdf({ group, course, rows }) {
  const doc = createLetterPdf('landscape');
  const startY = await instituteHeader(
    doc,
    'Historial académico por materia y grupo',
    `${group?.nombre || `Grupo ${group?.numero}`} · ${course?.codigo} ${course?.nombre}`
  );

  doc.autoTable(tableOptions(startY, {
    head: [['#', 'Estudiante', 'Cédula', 'Nota ordinaria', 'Nota extraordinaria', 'Nota final', 'Resultado']],
    body: rows.map((r, i) => [
      i + 1,
      r.nombre,
      r.cedula,
      r.notaOrdinaria ?? '—',
      r.notaExtra ?? '—',
      r.notaFinal ?? '—',
      r.estado || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [29, 77, 143], textColor: 255 },
  }));

  saveDoc(doc, `historial_${course?.codigo || 'materia'}_grupo_${group?.numero || ''}.pdf`);
}
