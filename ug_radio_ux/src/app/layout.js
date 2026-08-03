import "./globals.css";
import { NavBar } from "./components/components";
import { SprayBackground } from "./components/SprayBackground";
import { ThemeInit } from "./components/ThemeInit";
import { PlayerProvider } from "./lib/player-context";
import { NowPlayingBar } from "./components/library-components/NowPlayingBar";

export const metadata = {
  title: "UNDERGROUNDRADIO",
  description: "STREAM YOUR JUUGS TODAY",
};

// WE WANT A FLOATING NAV BAR WITH
// HOME TAB/ LIBRARY TAB // music playing tab
//  WITH UGR BACKGROUND

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="relative min-h-dvh">
        <ThemeInit />
        <div className="pointer-events-none fixed inset-0 z-0">
          <SprayBackground />
        </div>
        <PlayerProvider>
          <div className="relative z-10">
            <NavBar />
            {children}
            <NowPlayingBar />
          </div>
        </PlayerProvider>
      </body>
    </html>
  );
}

