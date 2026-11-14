import * as XLSX from 'xlsx';
import {
  DEFAULT_REPORT_DATA,
  FALLBACK_SHIFT_COLORS,
  SHIFT_COLORS,
} from '../data/defaultReport';
import type {
  ColumnMapping,
  DeliveryRecord,
  ImportedDataset,
  OperationVolume,
  ReportData,
  ReportFilters,
  ShiftVolume,
} from '../types/report';
import {
  brDateToIso,
  computeElapsedMinutes,
  isoToBrDate,
  normalizeTextKey,
  parseDurationToMinutes,
  parseFlexibleDate,
  parseFlexibleNumber,
  parseSpreadsheetTimestamp,
} from './formatters';

const HEADER_ALIASES: Record<keyof ColumnMapping, string[]> = {
  data: ['data', 'dt', 'dia', 'date', 'data entrega', 'data operacao'],
  turno: ['turno', 'shift', 'periodo', 'tur'],
  frente: ['frente', 'frente de trabalho', 'frente trabalho', 'equipe', 'setor', 'fazenda'],
  operacao: [
    'operacao',
    'operacoes',
    'atividade',
    'modalidade',
    'servico',
    'aplicacao',
    'tipo',
    'categoria',
    'descricao',
  ],
  volume: [
    'volume',
    'volume l',
    'volume calda',
    'volume entregue',
    'volume de calda',
    'calda',
    'calda l',
    'litros',
    'l',
    'quantidade',
    'qtd',
    'entrega',
  ],
  horaSolicitacao: [
    'hora de solicitacao',
    'hora solicitacao',
    'hora da solicitacao',
    'hora solicita',
    'hr solicita',
    'horario solicita',
    'horario de solicitacao',
    'horario solicitacao',
    'horario da solicitacao',
    'hr solicitacao',
    'hr de solicitacao',
    'data hora solicitacao',
    'data e hora solicitacao',
    'dt hr solicitacao',
    'hora solicit',
    'hr solicit',
    'inicio solicitacao',
    'solicita',
    'solicitacao',
  ],
  horaTransferencia: [
    'hora transferencia',
    'hora da transferencia',
    'hora de transferencia',
    'horario transferencia',
    'horario da transferencia',
    'horario de transferencia',
    'hr transferencia',
    'hr da transferencia',
    'data hora transferencia',
    'data e hora transferencia',
    'dt hr transferencia',
    'hora transf',
    'hr transf',
    'transf',
    'transferencia',
  ],
  horaFimDosagem: [
    'hora fim dosagem',
    'hora fim da dosagem',
    'hora fim de dosagem',
    'horario fim dosagem',
    'horario fim da dosagem',
    'hora final dosagem',
    'hora termino dosagem',
    'fim dosagem',
    'fim da dosagem',
    'fim de dosagem',
    'hr fim dosagem',
    'hora dosagem',
    'fim dosag',
    'hora fim dos',
    'fim preparo',
  ],
  tempoTransferencia: [
    'tempo transferencia',
    'media transferencia',
    'transferencia h',
    'tempo transf',
    't transferencia',
    'transferencia',
  ],
  tempoPreparo: [
    'tempo preparo',
    'media preparo',
    'preparo h',
    'tempo preparo calda',
    't preparo',
    'preparo',
  ],
};

function matchesAlias(header: string, aliases: string[]): number {
  const norm = normalizeTextKey(header);
  if (!norm) return 0;
  let best = 0;
  for (let i = 0; i < aliases.length; i++) {
    const alias = aliases[i];
    // Earlier aliases are more specific; break ties in their favor
    const specificityBonus = ((aliases.length - i) / aliases.length) * 0.5;
    let score = 0;
    if (norm === alias) score = 3 + specificityBonus;
    else if (norm.startsWith(alias + ' ') || norm.endsWith(' ' + alias)) score = 2 + specificityBonus;
    else if (norm.includes(alias)) score = 1 + specificityBonus;
    if (score > best) best = score;
  }
  return best;
}

function hasParseableTimestamps(
  header: string,
  sampleRows?: Record<string, unknown>[]
): boolean | null {
  if (!sampleRows || sampleRows.length === 0) return null;
  let nonEmpty = 0;
  let valid = 0;
  const limit = Math.min(sampleRows.length, 25);
  for (let i = 0; i < limit; i++) {
    const val = sampleRows[i][header];
    if (val === null || val === undefined || String(val).trim() === '') continue;
    nonEmpty++;
    if (parseSpreadsheetTimestamp(val) !== null) valid++;
  }
  if (nonEmpty === 0) return null;
  return valid > 0;
}

