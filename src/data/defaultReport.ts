import type { ImportedDataset, ReportData } from '../types/report';

export const SHIFT_COLORS: Record<string, string> = {
  'TURNO A': '#3B3B3B',
  'TURNO B': '#A5A5A5',
  'TURNO C': '#3E5066',
};

export const FALLBACK_SHIFT_COLORS = ['#3B3B3B', '#A5A5A5', '#3E5066', '#5A7184', '#78B72A'];

export const DEFAULT_REPORT_DATA: ReportData = {
  title: 'ENTREGA DE CALDA - SMART',
  data: '18/10/2024',
  turno: 'TODOS',
  frente: 'TODOS',
  totalDia: 5486387.57,
  turnos: [
    { name: 'TURNO A', volume: 1495322.9, color: '#3B3B3B' },
    { name: 'TURNO B', volume: 1365374.25, color: '#A5A5A5' },
    { name: 'TURNO C', volume: 2625690.0, color: '#3E5066' },
  ],
  mediaTransferenciaMin: 150, // 2h30min
  mediaPreparoMin: 40, // 40min
  operacoes: [
    { name: 'BASE LOCALIZADA', volume: 1691160.0 },
    { name: 'HERBICIDA SOCA', volume: 1160374.0 },
    { name: 'AVIAÇÃO', volume: 799815.0 },
    { name: 'HERBICIDA PLANTA', volume: 465859.0 },
    { name: 'DRONE', volume: 202038.0 },
    { name: 'CAPINA QUIMICA', volume: 22175.5 },
    { name: 'CULTIVO', volume: 11348.65 },
    { name: 'PLANTIO', volume: 435.0 },
  ],
};

export const DEFAULT_DATASET: ImportedDataset = {
  mode: 'summary',
  fileName: 'Informativo_Padrao_18_10_2024.xlsx',
  importedAt: '2024-10-18T18:00:00.000Z',
  records: [],
  summaryReport: DEFAULT_REPORT_DATA,
  rawHeaders: [],
  rawRows: [],
  mapping: {},
  sheetNames: ['Resumo'],
  activeSheet: 'Resumo',
};
