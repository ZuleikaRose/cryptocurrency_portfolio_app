import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

// Modal panel used for the menu drawer and bottom sheets.
// Closes on Escape or backdrop click, traps Tab focus, and returns focus to the opener.
export default function Sheet({ open, onClose, title, side = "right", children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector("button, a, input, select, textarea")?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll("button, a[href], input, select, textarea, [tabindex='0']");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`sheet-layer sheet-${side}`}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section ref={panelRef} className="sheet-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