function isDurationHeader(header: string): boolean {
  const norm = normalizeTextKey(header);
  return (
    norm.startsWith('tempo ') ||
    norm.includes(' tempo ') ||
    norm.startsWith('media ') ||
    norm.includes('duracao') ||
    norm.endsWith(' min') ||
    norm.endsWith(' h')
  );
}

export function autoDetectColumnMapping(
  headers: string[],
  sampleRows?: Record<string, unknown>[]
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();

  const timestampFields = new Set<keyof ColumnMapping>([
    'horaSolicitacao',
    'horaTransferencia',
    'horaFimDosagem',
  ]);

  const fields: (keyof ColumnMapping)[] = [
    'volume',
    'horaSolicitacao',
    'horaTransferencia',
    'horaFimDosagem',
    'frente',
    'turno',
    'data',
    'tempoTransferencia',
    'tempoPreparo',
    'operacao',
  ];

  for (const field of fields) {
    let bestHeader: string | undefined;
    let bestScore = 0;

    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      if (timestampFields.has(field) && isDurationHeader(header)) continue;

      let score = matchesAlias(header, HEADER_ALIASES[field]);
      if (score <= 0) continue;

      if (timestampFields.has(field)) {
        const validTs = hasParseableTimestamps(header, sampleRows);
        if (validTs === true) score += 2;
        else if (validTs === false) score -= 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestHeader = header;
      }
    }

    if (bestHeader && bestScore > 0) {
      mapping[field] = bestHeader;
      usedHeaders.add(bestHeader);
    }
  }

  // If a sheet only has a bare "TRANSFERENCIA" column without any solicitation or dosing end column
  // (e.g., pre-computed duration strings), treat it as tempoTransferencia unless the header says hora/hr/horario.
  if (
    mapping.horaTransferencia &&
    !mapping.horaSolicitacao &&
    !mapping.horaFimDosagem &&
    !mapping.tempoTransferencia
  ) {
    const normTransf = normalizeTextKey(mapping.horaTransferencia);
    if (
      !normTransf.includes('hora') &&
      !normTransf.includes('hr') &&
      !normTransf.includes('horario')
    ) {
      mapping.tempoTransferencia = mapping.horaTransferencia;
      delete mapping.horaTransferencia;
    }
  }

  return mapping;
}

export function normalizeShiftName(raw: unknown): string {
  const text = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!text) return 'SEM TURNO';
  if (text === 'A' || text === '1' || text === 'TURNO 1') return 'TURNO A';
  if (text === 'B' || text === '2' || text === 'TURNO 2') return 'TURNO B';
  if (text === 'C' || text === '3' || text === 'TURNO 3') return 'TURNO C';
  return text;
}

function detectDurationUnitHint(headerName?: string): 'hours' | 'minutes' | 'auto' {
  if (!headerName) return 'auto';
  const norm = normalizeTextKey(headerName);
  if (norm.includes('min') || norm.includes('minuto')) return 'minutes';
  if (norm.includes('h') || norm.includes('hora')) return 'hours';
  return 'auto';
}

