import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  computeElapsedMinutes,
  formatMinutesToReportDuration,
  formatVolumePTBR,
  getTimeSlaStatus,
  parseDurationToMinutes,
  parseFlexibleDate,
  parseFlexibleNumber,
  parseSpreadsheetTimestamp,
} from './formatters';
import {
  aggregateRecordsToReport,
  parseWorkbookArrayBuffer,
} from './spreadsheetParser';
import {
  buildCalendarMonthGrid,
  getInitialCalendarMonth,
} from './calendarUtils';
import { computeDonutLayout } from './donutLayout';

test('computeDonutLayout separates adjacent small-slice callout boxes with zero overlap', () => {
  const cases = [
    [
      { name: 'TURNO A', volume: 120000, color: '#2E2E2E' },
      { name: 'TURNO B', volume: 150000, color: '#8E8E8E' },
      { name: 'TURNO C', volume: 5192000, color: '#3A4B61' },
    ],
    [
      { name: 'TURNO A', volume: 50000, color: '#2E2E2E' },
      { name: 'TURNO B', volume: 55000, color: '#8E8E8E' },
      { name: 'TURNO C', volume: 60000, color: '#3A4B61' },
      { name: 'TURNO D', volume: 5000000, color: '#0B245B' },
    ],
    [
      { name: 'TURNO A', volume: 1495322.9, color: '#2E2E2E' },
      { name: 'TURNO B', volume: 1365374.25, color: '#8E8E8E' },
      { name: 'TURNO C', volume: 2625690.0, color: '#3A4B61' },
    ],
  ];

  for (const turnos of cases) {
    const { slices, width, height } = computeDonutLayout(turnos);
    for (let i = 0; i < slices.length; i++) {
      const a = slices[i];
      assert.ok(a.callX - a.boxWidth / 2 >= 0);
      assert.ok(a.callX + a.boxWidth / 2 <= width);
      assert.ok(a.callY - a.boxHeight / 2 >= 0);
      assert.ok(a.callY + a.boxHeight / 2 <= height);
      for (let j = i + 1; j < slices.length; j++) {
        const b = slices[j];
        const overlapX = Math.abs(a.callX - b.callX) < (a.boxWidth + b.boxWidth) / 2 + 2;
        const overlapY = Math.abs(a.callY - b.callY) < (a.boxHeight + b.boxHeight) / 2 + 2;
        assert.equal(
          overlapX && overlapY,
          false,
          `Overlap detected between ${a.name} (${a.callX},${a.callY}) and ${b.name} (${b.callX},${b.callY})`
        );
      }
    }
  }
});

test('formatVolumePTBR formats numbers with PT-BR thousands and two decimals', () => {
  assert.equal(formatVolumePTBR(1495322.9), '1.495.322,90');
  assert.equal(formatVolumePTBR(435), '435,00');
  assert.equal(formatVolumePTBR(5486387.57), '5.486.387,57');
});

test('parseFlexibleNumber handles PT-BR, US, and raw numeric strings', () => {
  assert.equal(parseFlexibleNumber('1.495.322,90'), 1495322.9);
  assert.equal(parseFlexibleNumber('22.175,50'), 22175.5);
  assert.equal(parseFlexibleNumber('435,00'), 435);
  assert.equal(parseFlexibleNumber('1,691,160.00'), 1691160);
  assert.equal(parseFlexibleNumber(799815), 799815);
  assert.equal(parseFlexibleNumber(''), null);
});

test('parseDurationToMinutes and formatMinutesToReportDuration roundtrip cleanly', () => {
  assert.equal(parseDurationToMinutes('2h30min'), 150);
  assert.equal(parseDurationToMinutes('40min'), 40);
  assert.equal(parseDurationToMinutes('02:30'), 150);
  assert.equal(parseDurationToMinutes(2.5, 'hours'), 150);
  assert.equal(parseDurationToMinutes(40, 'minutes'), 40);

  assert.equal(formatMinutesToReportDuration(150), '2h30min');
  assert.equal(formatMinutesToReportDuration(40), '40min');
  assert.equal(formatMinutesToReportDuration(120), '2h');
  assert.equal(formatMinutesToReportDuration(125), '2h05min');
});

