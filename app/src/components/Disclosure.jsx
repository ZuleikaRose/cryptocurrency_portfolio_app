import { useId, useState } from "react";
import Icon from "./Icon.jsx";

// Wraps every case-insensitive match of `term` in <mark> (FAQ search, US-P18.1).
export function Highlight({ text, term }) {
  const query = term?.trim();
  if (!query || query.length < 2) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part));
}

// Accordion item: a real button with aria-expanded (Enter/Space work natively).
export default function Disclosure({ title, children, defaultOpen = false, forceOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const expanded = open || forceOpen;
  return (
    <div className="disclosure">
      <h3>
        <button type="button" className="disclosure-button" aria-expanded={expanded} aria-controls={id} onClick={() => setOpen(!expanded)}>
          <Icon name="chevron" className={expanded ? "icon turned" : "icon"} />
          <span>{title}</span>
        </button>
      </h3>
      <div id={id} className="disclosure-body" hidden={!expanded}>
        {children}
      </div>
    </div>
  );
}
