export function formatVolumePTBR(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
}

export function parseFlexibleNumber(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (raw === null || raw === undefined) return null;

  let text = String(raw).trim();
  if (!text) return null;

  // Remove unit suffixes such as "L", "litros", whitespace
  text = text.replace(/\s*(litros|litro|l)\s*$/i, '').trim();
  // Remove spaces inside numbers
  text = text.replace(/\s+/g, '');

  // Keep only digits, comma, dot, minus
  const cleaned = text.replace(/[^0-9,.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;
  if (lastComma !== -1 && lastDot !== -1) {
    // Both exist: whichever comes last is decimal separator
    if (lastComma > lastDot) {
      // PT-BR: 1.495.322,90
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // EN: 1,495,322.90
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only comma: check if it looks like thousands separator (e.g. 1,691,160) vs decimal (435,00)
    const parts = cleaned.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && parts[0] !== '0')) {
      // Ambiguous like 1,691,160 -> thousands; whereas 435,00 -> 2 digits -> decimal
      if (parts.length > 2) {
        normalized = cleaned.replace(/,/g, '');
      } else {
        normalized = cleaned.replace(',', '.');
      }
    } else {
      normalized = cleaned.replace(',', '.');
    }
  } else if (lastDot !== -1) {
    const parts = cleaned.split('.');
    // If multiple dots like 1.495.322 -> thousands separators
    if (parts.length > 2) {
      normalized = cleaned.replace(/\./g, '');
    } else if (parts.length === 2 && parts[1].length === 3 && parts[0].replace('-', '').length <= 3) {
      // e.g., 1.495 or 435.000 -> in PT-BR spreadsheets 3 digits after single dot is usually thousands separator if >= 1000
      // Wait: what about 2.5? parts[1].length === 1 -> decimal. What about 12.345? Usually thousands in PT-BR if integer > 0, let's check:
      // Actually if someone exports raw numbers, JS numbers are already `typeof raw === 'number'`. Strings with `.xxx` where xxx=3 digits in PT-BR are thousands!
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDurationToMinutes(
  raw: unknown,
  unitHint: 'hours' | 'minutes' | 'auto' = 'auto'
): number | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.getHours() * 60 + raw.getMinutes() + raw.getSeconds() / 60;
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 0) return null;
    if (unitHint === 'minutes') {
      return raw;
    }
    if (unitHint === 'hours') {
      return raw * 60;
    }
    // Auto: Excel time serials are typically between 0 and 1 (fraction of a 24h day)
    // Wait: 0.5 could be 12:00 (half day) or 0.5h (30min). In Excel "(h)" columns, 0.67 is 40min (0.6667h)!
    // Let's treat numbers <= 24 as hours by default unless unitHint === 'minutes'
    return raw * 60;
  }

  const text = String(raw).trim().toLowerCase();
  if (!text) return null;

  // Pattern: "2h30min", "2h 30m", "2h", "40min", "40 m"
  const hMatch = text.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const minMatch = text.match(/(\d+(?:[.,]\d+)?)\s*min|(\d+(?:[.,]\d+)?)\s*m(?![a-z])/);
  if (hMatch || minMatch) {
    const hours = hMatch ? Number(hMatch[1].replace(',', '.')) : 0;
    const minsRaw = minMatch ? (minMatch[1] ?? minMatch[2]) : '0';
    const mins = Number(minsRaw.replace(',', '.'));
    if (Number.isFinite(hours) && Number.isFinite(mins)) {
      return hours * 60 + mins;
    }
  }

  // Pattern: "HH:MM" or "HH:MM:SS"
  const colonMatch = text.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colonMatch) {
    const hours = Number(colonMatch[1]);
    const mins = Number(colonMatch[2]);
    const secs = colonMatch[3] ? Number(colonMatch[3]) : 0;
    return hours * 60 + mins + secs / 60;
  }

  // Plain numeric string
  const num = parseFlexibleNumber(text);
  if (num !== null) {
    return unitHint === 'minutes' ? num : num * 60;
  }

  return null;
}

