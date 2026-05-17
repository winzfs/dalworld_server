export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function normalize(dx: number, dy: number): { x: number; y: number } {
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, maxExclusive: number): number {
  return Math.floor(min + Math.random() * (maxExclusive - min));
}