export function extractRecordsFromRows(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping
): DeliveryRecord[] {
  const transfHint = detectDurationUnitHint(mapping.tempoTransferencia);
  const prepHint = detectDurationUnitHint(mapping.tempoPreparo);

  const records: DeliveryRecord[] = [];

  for (const row of rawRows) {
    const volRaw = mapping.volume ? row[mapping.volume] : undefined;
    const volume = parseFlexibleNumber(volRaw);

    const operacaoRaw = mapping.operacao ? String(row[mapping.operacao] ?? '').trim() : '';
    const turnoRaw = mapping.turno ? String(row[mapping.turno] ?? '').trim() : '';
    const frenteRawText = mapping.frente ? String(row[mapping.frente] ?? '').trim() : '';

    // Skip totals or blank rows
    const opNorm = normalizeTextKey(operacaoRaw);
    const turnoNorm = normalizeTextKey(turnoRaw);
    const frenteNorm = normalizeTextKey(frenteRawText);
    if (
      opNorm === 'total' ||
      opNorm === 'total geral' ||
      turnoNorm === 'total' ||
      turnoNorm === 'total geral' ||
      frenteNorm === 'total' ||
      frenteNorm === 'total geral'
    ) {
      continue;
    }

    const calculatedTransferencia =
      mapping.horaSolicitacao && mapping.horaTransferencia
        ? computeElapsedMinutes(row[mapping.horaSolicitacao], row[mapping.horaTransferencia])
        : null;
    const tempoTransferenciaMin =
      calculatedTransferencia !== null
        ? calculatedTransferencia
        : mapping.tempoTransferencia
        ? parseDurationToMinutes(row[mapping.tempoTransferencia], transfHint)
        : null;

    const calculatedPreparo =
      mapping.horaTransferencia && mapping.horaFimDosagem
        ? computeElapsedMinutes(row[mapping.horaTransferencia], row[mapping.horaFimDosagem])
        : null;
    const tempoPreparoMin =
      calculatedPreparo !== null
        ? calculatedPreparo
        : mapping.tempoPreparo
        ? parseDurationToMinutes(row[mapping.tempoPreparo], prepHint)
        : null;

    if (volume === null && tempoTransferenciaMin === null && tempoPreparoMin === null) {
      continue;
    }

    const data = mapping.data ? parseFlexibleDate(row[mapping.data]) : '';
    const turno = mapping.turno ? normalizeShiftName(row[mapping.turno]) : 'TURNO A';
    const frente = mapping.frente
      ? frenteRawText.toUpperCase() || 'SEM FRENTE'
      : 'GERAL';
    const operacao = operacaoRaw ? operacaoRaw.toUpperCase() : 'OUTROS';

    records.push({
      data,
      turno,
      frente,
      operacao,
      volume: volume ?? 0,
      tempoTransferenciaMin,
      tempoPreparoMin,
    });
  }

  return records;
}

function getShiftSortWeight(name: string): number {
  if (name === 'TURNO A') return 1;
  if (name === 'TURNO B') return 2;
  if (name === 'TURNO C') return 3;
  return 10;
}

export function aggregateRecordsToReport(
  records: DeliveryRecord[],
  filters: ReportFilters,
  title = DEFAULT_REPORT_DATA.title
): ReportData {
  const normalizedRange = (() => {
    const s = filters.dataStart.trim();
    const e = filters.dataEnd.trim();
    if (s && e && s > e) return { start: e, end: s };
    return { start: s, end: e };
  })();

  const filtered = records.filter((rec) => {
    if (normalizedRange.start || normalizedRange.end) {
      const recIso = brDateToIso(rec.data);
      if (!recIso) return false;
      if (normalizedRange.start && recIso < normalizedRange.start) return false;
      if (normalizedRange.end && recIso > normalizedRange.end) return false;
    }
    if (filters.turno !== 'TODOS' && rec.turno !== filters.turno) {
      return false;
    }
    if (filters.frente !== 'TODOS' && rec.frente !== filters.frente) {
      return false;
    }
    return true;
  });

  const shiftMap = new Map<string, number>();
  const opMap = new Map<string, number>();
  let totalDia = 0;

  let transfSum = 0;
  let transfCount = 0;
  let prepSum = 0;
  let prepCount = 0;

  for (const rec of filtered) {
    totalDia += rec.volume;
    shiftMap.set(rec.turno, (shiftMap.get(rec.turno) ?? 0) + rec.volume);
    const barCategory = rec.frente && rec.frente !== 'GERAL' ? rec.frente : rec.operacao;
    if (barCategory && barCategory !== 'RESUMO') {
      opMap.set(barCategory, (opMap.get(barCategory) ?? 0) + rec.volume);
    }

    if (rec.tempoTransferenciaMin !== null && Number.isFinite(rec.tempoTransferenciaMin)) {
      transfSum += rec.tempoTransferenciaMin;
      transfCount += 1;
    }
    if (rec.tempoPreparoMin !== null && Number.isFinite(rec.tempoPreparoMin)) {
      prepSum += rec.tempoPreparoMin;
      prepCount += 1;
    }
  }

  const turnos: ShiftVolume[] = Array.from(shiftMap.entries())
    .sort((a, b) => {
      const wa = getShiftSortWeight(a[0]);
      const wb = getShiftSortWeight(b[0]);
      if (wa !== wb) return wa - wb;
      return a[0].localeCompare(b[0]);
    })
    .map(([name, volume], index) => ({
      name,
      volume,
      color: SHIFT_COLORS[name] ?? FALLBACK_SHIFT_COLORS[index % FALLBACK_SHIFT_COLORS.length],
    }));

  const operacoes: OperationVolume[] = Array.from(opMap.entries())
    .map(([name, volume]) => ({ name, volume }))
    .sort((a, b) => b.volume - a.volume);

  const uniqueDates = Array.from(new Set(filtered.map((r) => r.data).filter(Boolean))).sort(
    (a, b) => brDateToIso(a).localeCompare(brDateToIso(b))
  );

  let displayDate = '';
  if (normalizedRange.start && normalizedRange.end) {
    displayDate =
      normalizedRange.start === normalizedRange.end
        ? isoToBrDate(normalizedRange.start)
        : `${isoToBrDate(normalizedRange.start)} – ${isoToBrDate(normalizedRange.end)}`;
  } else if (normalizedRange.start) {
    displayDate = `A partir de ${isoToBrDate(normalizedRange.start)}`;
  } else if (normalizedRange.end) {
    displayDate = `Até ${isoToBrDate(normalizedRange.end)}`;
  }

  if (!displayDate) {
    if (uniqueDates.length === 1) {
      displayDate = uniqueDates[0];
    } else if (uniqueDates.length > 1) {
      displayDate = `${uniqueDates[0]} – ${uniqueDates[uniqueDates.length - 1]}`;
    } else {
      displayDate = DEFAULT_REPORT_DATA.data;
    }
  }

  return {
    title,
    data: displayDate,
    turno: filters.turno || 'TODOS',
    frente: filters.frente || 'TODOS',
    totalDia,
    turnos,
    mediaTransferenciaMin: transfCount > 0 ? transfSum / transfCount : 0,
    mediaPreparoMin: prepCount > 0 ? prepSum / prepCount : 0,
    operacoes,
  };
}