export function formatMinutesToReportDuration(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0min';
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;

  if (hours === 0) {
    return `${mins}min`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
  return `${hours}h${minsStr}min`;
}

export type TimeSlaLevel = 'green' | 'yellow' | 'red';

export interface TimeSlaStatus {
  level: TimeSlaLevel;
  label: string;
}

export function getTimeSlaStatus(totalMinutes: number): TimeSlaStatus {
  const rounded =
    Number.isFinite(totalMinutes) && totalMinutes > 0 ? Math.round(totalMinutes) : 0;

  if (rounded > 90) {
    return { level: 'red', label: 'Maior que 1h30min' };
  }
  if (rounded > 60) {
    return { level: 'yellow', label: 'Maior que 1h00min' };
  }
  return { level: 'green', label: 'Menor que 1h00min' };
}

export function parseFlexibleDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const d = String(raw.getUTCDate()).padStart(2, '0');
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const y = raw.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 90000) {
    // Excel serial date (days since 1899-12-30)
    const utcDays = Math.floor(raw - 25569);
    const utcMs = utcDays * 86400 * 1000;
    const date = new Date(utcMs);
    const d = String(date.getUTCDate()).padStart(2, '0');
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const y = date.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }

  const text = String(raw).trim();
  if (!text) return '';

  // ISO format YYYY-MM-DD (with optional time)
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (brMatch) {
    const [, d, m, yRaw] = brMatch;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  return text;
}

export function normalizeTextKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function brDateToIso(brDate: string): string {
  const match = brDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

export function isoToBrDate(isoDate: string): string {
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

export type ParsedTimestamp =
  | { kind: 'datetime'; totalMinutes: number }
  | { kind: 'timeOfDay'; minutesOfDay: number };

function to24Hour(hh: number, ampm?: string): number {
  if (!ampm) return hh;
  const upper = ampm.toUpperCase();
  if (upper === 'AM') return hh === 12 ? 0 : hh;
  if (upper === 'PM') return hh === 12 ? 12 : hh + 12;
  return hh;
}

export function parseSpreadsheetTimestamp(raw: unknown): ParsedTimestamp | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    if (raw.getFullYear() > 1904) {
      return { kind: 'datetime', totalMinutes: raw.getTime() / 60000 };
    }
    return {
      kind: 'timeOfDay',
      minutesOfDay: raw.getHours() * 60 + raw.getMinutes() + raw.getSeconds() / 60,
    };
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw >= 0 && raw < 1) {
      return { kind: 'timeOfDay', minutesOfDay: raw * 24 * 60 };
    }
    if (raw === 1) {
      return { kind: 'timeOfDay', minutesOfDay: 24 * 60 };
    }
    // Excel time cells exported with 1900-01-01 / 1900-01-02 base date (1 < serial < 20000 with fractional time)
    if (raw > 1 && raw < 20000 && Math.abs(raw - Math.round(raw)) > 1e-7) {
      return { kind: 'timeOfDay', minutesOfDay: (raw % 1) * 24 * 60 };
    }
    if (raw >= 20000 && raw < 90000) {
      return { kind: 'datetime', totalMinutes: (raw - 25569) * 24 * 60 };
    }
    return null;
  }

  const text = String(raw).trim();
  if (!text) return null;

  // Numeric string representing an Excel serial (e.g. "0.3541667" or "45583.3541667")
  if (/^\d+(?:[.,]\d+)?$/.test(text)) {
    const num = Number(text.replace(',', '.'));
    if (Number.isFinite(num)) {
      if (num >= 0 && num < 1) {
        return { kind: 'timeOfDay', minutesOfDay: num * 24 * 60 };
      }
      if (num > 1 && num < 20000 && Math.abs(num - Math.round(num)) > 1e-7) {
        return { kind: 'timeOfDay', minutesOfDay: (num % 1) * 24 * 60 };
      }
      if (num >= 20000 && num < 90000) {
        return { kind: 'datetime', totalMinutes: (num - 25569) * 24 * 60 };
      }
    }
    return null;
  }

  // BR datetime: DD/MM/YYYY[ -às ]HH:MM(:SS)?(.sss)?( AM|PM)?
  const brDt = text.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s*(?:[-–]|às|as)?\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?(?:\s*(AM|PM))?(?:\s*h(?:s|rs?)?)?$/i
  );
  if (brDt) {
    const d = Number(brDt[1]);
    const m = Number(brDt[2]);
    const yRaw = brDt[3];
    const y = Number(yRaw.length === 2 ? `20${yRaw}` : yRaw);
    const hh = to24Hour(Number(brDt[4]), brDt[7]);
    const mm = Number(brDt[5]);
    const ss = brDt[6] ? Number(brDt[6]) : 0;
    const ms = Date.UTC(y, m - 1, d, hh, mm, ss);
    return { kind: 'datetime', totalMinutes: ms / 60000 };
  }

  // ISO datetime: YYYY-MM-DD[T ]HH:MM(:SS)?(.sss)?(Z|[+-]HH:MM)?
  const isoDt = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?(?:\s*(AM|PM))?/i
  );
  if (isoDt) {
    const y = Number(isoDt[1]);
    const m = Number(isoDt[2]);
    const d = Number(isoDt[3]);
    const hh = to24Hour(Number(isoDt[4]), isoDt[7]);
    const mm = Number(isoDt[5]);
    const ss = isoDt[6] ? Number(isoDt[6]) : 0;
    const ms = Date.UTC(y, m - 1, d, hh, mm, ss);
    return { kind: 'datetime', totalMinutes: ms / 60000 };
  }

  // Time-of-day: HH:MM(:SS)?(.sss)?( AM|PM)?(h/hs)?
  const colonTime = text.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?(?:\s*(AM|PM))?(?:\s*(?:h(?:s|rs?)?|min))?$/i
  );
  if (colonTime) {
    const hhRaw = Number(colonTime[1]);
    const mm = Number(colonTime[2]);
    const ss = colonTime[3] ? Number(colonTime[3]) : 0;
    const ampm = colonTime[4];
    const hh = to24Hour(hhRaw, ampm);
    if (hh === 24 && mm === 0 && ss === 0) {
      return { kind: 'timeOfDay', minutesOfDay: 24 * 60 };
    }
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return { kind: 'timeOfDay', minutesOfDay: hh * 60 + mm + ss / 60 };
    }
  }

  // Time-of-day: "08h30", "08h30min", "8h"
  const hTime = text.toLowerCase().match(/^(\d{1,2})\s*h(?:\s*(\d{1,2})(?:\s*min|m)?)?$/);
  if (hTime) {
    const hh = Number(hTime[1]);
    const mm = hTime[2] ? Number(hTime[2]) : 0;
    if (hh === 24 && mm === 0) {
      return { kind: 'timeOfDay', minutesOfDay: 24 * 60 };
    }
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return { kind: 'timeOfDay', minutesOfDay: hh * 60 + mm };
    }
  }

  return null;
}