test('getTimeSlaStatus classifies <=1h00min green, >1h00min yellow, and >1h30min red', () => {
  assert.equal(getTimeSlaStatus(0).level, 'green');
  assert.equal(getTimeSlaStatus(40).level, 'green');
  assert.equal(getTimeSlaStatus(60).level, 'green');
  assert.equal(getTimeSlaStatus(61).level, 'yellow');
  assert.equal(getTimeSlaStatus(75).level, 'yellow');
  assert.equal(getTimeSlaStatus(90).level, 'yellow');
  assert.equal(getTimeSlaStatus(91).level, 'red');
  assert.equal(getTimeSlaStatus(150).level, 'red');
});

test('parseFlexibleDate handles Excel serial dates, ISO dates, and PT-BR dates', () => {
  // Excel serial 45583 -> 18/10/2024
  assert.equal(parseFlexibleDate(45583), '18/10/2024');
  assert.equal(parseFlexibleDate('2024-10-18'), '18/10/2024');
  assert.equal(parseFlexibleDate('18/10/2024'), '18/10/2024');
});

test('parseSpreadsheetTimestamp and computeElapsedMinutes handle strings, Excel serials, and midnight rollover', () => {
  assert.deepEqual(parseSpreadsheetTimestamp('08:30'), {
    kind: 'timeOfDay',
    minutesOfDay: 510,
  });
  assert.deepEqual(parseSpreadsheetTimestamp('08h45min'), {
    kind: 'timeOfDay',
    minutesOfDay: 525,
  });

  // Excel time serials: 0.25 = 06:00, 0.3541666667 = 08:30 -> 150 min
  const elapsedSerial = computeElapsedMinutes(0.25, 0.3541666667);
  assert.ok(elapsedSerial !== null && Math.abs(elapsedSerial - 150) < 0.01);

  // Excel datetime serials: 45583 + 23:00 -> 45584 + 01:30 = 150 min
  const elapsedExcelDt = computeElapsedMinutes(45583 + 23 / 24, 45584 + 1.5 / 24);
  assert.ok(elapsedExcelDt !== null && Math.abs(elapsedExcelDt - 150) < 0.01);

  // String clock times and BR datetimes
  assert.equal(computeElapsedMinutes('08:00', '10:30'), 150);
  assert.equal(computeElapsedMinutes('10:30:00', '11:10:00'), 40);
  assert.equal(computeElapsedMinutes('18/10/2024 23:30', '19/10/2024 01:15'), 105);

  // Midnight rollover on time-of-day strings
  assert.equal(computeElapsedMinutes('23:00', '01:30'), 150);
  assert.equal(computeElapsedMinutes('23:30', '00:10'), 40);

  // Small negative difference (typo) returns null instead of ~24h
  assert.equal(computeElapsedMinutes('10:00', '09:50'), null);
  assert.equal(computeElapsedMinutes('08:30', '08:30'), 0);

  // Excel 1900-01-01 base-date serials (1.xxxx) and 24:00
  const serial1900 = computeElapsedMinutes(1 + 6 / 24, 1 + 8.5 / 24);
  assert.ok(serial1900 !== null && Math.abs(serial1900 - 150) < 0.01);
  assert.equal(computeElapsedMinutes('22:30', '24:00'), 90);

  // AM/PM strings, numeric strings, and same-date overnight Turno C datetimes
  assert.equal(computeElapsedMinutes('08:00:00 AM', '10:30:00 AM'), 150);
  assert.equal(computeElapsedMinutes('11:30 AM', '01:00 PM'), 90);
  const strSerial = computeElapsedMinutes('0.25', '0.3541666667');
  assert.ok(strSerial !== null && Math.abs(strSerial - 150) < 0.01);
  assert.equal(computeElapsedMinutes('18/10/2024 23:00', '18/10/2024 01:15'), 135);
});