export function getFilterOptionsFromRecords(records: DeliveryRecord[]): {
  datas: string[];
  turnos: string[];
  frentes: string[];
} {
  const datas = Array.from(new Set(records.map((r) => r.data).filter(Boolean))).sort((a, b) =>
    brDateToIso(a).localeCompare(brDateToIso(b))
  );
  const turnos = Array.from(new Set(records.map((r) => r.turno).filter(Boolean))).sort((a, b) => {
    const wa = getShiftSortWeight(a);
    const wb = getShiftSortWeight(b);
    return wa !== wb ? wa - wb : a.localeCompare(b);
  });
  const frentes = Array.from(new Set(records.map((r) => r.frente).filter(Boolean))).sort();
  return { datas, turnos, frentes };
}

function findHeaderRowIndex(matrix: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  const allAliases = Object.values(HEADER_ALIASES).flat();

  const limit = Math.min(matrix.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    let score = 0;
    let nonEmpty = 0;
    for (const cell of row) {
      const text = String(cell ?? '').trim();
      if (!text) continue;
      nonEmpty++;
      const norm = normalizeTextKey(text);
      if (allAliases.some((a) => norm === a || norm.includes(a))) {
        score += 3;
      }
    }
    const totalScore = score * 10 + nonEmpty;
    if (nonEmpty >= 2 && totalScore > bestScore) {
      bestScore = totalScore;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function tryParseSummaryMatrix(matrix: unknown[][]): ReportData | null {
  let data = '';
  let turno = 'TODOS';
  let frente = 'TODOS';
  let totalDia: number | null = null;
  let mediaTransferenciaMin: number | null = null;
  let mediaPreparoMin: number | null = null;
  const turnoMap = new Map<string, number>();
  const operacoes: OperationVolume[] = [];

  for (const row of matrix) {
    if (!row || row.length < 2) continue;
    const cells = row.map((c) => String(c ?? '').trim());
    // Look for label -> value pairs across the row (supports 2-column or multi-column summary sheets)
    for (let c = 0; c < cells.length - 1; c++) {
      const label = cells[c];
      if (!label) continue;
      const valRaw = row[c + 1];
      const valText = cells[c + 1];
      if (valRaw === undefined || valRaw === null || valText === '') continue;

      const norm = normalizeTextKey(label);

      if (norm === 'data' || norm === 'data referencia') {
        data = parseFlexibleDate(valRaw);
      } else if (norm === 'turno' && !/^[0-9.,]+$/.test(valText)) {
        turno = valText.toUpperCase();
      } else if (norm === 'frente' && !/^[0-9.,]+$/.test(valText)) {
        frente = valText.toUpperCase();
      } else if (
        norm === 'total periodo' ||
        norm === 'total do periodo' ||
        norm === 'total dia' ||
        norm === 'total do dia' ||
        norm === 'total geral'
      ) {
        const num = parseFlexibleNumber(valRaw);
        if (num !== null) totalDia = num;
      } else if (
        norm === 'media transferencia' ||
        norm === 'media transferencia h' ||
        norm === 'tempo transferencia'
      ) {
        const mins = parseDurationToMinutes(valRaw, norm.includes('min') ? 'minutes' : 'auto');
        if (mins !== null) mediaTransferenciaMin = mins;
      } else if (
        norm === 'media preparo' ||
        norm === 'media preparo h' ||
        norm === 'tempo preparo'
      ) {
        const mins = parseDurationToMinutes(valRaw, norm.includes('min') ? 'minutes' : 'auto');
        if (mins !== null) mediaPreparoMin = mins;
      } else if (/^turno\s+[a-z0-9]+$/i.test(norm)) {
        const num = parseFlexibleNumber(valRaw);
        if (num !== null) {
          turnoMap.set(label.toUpperCase(), num);
        }
      } else {
        // Check if this is an operation row in a summary/operations table
        const num = parseFlexibleNumber(valRaw);
        if (
          num !== null &&
          norm !== 'valor' &&
          norm !== 'volume' &&
          norm !== 'volume l' &&
          norm !== 'indicador' &&
          !norm.includes('entrega por turno') &&
          !norm.includes('tempo preparo') &&
          !norm.includes('volume de calda')
        ) {
          operacoes.push({ name: label.toUpperCase(), volume: num });
        }
      }
    }
  }

  if (turnoMap.size === 0 && operacoes.length === 0 && totalDia === null) {
    return null;
  }

  const turnos: ShiftVolume[] = Array.from(turnoMap.entries())
    .sort((a, b) => getShiftSortWeight(a[0]) - getShiftSortWeight(b[0]))
    .map(([name, volume], index) => ({
      name,
      volume,
      color: SHIFT_COLORS[name] ?? FALLBACK_SHIFT_COLORS[index % FALLBACK_SHIFT_COLORS.length],
    }));

  const computedTotal =
    totalDia !== null
      ? totalDia
      : turnos.length > 0
      ? turnos.reduce((acc, s) => acc + s.volume, 0)
      : operacoes.reduce((acc, o) => acc + o.volume, 0);

  return {
    title: DEFAULT_REPORT_DATA.title,
    data: data || DEFAULT_REPORT_DATA.data,
    turno,
    frente,
    totalDia: computedTotal,
    turnos: turnos.length > 0 ? turnos : DEFAULT_REPORT_DATA.turnos,
    mediaTransferenciaMin: mediaTransferenciaMin ?? 0,
    mediaPreparoMin: mediaPreparoMin ?? 0,
    operacoes: operacoes.sort((a, b) => b.volume - a.volume),
  };
}

export function matrixToRawObjects(matrix: unknown[][]): {
  headers: string[];
  rows: Record<string, unknown>[];
} {
  if (matrix.length === 0) return { headers: [], rows: [] };

  const headerIdx = findHeaderRowIndex(matrix);
  const headerRow = matrix[headerIdx] ?? [];

  const headers: string[] = [];
  const colIndexes: number[] = [];
  const seen = new Map<string, number>();

  headerRow.forEach((cell, idx) => {
    const rawName = String(cell ?? '').trim();
    if (!rawName) return;
    const count = seen.get(rawName) ?? 0;
    seen.set(rawName, count + 1);
    const uniqueName = count === 0 ? rawName : `${rawName} (${count + 1})`;
    headers.push(uniqueName);
    colIndexes.push(idx);
  });

  const rows: Record<string, unknown>[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const rawRow = matrix[r];
    if (!rawRow || rawRow.every((c) => c === null || c === undefined || String(c).trim() === '')) {
      continue;
    }
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = rawRow[colIndexes[i]];
    });
    rows.push(obj);
  }

  return { headers, rows };
}

function isLikelySummaryMatrix(
  matrix: unknown[][],
  sheetName: string,
  headers: string[],
  mapping: ColumnMapping
): boolean {
  const sheetNorm = normalizeTextKey(sheetName);
  if (sheetNorm.includes('resumo')) return true;

  // If the sheet clearly has a multi-column operational table header (e.g. DATA, TURNO, FRENTE, VOLUME),
  // it is a tabular dataset, NOT a summary sheet.
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  if (
    headers.length >= 3 &&
    mappedCount >= 3 &&
    mapping.volume &&
    (mapping.frente || mapping.operacao || mapping.turno)
  ) {
    return false;
  }

  let summaryHits = 0;
  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const row = matrix[i] ?? [];
    const norm = normalizeTextKey(String(row[0] ?? ''));
    if (
      norm === 'indicador' ||
      norm === 'total periodo' ||
      norm === 'total do periodo' ||
      norm === 'total dia' ||
      norm === 'total do dia' ||
      norm === 'media transferencia' ||
      norm === 'media preparo' ||
      /^turno\s+[abc]$/i.test(norm)
    ) {
      summaryHits++;
    }
  }
  return summaryHits >= 2;
}

