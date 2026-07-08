"use client";
import {createSVG} from "./svg.js";
import {useGSAP} from '@gsap/react';
import {gsap} from 'gsap';
import {Canvas} from '@react-three/fiber';
import {useRef, useState, useEffect,useMemo} from 'react';
import * as THREE from "three";

gsap.registerPlugin(useGSAP);

export function BackgroundText(){
  // {path:, len:}
const SVG = useMemo(() => createSVG(), []);  // REGISTER GSAP ANIMATIONS/HOOKS
  //Refs
  const SVGpathRef = useRef([])
  const spraypaintCan = useRef();
  const timeline = gsap.timeline();
  const timelineRef = useRef(timeline);
  const [lengths, setLengths] = useState([])
  const [points, setPoints] = useState([]);
  
  // Get lengths + sampled points
  useEffect(() => {
  const pathLengths = []
  const sampledPathPoints = []
  for (let i = 0; i < SVGpathRef.current.length; i++) {
    // ACTUAL PATH REF
    const path = SVGpathRef.current[i]
    if (path) {
      // GET LENGTH FOR PATH REF
      const len = path.getTotalLength()
      pathLengths.push(len)
      const points = []
      // ITERATE OVER PATH REF LENGTH TO SAMPLE POINTS
      for(let z=0; z<=len; z+=10){
        // SAMPLE POINTS ITERATED BY 10 LENGTHS
        const point = path.getPointAtLength(z)
        // PUSH X,Y PATH REF COORDINATES 
        points.push({
          x: point.x,
          y: point.y
        })
        
      }
      // PUSH COORDINATES & LENGTHS
        sampledPathPoints.push({
        length: len,
        points
      });
    }
  }
  setLengths(pathLengths)
  setPoints(sampledPathPoints)
}, [])

  /*
  reveal svg with strokedasharray + strokedashoffset
  initially use for svg path drawing animation: 
  stroke
  strokeWidth
  fill="none"

  GSAP animates a progress number ranged from 0-n length (path)
  onUpdate call getPointAtLength(n) and move the mesh (xy) to 
  those coordinates over time.

  SVG coordinates: top-left origin 2D DOM space
  R3f centered world space camera transformed
  */
  useGSAP(()=>{


  },[]);

  return (
  <div className='relative w-screen h-screen'>
  <svg className="absolute inset-0 z-0" viewBox="0 0 2200 2200">
    <g>
   {SVG.map((item, idx) => (
  <path
    key={idx}
    d={item}
    transform="translate(50, -1000)"
    ref={(el) => {
    SVGpathRef.current[idx] = el
}}
    fill='white'
  />
    ))}
    </g>
    </svg>
    <Canvas 
    className='absolute inset-0 z-10'
    orthographic
    camera={{
      position: [0, 0, 10],
      zoom: 25
}}    >
      <ambientLight intensity={1}/>
      <directionalLight
        color="#FFFFFF"
        position={[5,5,5]}
    />
    <group ref={spraypaintCan}>
    <SpraypaintCan/>
    <SpraypaintTop/>
    <SpraypaintEmitter/>
    </group>
    </Canvas>
    </div>
  )
}

function SpraypaintCan(){
  return (
    <mesh position={[0,-2,0]}>
    <cylinderGeometry args={[1.4,1.4,4,18,2]}/>
    <meshPhongMaterial color='white'/>
    </mesh>
  )
}

function SpraypaintTop() {
  // side profile of the can top
  const points = [
    new THREE.Vector2(0.0, 0.0),

    // outer rim
    new THREE.Vector2(1.4, 0.0),
    new THREE.Vector2(1.45, 0.08),
    new THREE.Vector2(1.4, 0.16),

    // taper inward
    new THREE.Vector2(1.25, 0.35),
    new THREE.Vector2(1.1, 0.55),

    // nozzle platform
    new THREE.Vector2(0.8, 0.75),
    new THREE.Vector2(0.8, 1.0),

    // nozzle bump
    new THREE.Vector2(0.95, 1.08),
    new THREE.Vector2(0.85, 1.18),

    // center close
    new THREE.Vector2(0.0, 1.18),
  ];

  return (
    <mesh>
      <latheGeometry args={[points, 64]} />
      <meshStandardMaterial
        metalness={0.7}
        roughness={0.3}
      />
    </mesh>
  );
}

function SpraypaintEmitter(){
  return (
    <mesh position={[0,1.2,0]}>
      <boxGeometry args={[.5,1,.5]}/>
      <meshPhongMaterial color='white'/>
    </mesh>
  )
}


function Spraypaint(){
  return (
    <mesh ref={spraypaint}>
      <sphereGeometry args={[1, 10, 10]}/>
      <meshPhongMaterial/>
    </mesh>
  )
}