import { brDateToIso } from './formatters';

export interface CalendarCell {
  iso: string;
  day: number;
  inCurrentMonth: boolean;
}

export const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const WEEKDAY_LABELS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function toIso(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function buildCalendarMonthGrid(year: number, month0: number): CalendarCell[] {
  const firstDayWeekday = new Date(Date.UTC(year, month0, 1)).getUTCDay(); // 0 = Sun
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const prevMonthDate = new Date(Date.UTC(year, month0, 0));
  const prevYear = prevMonthDate.getUTCFullYear();
  const prevMonth0 = prevMonthDate.getUTCMonth();
  const daysInPrevMonth = prevMonthDate.getUTCDate();

  const cells: CalendarCell[] = [];

  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({
      iso: toIso(prevYear, prevMonth0, day),
      day,
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      iso: toIso(year, month0, day),
      day,
      inCurrentMonth: true,
    });
  }

  const nextMonthDate = new Date(Date.UTC(year, month0 + 1, 1));
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth0 = nextMonthDate.getUTCMonth();
  const remainder = cells.length % 7;
  const trailing = remainder === 0 ? 0 : 7 - remainder;

  for (let day = 1; day <= trailing; day++) {
    cells.push({
      iso: toIso(nextYear, nextMonth0, day),
      day,
      inCurrentMonth: false,
    });
  }

  return cells;
}

export function getInitialCalendarMonth(
  availableBrDates: string[],
  selectedStartIso: string
): { year: number; month0: number } {
  const targetIso =
    selectedStartIso ||
    (availableBrDates.length > 0 ? brDateToIso(availableBrDates[0]) : '');

  const match = targetIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return {
      year: Number(match[1]),
      month0: Number(match[2]) - 1,
    };
  }

  const now = new Date();
  return {
    year: now.getFullYear(),
    month0: now.getMonth(),
  };
}
