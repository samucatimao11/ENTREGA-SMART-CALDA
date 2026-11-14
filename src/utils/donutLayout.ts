import type { ShiftVolume } from '../types/report';
import { formatVolumePTBR } from './formatters';

export interface DonutSliceLayout extends ShiftVolume {
  startAngle: number;
  endAngle: number;
  midAngle: number;
  anchorX: number;
  anchorY: number;
  callX: number;
  callY: number;
  boxWidth: number;
  boxHeight: number;
  formatted: string;
  calloutBg: string;
  needsLeader: boolean;
}

export interface DonutLayoutResult {
  width: number;
  height: number;
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
  total: number;
  slices: DonutSliceLayout[];
}

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

export function getCalloutBgColor(shiftName: string, sliceColor: string): string {
  if (shiftName === 'TURNO A') return '#2E2E2E';
  if (shiftName === 'TURNO B') return '#8E8E8E';
  if (shiftName === 'TURNO C') return '#3A4B61';
  return sliceColor;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function computeDonutLayout(turnos: ShiftVolume[]): DonutLayoutResult {
  const width = 360;
  const height = 252;
  const cx = 180;
  const cy = 126;
  const outerR = 88;
  const innerR = 44;
  const anchorR = (outerR + innerR) / 2;

  const validTurnos = turnos.filter((t) => t.volume > 0);
  const total = validTurnos.reduce((acc, t) => acc + t.volume, 0);

  if (total <= 0 || validTurnos.length === 0) {
    return { width, height, cx, cy, outerR, innerR, total: 0, slices: [] };
  }

  let currentAngle = 0;
  const slices: DonutSliceLayout[] = validTurnos.map((t) => {
    const angle = (t.volume / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const midAngle = startAngle + angle / 2;
    currentAngle = endAngle;

    const anchor = polarToCartesian(cx, cy, anchorR, midAngle);
    // Small wedges (< 36 deg) push outward slightly so badges have room around the ring
    const initialR = angle < 36 ? outerR + 12 : anchorR + 2;
    const initialPos = polarToCartesian(cx, cy, initialR, midAngle);

    const formatted = formatVolumePTBR(t.volume);
    const boxWidth = Math.max(78, Math.ceil(formatted.length * 7.0 + 16));
    const boxHeight = 22;

    const pad = 4;
    const callX = clamp(initialPos.x, boxWidth / 2 + pad, width - boxWidth / 2 - pad);
    const callY = clamp(initialPos.y, boxHeight / 2 + pad, height - boxHeight / 2 - pad);

    return {
      ...t,
      startAngle,
      endAngle,
      midAngle,
      anchorX: anchor.x,
      anchorY: anchor.y,
      callX,
      callY,
      boxWidth,
      boxHeight,
      formatted,
      calloutBg: getCalloutBgColor(t.name, t.color),
      needsLeader: false,
    };
  });

  // Resolve overlapping callout boxes iteratively
  const pad = 4;
  const minGap = 6;
  for (let iter = 0; iter < 80; iter++) {
    let movedAny = false;
    for (let i = 0; i < slices.length; i++) {
      for (let j = i + 1; j < slices.length; j++) {
        const a = slices[i];
        const b = slices[j];
        const reqX = (a.boxWidth + b.boxWidth) / 2 + minGap;
        const reqY = (a.boxHeight + b.boxHeight) / 2 + minGap;
        const dx = b.callX - a.callX;
        const dy = b.callY - a.callY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx < reqX && absDy < reqY) {
          movedAny = true;
          const ox = reqX - absDx;
          const oy = reqY - absDy;

          // If pinned near top or bottom boundary, horizontal separation avoids getting trapped
          const aNearEdgeY = a.callY <= a.boxHeight / 2 + pad + 4 || a.callY >= height - a.boxHeight / 2 - pad - 4;
          const bNearEdgeY = b.callY <= b.boxHeight / 2 + pad + 4 || b.callY >= height - b.boxHeight / 2 - pad - 4;

          if (ox <= oy || aNearEdgeY || bNearEdgeY) {
            const signX = dx !== 0 ? Math.sign(dx) : a.anchorX <= b.anchorX ? 1 : -1;
            const shiftX = Math.min(ox / 2 + 1, 14);
            a.callX -= signX * shiftX;
            b.callX += signX * shiftX;
            // Also give slight vertical separation if still overlapping horizontally near edges
            if (oy > 0) {
              const signY = dy !== 0 ? Math.sign(dy) : a.anchorY <= b.anchorY ? 1 : -1;
              a.callY -= signY * 2;
              b.callY += signY * 2;
            }
          } else {
            const signY = dy !== 0 ? Math.sign(dy) : a.anchorY <= b.anchorY ? 1 : -1;
            const shiftY = Math.min(oy / 2 + 1, 12);
            a.callY -= signY * shiftY;
            b.callY += signY * shiftY;
          }

          a.callX = clamp(a.callX, a.boxWidth / 2 + pad, width - a.boxWidth / 2 - pad);
          a.callY = clamp(a.callY, a.boxHeight / 2 + pad, height - a.boxHeight / 2 - pad);
          b.callX = clamp(b.callX, b.boxWidth / 2 + pad, width - b.boxWidth / 2 - pad);
          b.callY = clamp(b.callY, b.boxHeight / 2 + pad, height - b.boxHeight / 2 - pad);
        }
      }
    }
    if (!movedAny) break;
  }

  for (const s of slices) {
    const dist = Math.hypot(s.callX - s.anchorX, s.callY - s.anchorY);
    s.needsLeader = dist > 20;
  }

  return { width, height, cx, cy, outerR, innerR, total, slices };
}
