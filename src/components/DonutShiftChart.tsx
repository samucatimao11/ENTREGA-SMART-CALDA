import React from 'react';
import type { ShiftVolume } from '../types/report';
import { computeDonutLayout, polarToCartesian } from '../utils/donutLayout';

interface DonutShiftChartProps {
  turnos: ShiftVolume[];
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

export const DonutShiftChart: React.FC<DonutShiftChartProps> = ({ turnos }) => {
  const layout = computeDonutLayout(turnos);
  const { width, height, cx, cy, outerR, innerR, total, slices } = layout;

  if (total <= 0 || slices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[330px] h-auto"
          role="img"
          aria-label="Gráfico de entrega por turno sem dados"
        >
          <circle
            cx={cx}
            cy={cy}
            r={(outerR + innerR) / 2}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={outerR - innerR}
          />
          <text x={cx} y={cy + 4} textAnchor="middle" fill="#64748B" fontSize="12" fontWeight="700">
            Sem dados no filtro
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[330px] h-auto"
        role="img"
        aria-label="Gráfico de entrega por turno em litros"
      >
        {slices.map((s) => (
          <path
            key={s.name}
            d={describeDonutArc(cx, cy, outerR, innerR, s.startAngle, s.endAngle)}
            fill={s.color}
          />
        ))}

        {slices.map(
          (s) =>
            s.needsLeader && (
              <g key={`${s.name}-leader`}>
                <line
                  x1={s.anchorX}
                  y1={s.anchorY}
                  x2={s.callX}
                  y2={s.callY}
                  stroke="#475569"
                  strokeWidth={1.4}
                />
                <circle cx={s.anchorX} cy={s.anchorY} r={2.5} fill="#FFFFFF" stroke="#475569" strokeWidth={1.2} />
              </g>
            )
        )}

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
