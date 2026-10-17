// Allocation donut (11-portfolio.md) with a legend; colours never carry meaning alone.
const donutColors = ["#8b7cf8", "#3d7bff", "#22c55e", "#f5a524", "#ec4899", "#06b6d4", "#8a909c"];

export default function Donut({ slices, size = 120 }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const radius = 15.915; // circumference ≈ 100, so dash lengths are percentages
  const offsets = slices.map((_, index) => 25 - slices.slice(0, index).reduce((sum, slice) => sum + (slice.value / total) * 100, 0));
  return (
    <figure className="donut">
      <svg
        viewBox="0 0 42 42"
        width={size}
        height={size}
        role="img"
        aria-label={`Allocation: ${slices.map((slice) => `${slice.label} ${((slice.value / total) * 100).toFixed(1)} percent`).join(", ")}`}
      >
        <circle cx="21" cy="21" r={radius} fill="none" stroke="var(--line-soft)" strokeWidth="6" />
        {slices.map((slice, index) => {
          const pct = (slice.value / total) * 100;
          const dash = `${Math.max(pct - 0.6, 0)} ${100 - Math.max(pct - 0.6, 0)}`;
          return (
            <circle
              key={slice.label}
              cx="21"
              cy="21"
              r={radius}
              fill="none"
              stroke={donutColors[index % donutColors.length]}
              strokeWidth="6"
              strokeDasharray={dash}
              strokeDashoffset={offsets[index]}
            />
          );
        })}
      </svg>
      <figcaption>
        <ul className="donut-legend">
          {slices.map((slice, index) => (
            <li key={slice.label}>
              <span className="legend-swatch" style={{ background: donutColors[index % donutColors.length] }} aria-hidden="true" />
              <span>{slice.label}</span>
              <span className="num">{((slice.value / total) * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
