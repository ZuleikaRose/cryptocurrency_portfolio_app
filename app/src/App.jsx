import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Alerts from "./pages/Alerts.jsx";
import CoinDetail from "./pages/CoinDetail.jsx";
import Explore from "./pages/Explore.jsx";
import Fundraising from "./pages/Fundraising.jsx";
import FundProfile from "./pages/FundProfile.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Logout, { AccountDeleted } from "./pages/Logout.jsx";
import Market from "./pages/Market.jsx";
import ForgotPassword, { ResetPassword } from "./pages/Password.jsx";
import Portfolio, { Holding } from "./pages/Portfolio.jsx";
import Search from "./pages/Search.jsx";
import Settings from "./pages/Settings.jsx";
import TokenSales from "./pages/TokenSales.jsx";
import Unlocks from "./pages/Unlocks.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import Affiliate from "./pages/Affiliate.jsx";
import AiFeatures from "./pages/AiFeatures.jsx";
import Faqs from "./pages/Faqs.jsx";
import Feedback from "./pages/Feedback.jsx";
import Terms, { AccessibilityPolicy, Privacy } from "./pages/Legal.jsx";
import Promotions from "./pages/Promotions.jsx";
import ReportIssue from "./pages/ReportIssue.jsx";
import Support from "./pages/Support.jsx";
import TechRequirements from "./pages/TechRequirements.jsx";
import Placeholder, { NotFound } from "./pages/Placeholder.jsx";
import { pages } from "./routes.js";

// Pages built so far; everything else renders its Phase 0 placeholder.
const built = {
  "/": Home,
  "/alerts": Alerts,
  "/login": Login,
  "/signup": Login,
  "/forgot-password": ForgotPassword,
  "/reset-password": ResetPassword,
  "/logout": Logout,
  "/settings": Settings,
  "/support": Support,
  "/faqs": Faqs,
  "/report-issue": ReportIssue,
  "/feedback": Feedback,
  "/promotions": Promotions,
  "/affiliate": Affiliate,
  "/technical-requirements": TechRequirements,
  "/ai": AiFeatures,
  "/terms": Terms,
  "/privacy": Privacy,
  "/accessibility-policy": AccessibilityPolicy,
  "/market": Market,
  "/coins/:slug": CoinDetail,
  "/search": Search,
  "/watchlist": Watchlist,
  "/portfolio": Portfolio,
  "/portfolio/:slug": Holding,
  "/explore": Explore,
  "/fundraising": Fundraising,
  "/funds/:slug": FundProfile,
  "/unlocks": Unlocks,
  "/token-sales": TokenSales,
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
        <Route path="account-deleted" element={<AccountDeleted />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
