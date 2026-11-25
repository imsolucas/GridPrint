"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Theme = "dark" | "paper";

export default function AppHeader() {
  const path = usePathname();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "paper" ? "paper" : "dark");
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "paper" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("gp-theme", next);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  }

  return (
    <header className="gp-header">
      <Link className="gp-wordmark" href="/" aria-label="GRID PRINT, Studio">
        <span className="gp-flag" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
        GRID<b>·</b>PRINT
      </Link>
      <nav className="gp-nav" aria-label="Main">
        <Link href="/" aria-current={path === "/" ? "page" : undefined}>
          Studio
        </Link>
        <Link href="/gallery" aria-current={path.startsWith("/gallery") ? "page" : undefined}>
          Gallery
        </Link>
      </nav>
      <span className="gp-local">Local · data/ on this machine</span>
      <button
        type="button"
        className="gp-btn gp-btn--ghost gp-btn--sm gp-theme"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "Paper" : "Studio dark"} theme`}
      >
        {theme === "dark" ? "Paper" : "Dark"}
      </button>
    </header>
  );
}
