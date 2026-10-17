import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Market from "./pages/Market.jsx";
import Placeholder, { NotFound } from "./pages/Placeholder.jsx";
import { pages } from "./routes.js";

// Pages built so far; everything else renders its Phase 0 placeholder.
const built = { "/market": Market };

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {pages.map((page) => {
          const Page = built[page.path];
          const element = Page ? <Page /> : <Placeholder page={page} />;
          return page.path === "/" ? (
            <Route key={page.path} index element={element} />
          ) : (
            <Route key={page.path} path={page.path} element={element} />
          );
        })}
        <Route path="favorites" element={<Navigate to="/watchlist" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