test('autoDetectColumnMapping ignores numeric ID column Solicitação and maps hora de solicitação accurately', () => {
  const wb = XLSX.utils.book_new();
  const rows = [
    {
      'Solicitação': 10234,
      DATA: '18/10/2024',
      TURNO: 'TURNO A',
      FRENTE: 'BASE LOCALIZADA',
      'VOLUME (L)': '400.000,00',
      'hora de solicitação': '18/10/2024 06:00:00',
      'hora transferência': '18/10/2024 08:30:00',
      'hora fim dosagem': '18/10/2024 09:10:00',
    },
    {
      'Solicitação': 10235,
      DATA: '18/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'DRONE',
      'VOLUME (L)': '200.000,00',
      'hora de solicitação': '18/10/2024 14:00:00',
      'hora transferência': '18/10/2024 16:30:00',
      'hora fim dosagem': '18/10/2024 17:10:00',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = parseWorkbookArrayBuffer(buf, 'com_id_solicitacao.xlsx');
  assert.equal(parsed.mapping.horaSolicitacao, 'hora de solicitação');
  assert.equal(parsed.mapping.horaTransferencia, 'hora transferência');
  assert.equal(parsed.mapping.horaFimDosagem, 'hora fim dosagem');

  const report = aggregateRecordsToReport(parsed.records, {
    dataStart: '',
    dataEnd: '',
    turno: 'TODOS',
    frente: 'TODOS',
  });
  assert.equal(report.mediaTransferenciaMin, 150);
  assert.equal(report.mediaPreparoMin, 40);
});

test('autoDetectColumnMapping detects HORA SOLICITA, TRANSFERENCIA, and FIM DOSAGEM and calculates transfer/prep averages', () => {
  const wb = XLSX.utils.book_new();
  const rows = [
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO A',
      FRENTE: 'BASE LOCALIZADA',
      'VOLUME (L)': '450.000,00',
      'HORA SOLICITA': '07:00',
      TRANSFERENCIA: '09:30', // 150 min
      'FIM DOSAGEM': '10:15', // 45 min
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'DRONE',
      'VOLUME (L)': '250.000,00',
      'HORA SOLICITA': 13 / 24,
      TRANSFERENCIA: 15 / 24, // 120 min
      'FIM DOSAGEM': (15 + 35 / 60) / 24, // 35 min
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = parseWorkbookArrayBuffer(buf, 'hora_solicita_transferencia.xlsx');
  assert.equal(parsed.mapping.horaSolicitacao, 'HORA SOLICITA');
  assert.equal(parsed.mapping.horaTransferencia, 'TRANSFERENCIA');
  assert.equal(parsed.mapping.horaFimDosagem, 'FIM DOSAGEM');
  assert.equal(parsed.mapping.tempoTransferencia, undefined);

  const report = aggregateRecordsToReport(parsed.records, {
    dataStart: '',
    dataEnd: '',
    turno: 'TODOS',
    frente: 'TODOS',
  });
  assert.ok(Math.abs(report.mediaTransferenciaMin - 135) < 0.01); // (150 + 120) / 2 = 2h15min
  assert.ok(Math.abs(report.mediaPreparoMin - 40) < 0.01); // (45 + 35) / 2 = 40min
  assert.equal(formatMinutesToReportDuration(report.mediaTransferenciaMin), '2h15min');
  assert.equal(formatMinutesToReportDuration(report.mediaPreparoMin), '40min');
});

test('parseWorkbookArrayBuffer reads hora de solicitacao, hora transferencia, hora fim dosagem and computes filtered period averages', () => {
  const wb = XLSX.utils.book_new();
  const rows = [
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO A',
      FRENTE: 'BASE LOCALIZADA',
      'VOLUME (L)': '500.000,00',
      'hora de solicitação': '06:00',
      'hora transferência': '08:00', // 120 min
      'hora fim dosagem': '08:30', // 30 min
    },
    {
      DATA: '18/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'HERBICIDA SOCA',
      'VOLUME (L)': '300.000,00',
      'hora de solicitação': '12:00',
      'hora transferência': '15:00', // 180 min
      'hora fim dosagem': '15:50', // 50 min
    },
    {
      DATA: '19/10/2024',
      TURNO: 'TURNO C',
      FRENTE: 'DRONE',
      'VOLUME (L)': '200.000,00',
      // Night shift crossing midnight: 23:00 -> 00:30 (90 min), 00:30 -> 01:10 (40 min)
      'hora de solicitação': 23 / 24,
      'hora transferência': 0.5 / 24,
      'hora fim dosagem': (1 + 10 / 60) / 24,
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = parseWorkbookArrayBuffer(buf, 'tempos.xlsx');
  assert.equal(parsed.mode, 'records');
  assert.equal(parsed.mapping.horaSolicitacao, 'hora de solicitação');
  assert.equal(parsed.mapping.horaTransferencia, 'hora transferência');
  assert.equal(parsed.mapping.horaFimDosagem, 'hora fim dosagem');
  assert.equal(parsed.mapping.tempoTransferencia, undefined);
  assert.equal(parsed.records.length, 3);

  // Full period average: transfer = (120 + 180 + 90) / 3 = 130 min; preparo = (30 + 50 + 40) / 3 = 40 min
  const allPeriod = aggregateRecordsToReport(parsed.records, {
    dataStart: '',
    dataEnd: '',
    turno: 'TODOS',
    frente: 'TODOS',
  });
  assert.ok(Math.abs(allPeriod.mediaTransferenciaMin - 130) < 0.01);
  assert.ok(Math.abs(allPeriod.mediaPreparoMin - 40) < 0.01);

  // Filtered to 18/10/2024 only: transfer = (120 + 180) / 2 = 150 min; preparo = (30 + 50) / 2 = 40 min
  const day18 = aggregateRecordsToReport(parsed.records, {
    dataStart: '2024-10-18',
    dataEnd: '2024-10-18',
    turno: 'TODOS',
    frente: 'TODOS',
  });
  assert.equal(day18.mediaTransferenciaMin, 150);
  assert.equal(day18.mediaPreparoMin, 40);
  assert.equal(formatMinutesToReportDuration(day18.mediaTransferenciaMin), '2h30min');

  // Filtered to 19/10/2024 only: transfer = 90 min (1h30min); preparo = 40 min
  const day19 = aggregateRecordsToReport(parsed.records, {
    dataStart: '2024-10-19',
    dataEnd: '2024-10-19',
    turno: 'TODOS',
    frente: 'TODOS',
  });
  assert.ok(Math.abs(day19.mediaTransferenciaMin - 90) < 0.01);
  assert.ok(Math.abs(day19.mediaPreparoMin - 40) < 0.01);
  assert.equal(formatMinutesToReportDuration(day19.mediaTransferenciaMin), '1h30min');
});

test('parseWorkbookArrayBuffer reads tabular XLSX and aggregates shifts, operations, and averages', () => {
  const wb = XLSX.utils.book_new();
  const rows = [
    {
      DATA: '20/11/2024',
      TURNO: 'A',
      FRENTE: 'FRENTE 01',
      OPERACAO: 'BASE LOCALIZADA',
      'VOLUME (L)': '1.000.000,00',
      'TEMPO TRANSFERENCIA (h)': '2h00min',
      'TEMPO PREPARO (h)': '30min',
    },
    {
      DATA: '20/11/2024',
      TURNO: 'TURNO B',
      FRENTE: 'FRENTE 02',
      OPERACAO: 'DRONE',
      'VOLUME (L)': '500.000,50',
      'TEMPO TRANSFERENCIA (h)': '3h00min',
      'TEMPO PREPARO (h)': '50min',
    },
    {
      DATA: '20/11/2024',
      TURNO: 'C',
      FRENTE: 'FRENTE 01',
      OPERACAO: 'BASE LOCALIZADA',
      'VOLUME (L)': 250000,
      'TEMPO TRANSFERENCIA (h)': '2h30min',
      'TEMPO PREPARO (h)': '40min',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = parseWorkbookArrayBuffer(buf, 'teste.xlsx');
  assert.equal(parsed.mode, 'records');
  assert.equal(parsed.records.length, 3);

  const report = aggregateRecordsToReport(parsed.records, {
    dataStart: '',
    dataEnd: '',
    turno: 'TODOS',
    frente: 'TODOS',
  });

  assert.equal(report.data, '20/11/2024');
  assert.equal(report.totalDia, 1750000.5);
  assert.equal(report.turnos.length, 3);
  assert.equal(report.turnos[0].name, 'TURNO A');
  assert.equal(report.turnos[0].volume, 1000000);
  assert.equal(report.turnos[1].name, 'TURNO B');
  assert.equal(report.turnos[1].volume, 500000.5);
  assert.equal(report.turnos[2].name, 'TURNO C');
  assert.equal(report.turnos[2].volume, 250000);
  assert.equal(report.mediaTransferenciaMin, 150); // (120 + 180 + 150) / 3 = 150
  assert.equal(report.mediaPreparoMin, 40); // (30 + 50 + 40) / 3 = 40
  // Bar chart aggregates from FRENTE column
  assert.equal(report.operacoes[0].name, 'FRENTE 01');
  assert.equal(report.operacoes[0].volume, 1250000);
  assert.equal(report.operacoes[1].name, 'FRENTE 02');
  assert.equal(report.operacoes[1].volume, 500000.5);

  // Test filtering by Frente
  const filtered = aggregateRecordsToReport(parsed.records, {
    dataStart: '',
    dataEnd: '',
    turno: 'TODOS',
    frente: 'FRENTE 01',
  });
  assert.equal(filtered.totalDia, 1250000);
  assert.equal(filtered.frente, 'FRENTE 01');
  assert.equal(filtered.operacoes.length, 1);
  assert.equal(filtered.operacoes[0].name, 'FRENTE 01');
});

test('parseWorkbookArrayBuffer reads FRENTE column directly for VOLUME DE CALDA ENTREGUE without OPERACAO column', () => {
  const wb = XLSX.utils.book_new();
  const rows = [
    {
      DATA: '25/10/2024',
      TURNO: 'TURNO A',
      FRENTE: 'BASE LOCALIZADA',
      'VOLUME (L)': '900.000,00',
      'TEMPO TRANSFERENCIA (h)': '1h50min',
      'TEMPO PREPARO (h)': '30min',
    },
    {
      DATA: '25/10/2024',
      TURNO: 'TURNO B',
      FRENTE: 'HERBICIDA SOCA',
      'VOLUME (L)': '650.000,50',
      'TEMPO TRANSFERENCIA (h)': '2h10min',
      'TEMPO PREPARO (h)': '40min',
    },
    {
      DATA: '25/10/2024',
      TURNO: 'TURNO C',
      FRENTE: 'DRONE',
      'VOLUME (L)': '450.000,00',
      'TEMPO TRANSFERENCIA (h)': '2h00min',
      'TEMPO PREPARO (h)': '35min',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = parseWorkbookArrayBuffer(buf, 'teste_frente.xlsx');
  assert.equal(parsed.mode, 'records');
  assert.equal(parsed.records.length, 3);
  const report = aggregateRecordsToReport(parsed.records, {
    dataStart: '',
    dataEnd: '',
    turno: 'TODOS',
    frente: 'TODOS',
  });
  assert.equal(report.data, '25/10/2024');
  assert.equal(report.totalDia, 2000000.5);
  assert.equal(report.mediaTransferenciaMin, 120);
  assert.equal(report.mediaPreparoMin, 35);
  assert.deepEqual(
    report.operacoes.map((o) => [o.name, o.volume]),
    [
      ['BASE LOCALIZADA', 900000],
      ['HERBICIDA SOCA', 650000.5],
      ['DRONE', 450000],
    ]
  );
});

test('aggregateRecordsToReport filters accurately by single date (same start/end) and date range', () => {
  const records = [
    {
      data: '18/10/2024',
      turno: 'TURNO A',
      frente: 'BASE LOCALIZADA',
      operacao: 'OUTROS',
      volume: 1000,
      tempoTransferenciaMin: 60,
      tempoPreparoMin: 30,
    },
    {
      data: '20/10/2024',
      turno: 'TURNO B',
      frente: 'DRONE',
      operacao: 'OUTROS',
      volume: 2000,
      tempoTransferenciaMin: 120,
      tempoPreparoMin: 40,
    },
    {
      data: '25/10/2024',
      turno: 'TURNO C',
      frente: 'PLANTIO',
      operacao: 'OUTROS',
      volume: 4000,
      tempoTransferenciaMin: 180,
      tempoPreparoMin: 50,
    },
  ];

  // Single date (same start and end)
  const single = aggregateRecordsToReport(records, {
    dataStart: '2024-10-20',
    dataEnd: '2024-10-20',
    turno: 'TODOS',
    frente: 'TODOS',
  });
  assert.equal(single.data, '20/10/2024');
  assert.equal(single.totalDia, 2000);
  assert.equal(single.operacoes[0].name, 'DRONE');

  // Date range (18/10/2024 to 20/10/2024)
  const range = aggregateRecordsToReport(records, {
    dataStart: '2024-10-18',
    dataEnd: '2024-10-20',
    turno: 'TODOS',
    frente: 'TODOS',
  });
  assert.equal(range.data, '18/10/2024 – 20/10/2024');
  assert.equal(range.totalDia, 3000);
  assert.equal(range.operacoes.length, 2);
});

test('parseWorkbookArrayBuffer reads Resumo_Direto summary sheet format', () => {
  const wb = XLSX.utils.book_new();
  const aoa = [
    ['INDICADOR', 'VALOR'],
    ['DATA', '18/10/2024'],
    ['TURNO', 'TODOS'],
    ['FRENTE', 'TODOS'],
    ['TOTAL DIA', '5.486.387,57'],
    ['TURNO A', '1.495.322,90'],
    ['TURNO B', '1.365.374,25'],
    ['TURNO C', '2.625.690,00'],
    ['MEDIA TRANSFERENCIA', '2h30min'],
    ['MEDIA PREPARO', '40min'],
    ['OPERACAO', 'VOLUME (L)'],
    ['BASE LOCALIZADA', '1.691.160,00'],
    ['PLANTIO', '435,00'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Resumo_Direto');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = parseWorkbookArrayBuffer(buf, 'resumo.xlsx');
  assert.equal(parsed.mode, 'summary');
  assert.ok(parsed.summaryReport);
  assert.equal(parsed.summaryReport.data, '18/10/2024');
  assert.equal(parsed.summaryReport.totalDia, 5486387.57);
  assert.equal(parsed.summaryReport.mediaTransferenciaMin, 150);
  assert.equal(parsed.summaryReport.mediaPreparoMin, 40);
  assert.equal(parsed.summaryReport.operacoes[0].name, 'BASE LOCALIZADA');
  assert.equal(parsed.summaryReport.operacoes[0].volume, 1691160);
  assert.equal(parsed.summaryReport.operacoes[1].name, 'PLANTIO');
  assert.equal(parsed.summaryReport.operacoes[1].volume, 435);
});

test('calendarUtils builds October 2024 grid and initializes on earliest spreadsheet date', () => {
  const init = getInitialCalendarMonth(['18/10/2024', '20/10/2024'], '');
  assert.deepEqual(init, { year: 2024, month0: 9 });

  const grid = buildCalendarMonthGrid(2024, 9);
  assert.equal(grid.length % 7, 0);
  const octDays = grid.filter((c) => c.inCurrentMonth);
  assert.equal(octDays.length, 31);
  assert.equal(octDays[0].iso, '2024-10-01');
  assert.equal(octDays[30].iso, '2024-10-31');
});