export function computeElapsedMinutes(startRaw: unknown, endRaw: unknown): number | null {
  const start = parseSpreadsheetTimestamp(startRaw);
  const end = parseSpreadsheetTimestamp(endRaw);
  if (!start || !end) return null;

  if (start.kind === 'datetime' && end.kind === 'datetime') {
    const diff = end.totalMinutes - start.totalMinutes;
    // Only trust full datetime delta when both timestamps are within a reasonable 30-day window
    // (guards against one column having a dummy epoch base date like 1970-01-01)
    if (Math.abs(diff) <= 30 * 24 * 60) {
      if (diff >= 0) return diff;
      // Same-date overnight Turno C crossing midnight (e.g. 18/10 23:00 -> 18/10 01:15)
      if (diff <= -600 && diff > -1440) return diff + 1440;
      return null;
    }
  }

  const startMin =
    start.kind === 'timeOfDay'
      ? start.minutesOfDay
      : ((start.totalMinutes % 1440) + 1440) % 1440;
  const endMin =
    end.kind === 'timeOfDay'
      ? end.minutesOfDay
      : ((end.totalMinutes % 1440) + 1440) % 1440;

  const diff = endMin - startMin;
  if (diff >= 0) return diff;
  // Midnight crossing (e.g. 23:30 -> 01:15 gives diff = -1335)
  if (diff <= -600) return diff + 1440;
  return null;
}
