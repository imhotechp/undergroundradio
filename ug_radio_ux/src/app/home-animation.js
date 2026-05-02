import {createSVG} from "./svg.js";
import {motion} from 'framer-motion';

"use client"
export default function BackgroundText(){
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
