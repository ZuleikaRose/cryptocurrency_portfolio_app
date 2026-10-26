import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AppProvider } from "./state/AppStore.jsx";
import { registerServiceWorker, watchInstallPrompt } from "./lib/pwa.js";
import { detectLanguage, loadDictionary } from "./lib/i18n.js";

watchInstallPrompt();
registerServiceWorker();

// A Spanish or Portuguese browser gets its dictionary before the first paint, so the app doesn't
// flash English; if it can't load, the app opens in English.
loadDictionary(detectLanguage()).catch(() => {}).finally(render);

function render() {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
