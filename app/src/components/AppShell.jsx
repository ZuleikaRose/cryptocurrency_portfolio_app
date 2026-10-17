import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";
import Sheet from "./Sheet.jsx";
import { DemoBanner, SignInSheet, Toasts } from "./GlobalOverlays.jsx";
import { menuGroups, pagesInGroup, tabs } from "../routes.js";

function TopBar({ onOpenMenu, onOpenA11y }) {
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="CPA, Cryptocurrency Portfolio App — home">
        <span className="brand-mark" aria-hidden="true">C</span>
        <span>CPA</span>
      </Link>
      <div className="top-actions">
        <Link to="/search" className="icon-button" aria-label="Search (⌘K)">
          <Icon name="search" />
        </Link>
        <button className="icon-button" onClick={onOpenA11y} aria-label="Accessibility menu">
          <Icon name="accessibility" />
        </button>
        <Link to="/alerts" className="icon-button" aria-label="Alerts">
          <Icon name="bell" />
        </Link>
        <button className="icon-button" onClick={onOpenMenu} aria-label="Open menu">
          <Icon name="menu" />
        </button>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.path === "/"}
          className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          aria-label={tab.title ?? tab.label}
        >
          {({ isActive }) => (
            <>
              <Icon name={tab.icon} filled={isActive && tab.icon === "star"} />
              <span aria-hidden="true">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="footer-disclaimer">Not financial advice. Data provided for informational purposes.</p>
      <nav aria-label="Footer">
        {[...pagesInGroup("legal"), ...pagesInGroup("help").slice(0, 2)].map((page) => (
          <Link key={page.path} to={page.path}>{page.title}</Link>
        ))}
      </nav>
      <p className="footer-meta">© 2026 CPA · Cryptocurrency Portfolio App</p>
    </footer>
  );
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeA11y = useCallback(() => setA11yOpen(false), []);

  // New page: start at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // ⌘K / Ctrl+K opens search from anywhere (US-2.5).
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        navigate("/search");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="phone">
        <TopBar onOpenMenu={() => setMenuOpen(true)} onOpenA11y={() => setA11yOpen(true)} />
        <DemoBanner />
        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
        <SiteFooter />
        <BottomNav />
      </div>

      <Toasts />
      <SignInSheet />

      <Sheet open={menuOpen} onClose={closeMenu} title="Menu">
        {menuGroups.map((group) => (
          <section key={group.id} className="menu-group">
            <h3>{group.title}</h3>
            <ul>
              {pagesInGroup(group.id).map((page) => (
                <li key={page.path}>
                  <Link to={page.path} className="menu-link" onClick={closeMenu}>
                    {page.title}
                    <Icon name="chevron" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Sheet>

      <Sheet open={a11yOpen} onClose={closeA11y} title="Accessibility" side="bottom">
        <p className="sheet-note">
          Text size, contrast, motion, reading guide and the other settings arrive in Phase 7.
        </p>
        <Link to="/accessibility-policy" className="menu-link" onClick={closeA11y}>
          Read the accessibility policy
          <Icon name="chevron" />
        </Link>
      </Sheet>
    </div>
  );
}
