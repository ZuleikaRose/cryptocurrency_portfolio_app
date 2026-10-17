import { useMemo, useState } from "react";
import { chartSummary, formatChartTime } from "../lib/chart.js";
import { formatPercent, formatPrice } from "../lib/format.js";
import { toCandles } from "../data/research.js";

const WIDTH = 400;
const HEIGHT = 190;
const PAD_TOP = 14;
const PAD_BOTTOM = 18;

const markerMeta = {
  unlock: { letter: "U", label: "Unlock" },
  funding: { letter: "F", label: "Funding" },
  listing: { letter: "L", label: "Listing" },
};

// Interactive SVG price chart (US-3.1, US-3.2). Pointer drag or ←/→ moves the crosshair.
export default function PriceChart({ points, rangeId, mode = "line", markers = [], showMarkers = false, onMarker, currency, rate, label, mask = false, name = "Price" }) {
  // Hide balances (US-P11.1): every value reads ••••, the % change stays visible.
  const money = (value) => (mask ? "••••" : formatPrice(value, currency, rate));
  const [active, setActive] = useState(null);

  const { min, max, x, y } = useMemo(() => {
    const prices = points.map((point) => point.price);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const pad = (hi - lo) * 0.08 || hi * 0.01;
    const t0 = points[0].time;
    const t1 = points[points.length - 1].time;
    return {
      min: lo,
      max: hi,
      x: (time) => ((time - t0) / (t1 - t0 || 1)) * WIDTH,
      y: (price) => PAD_TOP + (1 - (price - (lo - pad)) / (hi + pad - (lo - pad))) * (HEIGHT - PAD_TOP - PAD_BOTTOM),
    };
  }, [points]);

  const up = points[points.length - 1].price >= points[0].price;
  const line = points.map((point) => `${x(point.time).toFixed(1)},${y(point.price).toFixed(1)}`).join(" ");
  const area = `0,${HEIGHT} ${line} ${WIDTH},${HEIGHT}`;
  const candles = mode === "candle" ? toCandles(points) : [];
  const candleWidth = (WIDTH / Math.max(candles.length, 1)) * 0.6;

  const point = active != null ? points[active] : null;
  const change = ((points[points.length - 1].price - points[0].price) / points[0].price) * 100;

  const indexFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    return Math.round(ratio * (points.length - 1));
  };

  const onKeyDown = (event) => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowRight") setActive((current) => Math.min((current ?? points.length - 1) + step, points.length - 1));
    else if (event.key === "ArrowLeft") setActive((current) => Math.max((current ?? points.length - 1) - step, 0));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(points.length - 1);
    else if (event.key === "Escape") setActive(null);
    else return;
    event.preventDefault();
  };

  const visibleMarkers = showMarkers
    ? markers.filter((marker) => marker.time >= points[0].time && marker.time <= points[points.length - 1].time)
    : [];

  return (
    <div className="chart">
      <div className="chart-readout num" aria-hidden="true">
        {point ? (
          <>
            <strong>{money(point.price)}</strong>
            <span>{formatChartTime(point.time, rangeId)}</span>
          </>
        ) : (
          <>
            <strong>{money(points[points.length - 1].price)}</strong>
            <span className={up ? "up" : "down"}>{formatPercent(change)} · {label}</span>
          </>
        )}
      </div>

      <div className="chart-frame">
        <div
          className="chart-surface"
          role="img"
          tabIndex={0}
          aria-label={mask ? `${name} chart. Values hidden.` : `${name} chart. ${chartSummary(points, label, currency, rate)} Use left and right arrow keys to read values.`}
          onPointerMove={(event) => setActive(indexFromEvent(event))}
          onPointerDown={(event) => setActive(indexFromEvent(event))}
          onPointerLeave={(event) => event.pointerType === "mouse" && setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className={up ? "chart-up" : "chart-down"}>
              {mode === "line" ? (
                <>
                  <polygon points={area} fill="url(#chart-fill)" />
                  <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </>
              ) : (
                candles.map((candle) => {
                  const cx = x(candle.time) + candleWidth / 2;
                  const rising = candle.close >= candle.open;
                  return (
                    <g key={candle.time} className={rising ? "candle-up" : "candle-down"}>
                      <line x1={cx} x2={cx} y1={y(candle.high)} y2={y(candle.low)} stroke="currentColor" vectorEffect="non-scaling-stroke" />
                      <rect
                        x={cx - candleWidth / 2}
                        width={candleWidth}
                        y={y(Math.max(candle.open, candle.close))}
                        height={Math.max(Math.abs(y(candle.open) - y(candle.close)), 1)}
                        fill="currentColor"
                      />
                    </g>
                  );
                })
              )}
            </g>
            {point && (
              <g className="crosshair">
                <line x1={x(point.time)} x2={x(point.time)} y1={0} y2={HEIGHT} vectorEffect="non-scaling-stroke" />
                <line x1={0} x2={WIDTH} y1={y(point.price)} y2={y(point.price)} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </svg>
          {point && <span className="crosshair-dot" style={{ left: `${(x(point.time) / WIDTH) * 100}%`, top: `${(y(point.price) / HEIGHT) * 100}%` }} />}
          <span className="axis-label axis-high num">{money(max)}</span>
          <span className="axis-label axis-low num">{money(min)}</span>
        </div>

        {visibleMarkers.map((marker) => (
          <button
            key={marker.id}
            className={`chart-marker marker-${marker.kind}`}
            style={{ left: `${(x(marker.time) / WIDTH) * 100}%` }}
            onClick={() => onMarker(marker)}
            aria-label={`${markerMeta[marker.kind].label} event, ${new Date(marker.time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
          >
            <span aria-hidden="true">{markerMeta[marker.kind].letter}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
