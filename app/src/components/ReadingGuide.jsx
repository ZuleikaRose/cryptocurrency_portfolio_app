import { useEffect, useRef, useState } from "react";

// Reading guide (27-accessibility-menu.md): a horizontal bar that follows the pointer.
// On touch screens the bar doesn't follow taps; drag its handle instead.
export default function ReadingGuide() {
  const [top, setTop] = useState(() => Math.round(window.innerHeight / 3));
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (event) => {
      if (event.pointerType === "mouse" || dragging.current) setTop(event.clientY);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="reading-guide" style={{ top }} aria-hidden="true">
      <span
        className="reading-guide-handle"
        onPointerDown={(event) => {
          dragging.current = true;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Capture is a nicety; window pointermove still moves the bar.
          }
        }}
      />
    </div>
  );
}
