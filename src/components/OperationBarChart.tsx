import React from 'react';
import type { OperationVolume } from '../types/report';
import { formatVolumePTBR } from '../utils/formatters';

interface OperationBarChartProps {
  operacoes: OperationVolume[];
}

export const OperationBarChart: React.FC<OperationBarChartProps> = ({ operacoes }) => {
  const maxVolume = operacoes.reduce((max, item) => Math.max(max, item.volume), 0);

  if (operacoes.length === 0) {
    return (
      <div className="flex h-full min-h-[340px] items-center justify-center text-sm font-semibold text-slate-500">
        Nenhuma operação encontrada para o filtro selecionado.
      </div>
    );
  }

  return (
    <div className="relative flex flex-col justify-between py-2 pr-2">
      <div className="relative flex flex-col gap-4 sm:gap-5">
        {operacoes.map((op, idx) => {
          const ratio = maxVolume > 0 ? op.volume / maxVolume : 0;
          // Reserve right room via pr-[84px] so badge on 100% bar sits cleanly without clipping
          const barWidthPercent = Math.max(ratio * 100, op.volume > 0 ? 0.5 : 0);
          const formatted = formatVolumePTBR(op.volume);
          const overlapTip = ratio >= 0.75;

          return (
            <div key={`${op.name}-${idx}`} className="grid grid-cols-[126px_1fr] sm:grid-cols-[142px_1fr] items-center gap-2.5">
              <div
                className="text-right text-[10px] sm:text-[11px] font-extrabold uppercase leading-tight tracking-tight text-[#0B245B] pr-1"
                title={op.name}
              >
                {op.name}
              </div>

              <div className="relative flex items-center h-[30px] border-l border-slate-300">
                <div className="relative flex items-center w-full pr-[84px]">
                  <div
                    className="h-[26px] bg-[#78B72A] transition-[width] duration-200 ease-out shrink-0"
                    style={{ width: `${barWidthPercent}%` }}
                  />
                  <span
                    className={`inline-flex items-center justify-center bg-[#595959] text-white text-[11px] sm:text-[12px] font-bold tabular-nums px-2 py-[3px] rounded-[2px] whitespace-nowrap leading-none ${
                      overlapTip ? '-ml-10 z-10 shadow-xs' : 'ml-1'
                    }`}
                  >
                    {formatted}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
