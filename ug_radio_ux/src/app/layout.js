import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {BackgroundText, ObjectSpace} from "./home-animation";
import {NavBar} from "./components/components";

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
          <div className='pointer-events-none'>
          {/* ADD BACKGROUND COMPONENT HERE */}
            </div>
            <div>
              <NavBar/>
               {children}
            </div>
         
      </body>
    </html>
  );
}

