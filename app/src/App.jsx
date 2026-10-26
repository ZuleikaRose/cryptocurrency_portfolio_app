import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Home from "./pages/Home.jsx";
import NotFound from "./pages/NotFound.jsx";
import { pages } from "./routes.js";

// Pages load on demand (Home, the landing page, ships with the app); AppShell shows a skeleton
// while one loads. `page(load, name)` picks a named export.
const page = (load, name = "default") => lazy(() => load().then((module) => ({ default: module[name] })));
const Alerts = page(() => import("./pages/Alerts.jsx"));
const CoinDetail = page(() => import("./pages/CoinDetail.jsx"));
const Explore = page(() => import("./pages/Explore.jsx"));
const Fundraising = page(() => import("./pages/Fundraising.jsx"));
const FundProfile = page(() => import("./pages/FundProfile.jsx"));
const Login = page(() => import("./pages/Login.jsx"));
const Logout = page(() => import("./pages/Logout.jsx"));
const AccountDeleted = page(() => import("./pages/Logout.jsx"), "AccountDeleted");
const Market = page(() => import("./pages/Market.jsx"));
const ForgotPassword = page(() => import("./pages/Password.jsx"));
const ResetPassword = page(() => import("./pages/Password.jsx"), "ResetPassword");
const Portfolio = page(() => import("./pages/Portfolio.jsx"));
const Holding = page(() => import("./pages/Portfolio.jsx"), "Holding");
const Search = page(() => import("./pages/Search.jsx"));
const Settings = page(() => import("./pages/Settings.jsx"));
const TokenSales = page(() => import("./pages/TokenSales.jsx"));
const Unlocks = page(() => import("./pages/Unlocks.jsx"));
const Watchlist = page(() => import("./pages/Watchlist.jsx"));
const Affiliate = page(() => import("./pages/Affiliate.jsx"));
const AiFeatures = page(() => import("./pages/AiFeatures.jsx"));
const Faqs = page(() => import("./pages/Faqs.jsx"));
const Feedback = page(() => import("./pages/Feedback.jsx"));
const Terms = page(() => import("./pages/Legal.jsx"));
const AccessibilityPolicy = page(() => import("./pages/Legal.jsx"), "AccessibilityPolicy");
const Privacy = page(() => import("./pages/Legal.jsx"), "Privacy");
const Promotions = page(() => import("./pages/Promotions.jsx"));
const ReportIssue = page(() => import("./pages/ReportIssue.jsx"));
const Support = page(() => import("./pages/Support.jsx"));
const TechRequirements = page(() => import("./pages/TechRequirements.jsx"));

// Route path → page component; the paths and titles live in routes.js.
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
          const element = <Page />;
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
