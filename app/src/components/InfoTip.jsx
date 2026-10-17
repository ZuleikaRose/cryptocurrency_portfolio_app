import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { definitions } from "../data/glossary.js";


export default function InfoTip({ term, label }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="infotip">
      <button className="infotip-button" aria-expanded={open} aria-controls={id} aria-label={`What is ${label}?`} onClick={() => setOpen((value) => !value)}>
        <Icon name="info" />
      </button>
      {open && (
        <span id={id} className="infotip-body" role="note">
          {definitions[term]}
        </span>
      )}
    </span>
  );
}
