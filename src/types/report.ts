export interface ShiftVolume {
  name: string;
  volume: number;
  color: string;
}

export interface OperationVolume {
  name: string;
  volume: number;
}

export interface ReportData {
  title: string;
  data: string;
  turno: string;
  frente: string;
  totalDia: number;
  turnos: ShiftVolume[];
  mediaTransferenciaMin: number;
  mediaPreparoMin: number;
  operacoes: OperationVolume[];
}

export interface DeliveryRecord {
  data: string;
  turno: string;
  frente: string;
  operacao: string;
  volume: number;
  tempoTransferenciaMin: number | null;
  tempoPreparoMin: number | null;
}

export interface ColumnMapping {
  data?: string;
  turno?: string;
  frente?: string;
  operacao?: string;
  volume?: string;
  horaSolicitacao?: string;
  horaTransferencia?: string;
  horaFimDosagem?: string;
  tempoTransferencia?: string;
  tempoPreparo?: string;
}

export interface ReportFilters {
  dataStart: string;
  dataEnd: string;
  turno: string;
  frente: string;
}

export interface ImportedDataset {
  mode: 'records' | 'summary';
  fileName: string;
  importedAt: string;
  records: DeliveryRecord[];
  summaryReport?: ReportData;
  rawHeaders: string[];
  rawRows: Record<string, unknown>[];
  mapping: ColumnMapping;
  sheetNames: string[];
  activeSheet: string;
}
