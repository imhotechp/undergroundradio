"use client"
import {createSVG} from "./svg.js";


export default function BackgroundText(){


  const SVG = createSVG() 
  return (
  <svg className="full-screen-svg" viewBox="0 0 2000 2000">
    <svg>
    <defs>
      <radialGradient id='spraypaint-spray'>
        <stop offset="0%" stopColor="#FFFFFF" />  
        <stop offset="40%" stopColor="#F5F5F5" />
        <stop offset="60%" stopColor="#e0e0e0ff" /> 
        <stop offset="100%" stopColor="#8f8f8fff" />  
      </radialGradient>
    </defs>
    </svg>
    <svg>
    <circle 
    r='40' 
    cx='50' 
    cy='850'
    fill="url(#spraypaint-spray"
    filter= "blur(7px)"
    ></circle>
    </svg>
    <g>
    {SVG.map((d, i) => (
      <path 
      key={i} 
      d={d} 
      fill='white'
      transform="translate(50, -1000)"/>
    ))}
    </g>
    </svg>
  )
}
