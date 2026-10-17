import { fundById } from "../data/research.js";

// Overlapping investor logos, first three plus a "+N" count.
export default function InvestorStack({ round }) {
  const shown = round.investors.slice(0, 3);
  return (
    <span className="investor-stack" aria-label={`Investors: ${round.investors.map((id) => fundById(id)?.name).join(", ")}`}>
      {shown.map((id) => (
        <span key={id} className="square-logo small" title={fundById(id)?.name} aria-hidden="true">{fundById(id)?.name[0]}</span>
      ))}
      {round.investors.length > 3 && <span className="more" aria-hidden="true">+{round.investors.length - 3}</span>}
    </span>
  );
}
