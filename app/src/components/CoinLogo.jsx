// Letter logo in a tinted circle (wireframe); fallback for coins without artwork.
export default function CoinLogo({ coin, size = "md" }) {
  return (
    <span className={`coin-logo coin-logo-${size} tint-${coin.tint}`} aria-hidden="true">
      {coin.symbol[0]}
    </span>
  );
}
