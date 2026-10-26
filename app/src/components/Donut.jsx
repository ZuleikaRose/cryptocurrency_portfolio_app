import { locale, t } from "../lib/i18n.js";

const fixed1 = (value) => value.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
        aria-label={t("Allocation: {slices}", {
          slices: slices.map((slice) => t("{label} {value} percent", { label: slice.label, value: fixed1((slice.value / total) * 100) })).join(", "),
        })}
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
              <span className="num">{fixed1((slice.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
