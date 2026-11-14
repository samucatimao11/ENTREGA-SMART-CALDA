import * as XLSX from 'xlsx';
import { DEFAULT_REPORT_DATA } from '../data/defaultReport';

export function downloadTemplateWorkbook(): void {
  const wb = XLSX.utils.book_new();

  // Aba 1: Dados_Diarios (formato operacional linha a linha; a coluna FRENTE alimenta o gráfico VOLUME DE CALDA ENTREGUE)
  const dailyRows = [
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO A',
      FRENTE: 'BASE LOCALIZADA',
      'VOLUME (L)': 560000.0,
      'HORA DE SOLICITAÇÃO': '06:00',
      'HORA TRANSFERÊNCIA': '08:30',
      'HORA FIM DOSAGEM': '09:10',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO A',
      FRENTE: 'HERBICIDA SOCA',
      'VOLUME (L)': 490322.9,
      'HORA DE SOLICITAÇÃO': '07:00',
      'HORA TRANSFERÊNCIA': '09:20',
      'HORA FIM DOSAGEM': '09:55',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO A',
      FRENTE: 'AVIAÇÃO',
      'VOLUME (L)': 445000.0,
      'HORA DE SOLICITAÇÃO': '08:00',
      'HORA TRANSFERÊNCIA': '10:40',
      'HORA FIM DOSAGEM': '11:25',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'BASE LOCALIZADA',
      'VOLUME (L)': 620000.0,
      'HORA DE SOLICITAÇÃO': '13:00',
      'HORA TRANSFERÊNCIA': '15:30',
      'HORA FIM DOSAGEM': '16:10',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'HERBICIDA PLANTA',
      'VOLUME (L)': 465859.0,
      'HORA DE SOLICITAÇÃO': '14:00',
      'HORA TRANSFERÊNCIA': '16:35',
      'HORA FIM DOSAGEM': '17:17',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'DRONE',
      'VOLUME (L)': 202038.0,
      'HORA DE SOLICITAÇÃO': '15:00',
      'HORA TRANSFERÊNCIA': '17:15',
      'HORA FIM DOSAGEM': '17:53',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'CAPINA QUIMICA',
      'VOLUME (L)': 22175.5,
      'HORA DE SOLICITAÇÃO': '16:00',
      'HORA TRANSFERÊNCIA': '18:30',
      'HORA FIM DOSAGEM': '19:10',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'CULTIVO',
      'VOLUME (L)': 11348.65,
      'HORA DE SOLICITAÇÃO': '17:00',
      'HORA TRANSFERÊNCIA': '19:30',
      'HORA FIM DOSAGEM': '20:10',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'PLANTIO',
      'VOLUME (L)': 435.0,
      'HORA DE SOLICITAÇÃO': '18:00',
      'HORA TRANSFERÊNCIA': '20:30',
      'HORA FIM DOSAGEM': '21:10',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO C',
      FRENTE: 'BASE LOCALIZADA',
      'VOLUME (L)': 511160.0,
      'HORA DE SOLICITAÇÃO': '22:00',
      'HORA TRANSFERÊNCIA': '00:30',
      'HORA FIM DOSAGEM': '01:10',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO C',
      FRENTE: 'HERBICIDA SOCA',
      'VOLUME (L)': 670051.1,
      'HORA DE SOLICITAÇÃO': '23:00',
      'HORA TRANSFERÊNCIA': '01:30',
      'HORA FIM DOSAGEM': '02:10',
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO C',
      FRENTE: 'AVIAÇÃO',
      'VOLUME (L)': 354815.0,
      'HORA DE SOLICITAÇÃO': '00:00',
      'HORA TRANSFERÊNCIA': '02:30',
      'HORA FIM DOSAGEM': '03:10',
    },
  ];

  const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Dados_Diarios');

  // Aba 2: Resumo_Direto (caso prefira informar os totais já consolidados)
  const summaryRows = [
    ['INDICADOR', 'VALOR'],
    ['DATA', DEFAULT_REPORT_DATA.data],
    ['TURNO', DEFAULT_REPORT_DATA.turno],
    ['FRENTE', DEFAULT_REPORT_DATA.frente],
    ['TOTAL PERIODO', DEFAULT_REPORT_DATA.totalDia],
    ['TURNO A', DEFAULT_REPORT_DATA.turnos[0].volume],
    ['TURNO B', DEFAULT_REPORT_DATA.turnos[1].volume],
    ['TURNO C', DEFAULT_REPORT_DATA.turnos[2].volume],
    ['MEDIA TRANSFERENCIA', '2h30min'],
    ['MEDIA PREPARO', '40min'],
    ['', ''],
    ['FRENTE', 'VOLUME (L)'],
    ...DEFAULT_REPORT_DATA.operacoes.map((op) => [op.name, op.volume]),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo_Direto');

  XLSX.writeFile(wb, 'Modelo_Entrega_Calda_SMART.xlsx');
}
