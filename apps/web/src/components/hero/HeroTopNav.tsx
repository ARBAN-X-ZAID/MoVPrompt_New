import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import logoMark from "@/assets/logo-mark-white.svg";
import { useTheme } from "@/components/ThemeProvider";
import { isFeatureEnabled } from "@/config/features";

const navigation = [
  { label: "Templates", href: "#templates" },
  { label: "Showcase", href: "#campaign-system" },
];

export const HeroTopNav = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";
  const developmentFreeGeneration = import.meta.env.DEV && isFeatureEnabled("developmentFreeGeneration");

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: KeyboardEvent | UIEvent) => {
      if ((event instanceof KeyboardEvent && event.key === "Escape") || window.innerWidth > 1100) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("keydown", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menuOpen]);

  return (
    <header className="mp-header">
      <nav className="mp-container mp-nav" aria-label="Main navigation">
        <a href="#top" className="mp-brand" aria-label="MovPrompt home">
          <img src={logoMark} alt="" width="28" height="28" />
          <span>MovPrompt</span>
        </a>

        <div className="mp-nav-links" role="group" aria-label="Homepage sections">
          {navigation.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
          {/* Advanced Mode navigation is deferred until the workspace is release-ready. */}
          {!developmentFreeGeneration && <Link to="/pricing">Pricing</Link>}
        </div>

        <div className="mp-nav-actions">
          <button
            className="mp-theme-toggle"
            type="button"
            aria-label={`Switch to ${nextTheme} mode`}
            title={`Switch to ${nextTheme} mode`}
            onClick={toggleTheme}
          >
            {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </button>
          <Link className="mp-sign-in" to="/auth">
            Sign in
          </Link>
          <Link className="mp-button mp-button-light" to="/create">
            Start creating
          </Link>
        </div>

        <div className="mp-mobile-nav-actions">
          <button
            className="mp-theme-toggle"
            type="button"
            aria-label={`Switch to ${nextTheme} mode`}
            title={`Switch to ${nextTheme} mode`}
            onClick={toggleTheme}
          >
            {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </button>
          <button
            className="mp-menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mp-mobile-menu"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <div id="mp-mobile-menu" className="mp-mobile-menu" data-open={menuOpen} hidden={!menuOpen}>
        <div className="mp-container mp-mobile-menu-inner">
          {navigation.map((item) => (
            <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
          {/* Advanced Mode navigation is deferred until the workspace is release-ready. */}
          {!developmentFreeGeneration && <Link to="/pricing" onClick={() => setMenuOpen(false)}>
            Pricing
          </Link>}
          <button className="mp-mobile-theme-row" type="button" onClick={toggleTheme}>
            {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            Use {nextTheme} mode
          </button>
          <div className="mp-mobile-menu-actions">
            <Link className="mp-button mp-button-secondary" to="/auth" onClick={() => setMenuOpen(false)}>
              Sign in
            </Link>
            <Link className="mp-button mp-button-light" to="/create" onClick={() => setMenuOpen(false)}>
              Start creating
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
