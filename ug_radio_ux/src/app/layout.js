import "./globals.css";
import { NavBar } from "./components/components";
import { SprayBackground } from "./components/SprayBackground";

export const metadata = {
  title: "UNDERGROUNDRADIO",
  description: "STREAM YOUR JUUGS TODAY",
};

// WE WANT A FLOATING NAV BAR WITH 
// HOME TAB/ LIBRARY TAB // music playing tab
//  WITH UGR BACKGROUND 

// ability to change theme here

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="relative min-h-dvh">
        <div className="pointer-events-none fixed inset-0 z-0">
          <SprayBackground />
        </div>
        <div className="relative z-10">
          <NavBar />
          {children}
        </div>
      </body>
    </html>
  );
}

