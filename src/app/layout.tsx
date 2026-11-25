import type { Metadata, Viewport } from "next";
import "./tokens.css";
import "./globals.css";
import AppHeader from "@/components/app-header";

export const metadata: Metadata = {
  title: "GRID PRINT",
  description: "Print-ready F1 lap posters from real OpenF1 data.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0b0e" };

// Applies the saved theme before first paint so Paper users never see a dark flash.
const themeScript = `try{var t=localStorage.getItem("gp-theme");if(t==="paper"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,400;100,500;100,600;100,700;100,800;125,800&display=swap"
        />
      </head>
      <body className="gp">
        <a className="gp-skip" href="#main">Skip to content</a>
        <div className="gp-app">
          <AppHeader />
          <main id="main" className="gp-main">{children}</main>
          <footer className="gp-footer">
            Lap data from{" "}
            <a href="https://openf1.org" target="_blank" rel="noreferrer">
              OpenF1
            </a>
            . Unofficial fan project, not associated with Formula 1. Circuit outlines are traced from sampled car positions.
          </footer>
        </div>
      </body>
    </html>
  );
}
