const API_URL = 'https://api.hacienda.go.cr/fe/ae?identificacion=';

export function normalizeIdentificacion(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidIdentificacion(value) {
  const digits = normalizeIdentificacion(value);
  return digits.length >= 9 && digits.length <= 12;
}

function toTitleCase(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Separa el nombre completo devuelto por Hacienda en nombre(s) y apellido(s).
 * Para cédulas físicas viene como: NOMBRE(S) APELLIDO1 APELLIDO2.
 */
export function parseNombreContribuyente(nombreCompleto, tipoIdentificacion) {
  const full = (nombreCompleto || '').trim();
  if (!full) return { nombre: '', apellido: '' };

  const parts = full.split(/\s+/).map(toTitleCase);

  if (tipoIdentificacion === '02' || tipoIdentificacion === '04') {
    return { nombre: parts.join(' '), apellido: '' };
  }

  if (parts.length === 1) return { nombre: parts[0], apellido: '' };
  if (parts.length === 2) return { nombre: parts[0], apellido: parts[1] };

  return {
    nombre: parts.slice(0, -2).join(' ') || parts[0],
    apellido: parts.slice(-2).join(' '),
  };
}

export async function lookupContribuyente(identificacion) {
  const id = normalizeIdentificacion(identificacion);
  if (!isValidIdentificacion(id)) {
    throw new Error('La cédula debe tener entre 9 y 12 dígitos.');
  }

  const res = await fetch(`${API_URL}${encodeURIComponent(id)}`);

  if (res.status === 404) {
    throw new Error('No se encontró contribuyente con esa cédula.');
  }
  if (res.status === 429) {
    throw new Error('Demasiadas consultas. Espere unos minutos e intente de nuevo.');
  }
  if (!res.ok) {
    throw new Error('No se pudo consultar la información en Hacienda.');
  }

  const data = await res.json();
  if (!data?.nombre) {
    throw new Error('No se encontró información para esta cédula.');
  }

  return data;
}
