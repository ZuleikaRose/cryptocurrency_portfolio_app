import { allocationColors, TODAY } from "../data/research.js";
import { formatTokens } from "../lib/format.js";

const WIDTH = 400;
const HEIGHT = 170;

// Stacked area of cumulative unlocked tokens by allocation, with a "Today" line (US-3.4).
export default function VestingChart({ vesting, events, symbol }) {
  const names = vesting.allocations.map((allocation) => allocation.name);
  const start = vesting.tge.getTime();
  const end = Math.max(...events.map((event) => event.date.getTime()), TODAY.getTime());

  // Sample monthly cumulative totals per allocation.
  const samples = [];
  const steps = 48;
  for (let i = 0; i <= steps; i += 1) {
    const time = start + ((end - start) * i) / steps;
    const totals = Object.fromEntries(names.map((name) => [name, 0]));
    events.forEach((event) => {
      if (event.date.getTime() <= time) totals[event.allocation] += event.amount;
    });
    samples.push({ time, totals });
  }

  const x = (time) => ((time - start) / (end - start)) * WIDTH;
  const y = (value) => HEIGHT - (value / vesting.total) * (HEIGHT - 8);

  // Each layer sits on top of the cumulative total of the layers before it.
  const layers = names.map((name, layerIndex) => {
    const below = samples.map((sample) => names.slice(0, layerIndex).reduce((sum, other) => sum + sample.totals[other], 0));
    const top = samples.map((sample, index) => below[index] + sample.totals[name]);
    const path = [
      ...samples.map((sample, index) => `${x(sample.time).toFixed(1)},${y(top[index]).toFixed(1)}`),
      ...samples.map((sample, index) => `${x(sample.time).toFixed(1)},${y(below[index]).toFixed(1)}`).reverse(),
    ].join(" ");
    return { name, path };
  });

  const todayX = x(TODAY.getTime());
  const unlockedToday = events.filter((event) => event.date <= TODAY).reduce((sum, event) => sum + event.amount, 0);
  const fmt = (time) => new Date(time).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <figure className="vesting">
      <div
        className="vesting-plot"
        role="img"
        aria-label={`Vesting schedule from ${fmt(start)} to ${fmt(end)}. ${((unlockedToday / vesting.total) * 100).toFixed(1)} percent of the ${formatTokens(vesting.total)} ${symbol} supply is unlocked today.`}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
          {layers.map((layer) => (
            <polygon key={layer.name} points={layer.path} fill={allocationColors[layer.name]} fillOpacity="0.55" stroke={allocationColors[layer.name]} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <line className="today-line" x1={todayX} x2={todayX} y1="0" y2={HEIGHT} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="today-label" style={{ left: `${(todayX / WIDTH) * 100}%` }}>Today</span>
      </div>
      <figcaption className="vesting-axis num">
        <span>{fmt(start)}</span>
        <span>{fmt(end)}</span>
      </figcaption>
      <ul className="vesting-legend">
        {vesting.allocations.map((allocation) => (
          <li key={allocation.name}>
            <span className="legend-swatch" style={{ background: allocationColors[allocation.name] }} aria-hidden="true" />
            {allocation.name} <span className="num">{(allocation.share * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
