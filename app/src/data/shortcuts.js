// Keyboard shortcuts that the app implements (AppShell, CoinDetail, PriceChart, Sheet).
// Shown in Settings, the shortcuts sheet (?) and the Accessibility policy.
export const shortcuts = [
  { keys: "⌘ K / Ctrl+K, /", action: "Open search" },
  { keys: "Esc", action: "Close dialog or menu" },
  { keys: "Alt+A", action: "Accessibility menu" },
  { keys: "1–6", action: "Chart range 1D…ALL (on a coin)" },
  { keys: "← →", action: "Move chart crosshair; switch tabs" },
  { keys: "?", action: "Shortcuts help" },
];
