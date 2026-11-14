import React from 'react';
import type { ShiftVolume } from '../types/report';
import { formatVolumePTBR } from '../utils/formatters';

interface DonutShiftChartProps {
  turnos: ShiftVolume[];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeDonutArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    // Full circle donut using two semicircles
    const topOuter = polarToCartesian(cx, cy, outerR, 0);
    const botOuter = polarToCartesian(cx, cy, outerR, 180);
    const topInner = polarToCartesian(cx, cy, innerR, 0);
    const botInner = polarToCartesian(cx, cy, innerR, 180);
    return [
      `M ${topOuter.x} ${topOuter.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${botOuter.x} ${botOuter.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${topOuter.x} ${topOuter.y}`,
      `M ${topInner.x} ${topInner.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${botInner.x} ${botInner.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${topInner.x} ${topInner.y}`,
      'Z',
    ].join(' ');
  }

  const startOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArcFlag = sweep <= 180 ? '0' : '1';

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

function getCalloutBgColor(shiftName: string, sliceColor: string): string {
  if (shiftName === 'TURNO A') return '#2E2E2E';
  if (shiftName === 'TURNO B') return '#8E8E8E';
  if (shiftName === 'TURNO C') return '#3A4B61';
  return sliceColor;
}

export const DonutShiftChart: React.FC<DonutShiftChartProps> = ({ turnos }) => {
  const validTurnos = turnos.filter((t) => t.volume > 0);
  const total = validTurnos.reduce((acc, t) => acc + t.volume, 0);

  const width = 320;
  const height = 228;
  const cx = 160;
  const cy = 114;
  const outerR = 94;
  const innerR = 46;

  if (total <= 0 || validTurnos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[300px] h-auto" role="img" aria-label="Gráfico de entrega por turno sem dados">
          <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="#E2E8F0" strokeWidth={outerR - innerR} />
          <text x={cx} y={cy + 4} textAnchor="middle" fill="#64748B" fontSize="12" fontWeight="700">
            Sem dados no filtro
          </text>
        </svg>
      </div>
    );
  }

  let currentAngle = 0;
  const slices = validTurnos.map((t) => {
    const angle = (t.volume / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const midAngle = startAngle + angle / 2;
    currentAngle = endAngle;

    const labelR = (outerR + innerR) / 2 + 2;
    const labelPos = polarToCartesian(cx, cy, labelR, midAngle);
    const formatted = formatVolumePTBR(t.volume);
    const boxWidth = Math.max(76, formatted.length * 6.8 + 14);
    const boxHeight = 22;

    // Clamp horizontally inside viewBox so callout badges never clip off left/right edges
    const clampedX = Math.max(boxWidth / 2 + 4, Math.min(width - boxWidth / 2 - 4, labelPos.x));
    const clampedY = Math.max(boxHeight / 2 + 4, Math.min(height - boxHeight / 2 - 4, labelPos.y));

    return {
      ...t,
      path: describeDonutArc(cx, cy, outerR, innerR, startAngle, endAngle),
      callX: clampedX,
      callY: clampedY,
      boxWidth,
      boxHeight,
      formatted,
      calloutBg: getCalloutBgColor(t.name, t.color),
    };
  });

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[305px] h-auto overflow-visible"
        role="img"
        aria-label="Gráfico de entrega por turno em litros"
      >
        {slices.map((s) => (
          <path key={s.name} d={s.path} fill={s.color} />
        ))}

        {slices.map((s) => (
          <g key={`${s.name}-label`} transform={`translate(${s.callX}, ${s.callY})`}>
            <rect
              x={-s.boxWidth / 2}
              y={-s.boxHeight / 2}
              width={s.boxWidth}
              height={s.boxHeight}
              rx={3}
              fill={s.calloutBg}
            />
            <text
              x={0}
              y={4}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="11.5"
              fontWeight="700"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {s.formatted}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend matching reference image */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {turnos.map((t) => (
          <div key={t.name} className="flex items-center gap-1.5 text-[10px] font-bold tracking-tight text-slate-600">
            <span
              className="inline-block h-2 w-2 shrink-0"
              style={{ backgroundColor: t.color }}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
