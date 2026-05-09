import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BackgroundText from "./home-animation";
import {NavBar} from "./components/components";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
          <div className='fixed inset-0 -z-10  pointer-events-none'>
            <BackgroundText/>
            <div>
            </div >
              <NavBar/>
               {children}
            </div>
         
      </body>
    </html>
  );
}

