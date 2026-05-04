"use client"
import {createSVG} from "./svg.js";
import {motion,} from 'framer-motion';


export default function BackgroundText(){
  const SVG = createSVG() 
  return (
  <>
  <motion.svg  className="full-screen-svg" viewBox="-500 1000 3000 1200">
    {SVG.map((d, i) => (
      <motion.path key={i} d={d} animate={{d: d}}/>
    ))}
  </motion.svg>
  </>
  )
}
