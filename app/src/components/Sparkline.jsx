// 7-day sparkline (style guide §7.1), coloured by 7-day direction. Decorative: the
// row's accessible label carries the numbers.
export default function Sparkline({ points, down = false, width = 72, height = 32, className = "spark" }) {
  if (!points?.length) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = (width - 8) / (points.length - 1);
  const coords = points
    .map((value, index) => `${(4 + index * step).toFixed(1)},${(height - 4 - ((value - min) / span) * (height - 8)).toFixed(1)}`)
    .join(" ");

  return (
    <svg aria-hidden="true" className={down ? `${className} spark-down` : className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
