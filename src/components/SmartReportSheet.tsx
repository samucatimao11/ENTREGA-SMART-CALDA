import React from 'react';
import type { ReportData } from '../types/report';
import {
  formatMinutesToReportDuration,
  formatVolumePTBR,
  getTimeSlaStatus,
  type TimeSlaLevel,
} from '../utils/formatters';
import { DonutShiftChart } from './DonutShiftChart';
import { OperationBarChart } from './OperationBarChart';

interface SmartReportSheetProps {
  report: ReportData;
  sheetRef?: React.RefObject<HTMLDivElement | null>;
}

const SLA_BORDER_CLASS: Record<TimeSlaLevel, string> = {
  green: 'border-[#78B72A]',
  yellow: 'border-[#EAB308]',
  red: 'border-[#DC2626]',
};

export const SmartReportSheet: React.FC<SmartReportSheetProps> = ({ report, sheetRef }) => {
  const transfSla = getTimeSlaStatus(report.mediaTransferenciaMin);
  const preparoSla = getTimeSlaStatus(report.mediaPreparoMin);

  return (
    <div
      ref={sheetRef}
      data-testid="smart-report-sheet"
      className="print-only-sheet font-report w-full max-w-[1160px] mx-auto bg-white text-[#0B245B] border border-slate-200 shadow-sm px-5 sm:px-7 pt-4 pb-6"
    >
      {/* Green Main Title & Company Logo */}
      <header className="pb-2.5 flex items-center justify-between gap-4">
        <h1 className="text-[24px] sm:text-[32px] font-extrabold uppercase tracking-tight leading-none text-[#78B72A]">
          {report.title}
        </h1>
        <img
          src="/logo-empresa.png"
          alt="Logo da empresa"
          width={44}
          height={44}
          className="w-9 h-9 sm:w-11 sm:h-11 object-contain shrink-0 select-none"
        />
      </header>

      {/* Metadata Band between two solid navy-blue rules */}
      <div className="border-t-[2.5px] border-b-[2.5px] border-[#0B245B] py-1.5 px-1 flex flex-wrap items-center gap-x-10 sm:gap-x-14 gap-y-1 text-[13px] sm:text-[15px] font-extrabold uppercase text-[#0B245B] tabular-nums">
        <div>
          <span>DATA: </span>
          <span>{report.data}</span>
        </div>
        <div>
          <span>TURNO: </span>
          <span>{report.turno}</span>
        </div>
        <div>
          <span>FRENTE: </span>
          <span>{report.frente}</span>
        </div>
      </div>

      {/* Main 2-column Asymmetric Report Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[55%_45%]">
        {/* Left Column: Turno Donut + Total Periodo (Top) & Tempo Preparo (Bottom) */}
        <div className="lg:border-r-[2.5px] lg:border-[#0B245B] flex flex-col">
          {/* Top-Left Quadrant */}
          <section className="border-b-[2.5px] border-[#0B245B] pt-3 pb-4 pr-0 lg:pr-5">
            <h2 className="text-center text-[15px] sm:text-[17px] font-extrabold uppercase tracking-tight text-[#0B245B] mb-2">
              ENTREGA POR TURNO (L)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-[1.25fr_1fr] items-center gap-4">
              <DonutShiftChart turnos={report.turnos} />

              {/* TOTAL PERIODO KPI Box */}
              <div className="flex flex-col items-center justify-center">
                <div className="text-[14px] sm:text-[15px] font-extrabold uppercase text-[#0B245B] mb-2">
                  TOTAL PERIODO
                </div>
                <div
                  data-testid="total-dia-value"
                  className="w-full max-w-[238px] rounded-[18px] border-[3px] border-[#78B72A] bg-white px-4 py-5 flex items-center justify-center"
                >
                  <span className="text-[22px] sm:text-[26px] font-extrabold text-[#0B245B] tabular-nums tracking-tight leading-none">
                    {formatVolumePTBR(report.totalDia)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom-Left Quadrant */}
          <section className="pt-3.5 pb-2 pr-0 lg:pr-5 flex-1 flex flex-col justify-between">
            <h2 className="text-center text-[15px] sm:text-[17px] font-extrabold uppercase tracking-tight text-[#0B245B] mb-4">
              TEMPO PREPARO CALDA (h)
            </h2>

            <div className="grid grid-cols-2 gap-4 sm:gap-8 max-w-[440px] w-full mx-auto pb-2">
              {/* Média Transferência */}
              <div className="flex flex-col items-center">
                <div className="text-center text-[12px] sm:text-[14px] font-extrabold uppercase text-[#0B245B] leading-tight mb-2 min-h-[34px] flex flex-col justify-end">
                  <span>MÉDIA</span>
                  <span>TRANSFERENCIA (h)</span>
                </div>
                <div
                  data-testid="media-transferencia-value"
                  data-sla-status={transfSla.level}
                  title={`Média Transferência: ${transfSla.label}`}
                  className={`w-full max-w-[180px] h-[112px] sm:h-[124px] rounded-[18px] border-[3px] ${SLA_BORDER_CLASS[transfSla.level]} bg-white px-3 flex items-center justify-center transition-colors`}
                >
                  <span className="text-[22px] sm:text-[26px] font-extrabold text-[#0B245B] tabular-nums tracking-tight">
                    {formatMinutesToReportDuration(report.mediaTransferenciaMin)}
                  </span>
                </div>
              </div>

              {/* Média Preparo */}
              <div className="flex flex-col items-center">
                <div className="text-center text-[12px] sm:text-[14px] font-extrabold uppercase text-[#0B245B] leading-tight mb-2 min-h-[34px] flex flex-col justify-end">
                  <span>MÉDIA</span>
                  <span>PREPARO (h)</span>
                </div>
                <div
                  data-testid="media-preparo-value"
                  data-sla-status={preparoSla.level}
                  title={`Média Preparo: ${preparoSla.label}`}
                  className={`w-full max-w-[180px] h-[112px] sm:h-[124px] rounded-[18px] border-[3px] ${SLA_BORDER_CLASS[preparoSla.level]} bg-white px-3 flex items-center justify-center transition-colors`}
                >
                  <span className="text-[22px] sm:text-[26px] font-extrabold text-[#0B245B] tabular-nums tracking-tight">
                    {formatMinutesToReportDuration(report.mediaPreparoMin)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-[10px] font-semibold text-slate-600 tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-xs border-2 border-[#78B72A]" aria-hidden="true" />
                &le; 1h00min
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-xs border-2 border-[#EAB308]" aria-hidden="true" />
                &gt; 1h00min
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-xs border-2 border-[#DC2626]" aria-hidden="true" />
                &gt; 1h30min
              </span>
            </div>
          </section>
        </div>

        {/* Right Column: Volume de Calda Entregue (L) */}
        <section className="pt-3 pl-0 lg:pl-4 flex flex-col border-t-[2.5px] border-[#0B245B] lg:border-t-0 mt-4 lg:mt-0">
          <h2 className="text-center text-[15px] sm:text-[17px] font-extrabold uppercase tracking-tight text-[#0B245B] mb-3">
            VOLUME DE CALDA ENTREGUE (L)
          </h2>
          <div className="flex-1 flex flex-col justify-center">
            <OperationBarChart operacoes={report.operacoes} />
          </div>
        </section>
      </div>
    </div>
  );
};
