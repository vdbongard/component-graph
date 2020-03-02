export function isColliding(r1, r2) {
  const r1Left = r1.x;
  const r1Right = r1.x + r1.width;
  const r2Left = r2.x;
  const r2Right = r2.x + r2.width;

  const r1Top = r1.y;
  const r1Bottom = r1.y + r1.height;
  const r2Top = r2.y;
  const r2Bottom = r2.y + r2.height;

  return r1Right > r2Left && r1Left < r2Right && r1Bottom > r2Top && r1Top < r2Bottom;
}