export function parseWorkbookArrayBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  preferredSheet?: string
): ImportedDataset {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = workbook.SheetNames;

  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('A planilha enviada não possui abas válidas.');
  }

  const targetSheet =
    preferredSheet && sheetNames.includes(preferredSheet) ? preferredSheet : sheetNames[0];

  const sheet = workbook.Sheets[targetSheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  const { headers, rows } = matrixToRawObjects(matrix);
  const mapping = autoDetectColumnMapping(headers, rows);

  // Check if the sheet is explicitly a Summary / Key-Value layout (like Resumo_Direto)
  if (isLikelySummaryMatrix(matrix, targetSheet, headers, mapping)) {
    const summaryReport = tryParseSummaryMatrix(matrix);
    if (summaryReport) {
      if (summaryReport.operacoes.length === 0 && sheetNames.length > 1) {
        for (const otherName of sheetNames) {
          if (otherName === targetSheet) continue;
          const otherMatrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[otherName], {
            header: 1,
            defval: '',
            raw: true,
          });
          const otherSummary = tryParseSummaryMatrix(otherMatrix);
          if (otherSummary && otherSummary.operacoes.length > 0) {
            summaryReport.operacoes = otherSummary.operacoes;
            break;
          }
        }
      }

      return {
        mode: 'summary',
        fileName,
        importedAt: new Date().toISOString(),
        records: [],
        summaryReport,
        rawHeaders: headers,
        rawRows: rows,
        mapping,
        sheetNames,
        activeSheet: targetSheet,
      };
    }
  }

  // Check if tabular records can be extracted cleanly (needs at least volume + (turno, frente, or operacao))
  const hasTabularStructure = Boolean(
    mapping.volume && (mapping.turno || mapping.frente || mapping.operacao)
  );

  if (hasTabularStructure) {
    const records = extractRecordsFromRows(rows, mapping);
    if (records.length > 0) {
      return {
        mode: 'records',
        fileName,
        importedAt: new Date().toISOString(),
        records,
        rawHeaders: headers,
        rawRows: rows,
        mapping,
        sheetNames,
        activeSheet: targetSheet,
      };
    }
  }

  // Fallback: try Summary / Key-Value layout
  const summaryReport = tryParseSummaryMatrix(matrix);
  if (summaryReport) {
    return {
      mode: 'summary',
      fileName,
      importedAt: new Date().toISOString(),
      records: [],
      summaryReport,
      rawHeaders: headers,
      rawRows: rows,
      mapping,
      sheetNames,
      activeSheet: targetSheet,
    };
  }

  // Last resort: if rows exist with headers, return raw rows so user can map columns manually
  if (headers.length >= 2 && rows.length > 0) {
    return {
      mode: 'records',
      fileName,
      importedAt: new Date().toISOString(),
      records: extractRecordsFromRows(rows, mapping),
      rawHeaders: headers,
      rawRows: rows,
      mapping,
      sheetNames,
      activeSheet: targetSheet,
    };
  }

  throw new Error(
    'Não foi possível identificar os dados na planilha. Verifique se o arquivo possui colunas como DATA, TURNO, FRENTE, OPERAÇÃO e VOLUME (L), ou baixe o modelo padrão.'
  );
}
