import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  MONTH_NAMES_PT,
  WEEKDAY_LABELS_PT,
  buildCalendarMonthGrid,
  getInitialCalendarMonth,
} from '../utils/calendarUtils';
import { brDateToIso, isoToBrDate } from '../utils/formatters';

interface DateRangeCalendarPickerProps {
  availableBrDates: string[];
  dataStart: string;
  dataEnd: string;
  onChange: (nextStart: string, nextEnd: string) => void;
}

export const DateRangeCalendarPicker: React.FC<DateRangeCalendarPickerProps> = ({
  availableBrDates,
  dataStart,
  dataEnd,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectionStage, setSelectionStage] = useState<'idle' | 'pickedStart'>('idle');
  const [viewMonth, setViewMonth] = useState(() =>
    getInitialCalendarMonth(availableBrDates, dataStart)
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const availableIsoSet = useMemo(() => {
    const set = new Set<string>();
    for (const d of availableBrDates) {
      const iso = brDateToIso(d);
      if (iso) set.add(iso);
    }
    return set;
  }, [availableBrDates]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectionStage('idle');
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSelectionStage('idle');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const handleToggleOpen = () => {
    if (!isOpen) {
      setViewMonth(getInitialCalendarMonth(availableBrDates, dataStart));
      setSelectionStage('idle');
    }
    setIsOpen((prev) => !prev);
  };

  const handleDayClick = (iso: string) => {
    if (selectionStage === 'idle') {
      // First click: immediately filters that single day, while allowing a 2nd click for a range
      onChange(iso, iso);
      setSelectionStage('pickedStart');
      return;
    }

    // Second click: if same day, keep single day and complete; otherwise set ordered range
    if (iso === dataStart) {
      onChange(iso, iso);
    } else if (iso < dataStart) {
      onChange(iso, dataStart);
    } else {
      onChange(dataStart, iso);
    }
    setSelectionStage('idle');
  };

  const handlePrevMonth = () => {
    setViewMonth((prev) =>
      prev.month0 === 0
        ? { year: prev.year - 1, month0: 11 }
        : { year: prev.year, month0: prev.month0 - 1 }
    );
  };

  const handleNextMonth = () => {
    setViewMonth((prev) =>
      prev.month0 === 11
        ? { year: prev.year + 1, month0: 0 }
        : { year: prev.year, month0: prev.month0 + 1 }
    );
  };

  const cells = useMemo(
    () => buildCalendarMonthGrid(viewMonth.year, viewMonth.month0),
    [viewMonth.year, viewMonth.month0]
  );

  const displayLabel = useMemo(() => {
    if (!dataStart && !dataEnd) return 'TODAS AS DATAS';
    if (dataStart && dataEnd) {
      return dataStart === dataEnd
        ? isoToBrDate(dataStart)
        : `${isoToBrDate(dataStart)} – ${isoToBrDate(dataEnd)}`;
    }
    if (dataStart) return `A partir de ${isoToBrDate(dataStart)}`;
    return `Até ${isoToBrDate(dataEnd)}`;
  }, [dataStart, dataEnd]);

  const hasFilter = Boolean(dataStart || dataEnd);

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Data:</span>

      <button
        id="filter-date-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={handleToggleOpen}
        className={`inline-flex items-center gap-2 h-9 px-3 text-xs sm:text-sm font-medium rounded-lg border transition-colors tabular-nums cursor-pointer whitespace-nowrap ${
          hasFilter
            ? 'bg-[#0B245B]/5 border-[#0B245B]/40 text-[#0B245B] font-semibold'
            : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
        }`}
      >
        <CalendarIcon className="w-4 h-4 text-[#0B245B] shrink-0" aria-hidden="true" />
        <span>{displayLabel}</span>
      </button>

      {hasFilter && (
        <button
          type="button"
          onClick={() => {
            onChange('', '');
            setSelectionStage('idle');
          }}
          title="Limpar filtro de datas"
          aria-label="Limpar filtro de datas"
          className="inline-flex items-center justify-center h-9 w-9 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Calendário de filtro por data"
          className="absolute left-0 top-11 z-50 w-[308px] bg-white border border-slate-200 rounded-xl shadow-lg p-3.5"
        >
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Mês anterior"
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="text-sm font-bold text-[#0B245B] capitalize">
              {MONTH_NAMES_PT[viewMonth.month0]} {viewMonth.year}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Próximo mês"
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 text-center mb-2">
            {selectionStage === 'pickedStart'
              ? 'Clique em outra data para fechar o período ou na mesma para manter 1 dia.'
              : 'Clique em 1 data ou selecione início e fim.'}
          </p>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS_PT.map((label, idx) => (
              <div
                key={idx}
                className="text-center text-[11px] font-bold text-slate-400 py-1"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const hasRecords = availableIsoSet.has(cell.iso);
              const isStart = Boolean(dataStart && cell.iso === dataStart);
              const isEnd = Boolean(dataEnd && cell.iso === dataEnd);
              const isSelectedEdge = isStart || isEnd;
              const isInRange = Boolean(
                dataStart &&
                  dataEnd &&
                  cell.iso > dataStart &&
                  cell.iso < dataEnd
              );

              const brLabel = isoToBrDate(cell.iso);

              let cellClass = 'text-slate-700 hover:bg-slate-100';
              if (!cell.inCurrentMonth) {
                cellClass = 'text-slate-300 hover:bg-slate-50';
              }
              if (hasRecords && !isSelectedEdge && !isInRange) {
                cellClass = cell.inCurrentMonth
                  ? 'bg-[#78B72A]/18 text-[#386109] font-bold hover:bg-[#78B72A]/30 ring-1 ring-inset ring-[#78B72A]/45'
                  : 'bg-[#78B72A]/10 text-[#4D7C0F]/70 font-semibold hover:bg-[#78B72A]/20';
              }
              if (isInRange) {
                cellClass = hasRecords
                  ? 'bg-[#0B245B]/15 text-[#0B245B] font-bold hover:bg-[#0B245B]/25'
                  : 'bg-[#0B245B]/10 text-[#0B245B] font-medium hover:bg-[#0B245B]/20';
              }
              if (isSelectedEdge) {
                cellClass = 'bg-[#0B245B] text-white font-bold hover:bg-[#133278]';
              }

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => handleDayClick(cell.iso)}
                  aria-label={`${brLabel}${hasRecords ? ' (com registros na planilha)' : ''}`}
                  aria-pressed={isSelectedEdge || isInRange}
                  className={`relative h-9 w-full rounded-lg text-xs tabular-nums flex flex-col items-center justify-center transition-colors cursor-pointer ${cellClass}`}
                >
                  <span>{cell.day}</span>
                  {hasRecords && (
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 h-1 w-1 rounded-full ${
                        isSelectedEdge ? 'bg-[#A3E635]' : 'bg-[#5B8E1C]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend & Footer Actions */}
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm bg-[#78B72A]/30 border border-[#5B8E1C]"
                aria-hidden="true"
              />
              <span>Dias com registro</span>
            </div>

            <div className="flex items-center gap-2">
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('', '');
                    setSelectionStage('idle');
                    setIsOpen(false);
                  }}
                  className="font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Todas
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSelectionStage('idle');
                }}
                className="px-2.5 py-1 font-semibold text-white bg-[#0B245B] hover:bg-[#133278] rounded-md cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
