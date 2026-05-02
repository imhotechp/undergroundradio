import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {createSVG} from "./svg.js";
import motion from motion;
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <BackgroundText>
        {children}
        </BackgroundText>
        </body>
    </html>
  );
}

// ugr svgs 
function BackgroundText(){
  const SVG = createSVG() 
  return (
  <>
  <motion.svg
  viewBox="-500 1000 3000 1200"
  animate={{ viewBox: "100 0 200 200" }}>
    {SVG.map((d, i) => (
      <motion.path key={i} d={d} />
    ))}
  </motion.svg>
  </>
  )
}
