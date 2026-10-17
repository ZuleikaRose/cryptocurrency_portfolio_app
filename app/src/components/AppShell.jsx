import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";
import Sheet from "./Sheet.jsx";
import { DemoBanner, SignInSheet, Toasts } from "./GlobalOverlays.jsx";
import SearchOverlay from "./SearchOverlay.jsx";
import AccessibilityMenu from "./AccessibilityMenu.jsx";
import ReadingGuide from "./ReadingGuide.jsx";
import { shortcuts } from "../data/shortcuts.js";
import { useApp } from "../state/context.js";
import { menuGroups, pagesInGroup, tabs } from "../routes.js";

function TopBar({ onOpenMenu, onOpenA11y, onOpenSearch }) {
  const { session, unreadCount, requireAuth } = useApp();
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="CPA, Cryptocurrency Portfolio App — home">
        <span className="brand-mark" aria-hidden="true">C</span>
        <span>CPA</span>
      </Link>
      <div className="top-actions">
        <button className="icon-button" onClick={onOpenSearch} aria-label="Search" aria-keyshortcuts="Control+K Meta+K /">
          <Icon name="search" />
        </button>
        <button id="a11y-button" className="icon-button" onClick={onOpenA11y} aria-label="Accessibility menu" aria-keyshortcuts="Alt+A">
          <Icon name="accessibility" />
        </button>
        <Link
          to="/alerts"
          className="icon-button bell-button"
          aria-label={unreadCount ? `Alerts, ${unreadCount} unread` : "Alerts"}
          onClick={(event) => {
            if (session.kind !== "guest") return;
            event.preventDefault();
            requireAuth("Sign in to see your alerts", () => navigate("/alerts"));
          }}
        >
          <Icon name="bell" />
          {unreadCount > 0 && <span className="bell-badge num" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
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

  const location = useLocation();
  const { openSearch, session, settings, accessibilityOpen: a11yOpen, setAccessibilityOpen: setA11yOpen } = useApp();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeA11y = useCallback(() => setA11yOpen(false), [setA11yOpen]);
  // Signed-in and demo users see Log out instead of Log in; guests don't see Log out.
  const menuPages = (group) =>
    pagesInGroup(group.id)
      .filter((page) => !(page.path === "/login" && session.kind !== "guest"))
      .concat(group.id === "account" && session.kind !== "guest" ? [{ path: "/logout", title: session.kind === "demo" ? "End demo" : "Log out" }] : []);

  // New page: start at the top, unless the link targets an anchor (e.g. /explore#market-pulse).
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  // ⌘K / Ctrl+K, or "/" outside a text field, opens search from anywhere (US-2.5).
  useEffect(() => {
    const onKeyDown = (event) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable;
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") || (event.key === "/" && !typing)) {
        event.preventDefault();
        openSearch();
      }
      // Alt+A: accessibility menu. Focus the ♿ button first so closing returns focus there (US-P27.5).
      // event.code, because Alt+A types "å" on macOS.
      if (event.altKey && event.code === "KeyA") {
        event.preventDefault();
        document.getElementById("a11y-button")?.focus();
        setA11yOpen(true);
      }
      if (event.key === "?" && !typing) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openSearch, setA11yOpen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="phone">
        <TopBar onOpenMenu={() => setMenuOpen(true)} onOpenA11y={() => setA11yOpen(true)} onOpenSearch={() => openSearch()} />
        <DemoBanner />
        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
        <SiteFooter />
        <BottomNav />
      </div>

      <Toasts />
      <SignInSheet />
      <SearchOverlay />

      <Sheet open={menuOpen} onClose={closeMenu} title="Menu">
        {menuGroups.map((group) => (
          <section key={group.id} className="menu-group">
            <h3>{group.title}</h3>
            <ul>
              {menuPages(group).map((page) => (
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

      <AccessibilityMenu
        open={a11yOpen}
        onClose={closeA11y}
        onShowShortcuts={() => {
          closeA11y();
          setShortcutsOpen(true);
        }}
      />
      <Sheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Keyboard shortcuts" side="bottom">
        <table className="shortcut-table">
          <tbody>
            {shortcuts.map((item) => (
              <tr key={item.keys}>
                <th scope="row"><kbd>{item.keys}</kbd></th>
                <td>{item.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sheet>
      {settings.a11y.readingGuide && <ReadingGuide />}
    </div>
  );
}
