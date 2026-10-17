import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import CoinDetail from "./pages/CoinDetail.jsx";
import Market from "./pages/Market.jsx";
import Portfolio, { Holding } from "./pages/Portfolio.jsx";
import Search from "./pages/Search.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import Placeholder, { NotFound } from "./pages/Placeholder.jsx";
import { pages } from "./routes.js";

// Pages built so far; everything else renders its Phase 0 placeholder.
const built = {
  "/market": Market,
  "/coins/:slug": CoinDetail,
  "/search": Search,
  "/watchlist": Watchlist,
  "/portfolio": Portfolio,
  "/portfolio/:slug": Holding,
};

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
