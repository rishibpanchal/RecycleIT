"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Sphere, Line, Html, Float } from "@react-three/drei"
import { useRef, useMemo, useState } from "react"
import * as THREE from "three"

interface CityMarker {
  name: string
  lat: number
  lng: number
  status: string
}

const cities: CityMarker[] = [
  { name: "Mumbai", lat: 19.07, lng: 72.87, status: "Active" },
  { name: "Delhi", lat: 28.61, lng: 77.20, status: "Processing" },
  { name: "Chennai", lat: 13.08, lng: 80.27, status: "Active" },
  { name: "Kolkata", lat: 22.57, lng: 88.36, status: "Standby" },
]

// Color palette - baby pink, teal, peacock green, blue for globe; purple and royal blue for nodes/lines
const COLORS = {
  babyPink: "#FBB6CE",
  teal: "#14B8A6",
  peacockGreen: "#047857",
  blue: "#60A5FA",
  purple: "#9333EA",
  royalBlue: "#3730A3",
  white: "#FFFFFF",
}

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

function GlobeWireframe() {
  const latLines = useMemo(() => {
    const lines: THREE.Vector3[][] = []
    for (let lat = -75; lat <= 75; lat += 15) {
      const points: THREE.Vector3[] = []
      for (let lng = 0; lng <= 360; lng += 4) {
        points.push(latLngToVector3(lat, lng, 2.01))
      }
      lines.push(points)
    }
    return lines
  }, [])

  const lngLines = useMemo(() => {
    const lines: THREE.Vector3[][] = []
    for (let lng = 0; lng < 360; lng += 15) {
      const points: THREE.Vector3[] = []
      for (let lat = -85; lat <= 85; lat += 4) {
        points.push(latLngToVector3(lat, lng, 2.01))
      }
      lines.push(points)
    }
    return lines
  }, [])

  return (
    <group>
      {latLines.map((points, i) => (
        <Line 
          key={`lat-${i}`} 
          points={points} 
          color={i % 2 === 0 ? COLORS.purple : COLORS.royalBlue} 
          lineWidth={0.6} 
          opacity={0.2} 
          transparent 
        />
      ))}
      {lngLines.map((points, i) => (
        <Line 
          key={`lng-${i}`} 
          points={points} 
          color={i % 2 === 0 ? COLORS.royalBlue : COLORS.purple} 
          lineWidth={0.6} 
          opacity={0.2} 
          transparent 
        />
      ))}
    </group>
  )
}

function RecyclingArc({ start, end, color }: { start: CityMarker; end: CityMarker; color: string }) {
  const curve = useMemo(() => {
    const startVec = latLngToVector3(start.lat, start.lng, 2.02)
    const endVec = latLngToVector3(end.lat, end.lng, 2.02)
    
    const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5)
    const distance = startVec.distanceTo(endVec)
    midPoint.normalize().multiplyScalar(2.02 + distance * 0.35)
    
    const bezier = new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec)
    return bezier.getPoints(60)
  }, [start, end])

  const [progress, setProgress] = useState(Math.random())
  
  useFrame((_, delta) => {
    setProgress((prev) => (prev + delta * 0.25) % 1)
  })

  const pulsePosition = useMemo(() => {
    const idx = Math.floor(progress * (curve.length - 1))
    return curve[Math.min(idx, curve.length - 1)]
  }, [progress, curve])

  return (
    <group>
      {/* Main arc line */}
      <Line 
        points={curve} 
        color={color} 
        lineWidth={3} 
        opacity={0.85} 
        transparent 
      />
      {/* Glow effect line */}
      <Line 
        points={curve} 
        color={color} 
        lineWidth={6} 
        opacity={0.15} 
        transparent 
      />
      {/* Traveling pulse - bright core */}
      <mesh position={pulsePosition}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color={COLORS.white} />
      </mesh>
      {/* Pulse glow */}
      <mesh position={pulsePosition}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} opacity={0.6} transparent />
      </mesh>
      <mesh position={pulsePosition}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={color} opacity={0.25} transparent />
      </mesh>
    </group>
  )
}

function CityMarkerMesh({ city, onClick }: { city: CityMarker; onClick: (city: CityMarker) => void }) {
  const position = useMemo(() => latLngToVector3(city.lat, city.lng, 2.04), [city])
  const [hovered, setHovered] = useState(false)
  const ringRef = useRef<THREE.Mesh>(null)
  const outerRingRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    // Throttling logic within useFrame is less effective than reducing work.
    // However, we can at least ensure we don't do complex scaling if not needed.
    if (pulseRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.15
      pulseRef.current.scale.setScalar(scale)
    }
    
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.5
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z -= delta * 0.2
    }
  })

  return (
    <group position={position}>
      {/* Outer pulse glow */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshBasicMaterial color={COLORS.purple} opacity={0.2} transparent />
      </mesh>
      {/* Main marker node */}
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => onClick(city)}
      >
        <sphereGeometry args={[0.065, 20, 20]} />
        <meshBasicMaterial color={hovered ? COLORS.white : COLORS.purple} />
      </mesh>
      {/* Inner spinning ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.09, 0.11, 32]} />
        <meshBasicMaterial color={COLORS.royalBlue} opacity={0.9} transparent side={THREE.DoubleSide} />
      </mesh>
      {/* Outer spinning ring */}
      <mesh ref={outerRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.13, 0.145, 32]} />
        <meshBasicMaterial color={COLORS.purple} opacity={0.5} transparent side={THREE.DoubleSide} />
      </mesh>
      {hovered && (
        <Html distanceFactor={5} position={[0.2, 0.2, 0]}>
          <div className="whitespace-nowrap rounded-xl border border-purple-200 bg-white px-4 py-2.5 shadow-xl">
            <p className="text-xs font-medium text-purple-600">{city.name}</p>
            <p className="text-sm font-bold text-slate-800">{city.status}</p>
          </div>
        </Html>
      )}
    </group>
  )
}

function GlobeMesh() {
  const globeRef = useRef<THREE.Group>(null)
  const [selectedCity, setSelectedCity] = useState<CityMarker | null>(null)

  useFrame(({ clock }, delta) => {
    if (globeRef.current) {
      // Slower, more stable rotation
      globeRef.current.rotation.y += delta * 0.03
    }
  })

  const arcs = [
    { start: cities[0], end: cities[1], color: COLORS.purple },
    { start: cities[2], end: cities[0], color: COLORS.royalBlue },
    { start: cities[3], end: cities[1], color: COLORS.purple },
    { start: cities[2], end: cities[3], color: COLORS.royalBlue },
    { start: cities[0], end: cities[3], color: COLORS.purple },
    { start: cities[1], end: cities[2], color: COLORS.royalBlue },
  ]

  return (
    <group ref={globeRef}>
        <Sphere args={[1.7, 32, 32]}>
          <meshPhysicalMaterial
            color={COLORS.peacockGreen}
            roughness={0.2}
            metalness={0.1}
            transparent
            opacity={0.35}
            emissive={COLORS.peacockGreen}
            emissiveIntensity={0.15}
          />
        </Sphere>
        
        {/* Layer 2 - teal */}
        <Sphere args={[1.82, 32, 32
      <Sphere args={[1.82, 64, 64]}>
        <meshPhysicalMaterial
          color={COLORS.teal}
          roughness={0.25}
          metalness={0.05}
          transparent
          opacity={0.3}
          emissive={COLORS.teal}
          emissiveIntensity={0.1}
        />
      </Sphere>
      
      {/* Layer 3 - blue */}
      <Sphere args={[1.91, 64, 64]}>
        <meshPhysicalMaterial
          color={COLORS.blue}
          roughness={0.3}
          metalness={0.05}
          transparent
          opacity={0.25}
          emissive={COLORS.blue}
          emissiveIntensity={0.08}
        />
      </Sphere>
      
      {/* Outer shell - baby pink (glass effect) */}
      <Sphere args={[2, 64, 64]}>
        <meshPhysicalMaterial
          color={COLORS.babyPink}
          roughness={0.1}
          metalness={0}
          transparent
          opacity={0.22}
          transmission={0.8}
          thickness={0.8}
          clearcoat={1}
          clearcoatRoughness={0.05}
          ior={1.5}
        />
      </Sphere>
      
      {/* Wireframe grid */}
      <GlobeWireframe />
      
      {/* Atmosphere glow layers */}
      <Sphere args={[2.15, 48, 48]}>
        <meshBasicMaterial 
          color={COLORS.babyPink} 
          opacity={0.08} 
          transparent 
          side={THREE.BackSide} 
        />
      </Sphere>
      
      <Sphere args={[2.3, 48, 48]}>
        <meshBasicMaterial 
          color={COLORS.teal} 
          opacity={0.05} 
          transparent 
          side={THREE.BackSide} 
        />
      </Sphere>
      
      <Sphere args={[2.5, 32, 32]}>
        <meshBasicMaterial 
          color={COLORS.blue} 
          opacity={0.03} 
          transparent 
          side={THREE.BackSide} 
        />
      </Sphere>
      
      {/* Recycling corridors */}
      {arcs.map((arc, i) => (
        <RecyclingArc key={i} {...arc} />
      ))}
      
      {/* City markers */}
      {cities.map((city) => (
        <CityMarkerMesh key={city.name} city={city} onClick={setSelectedCity} />
      ))}
    </group>
  )
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  
  const positions = useMemo(() => {
    const positions = new Float32Array(200 * 3)
    for (let i = 0; i < 200; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 2.6 + Math.random() * 1.5
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    return positions
  }, [])
  
  useFrame((state, delta) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.02
      particlesRef.current.rotation.x += delta * 0.01
    }
  })
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color={COLORS.purple}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  )
}

export function Globe3D({ className }: { className?: string }) {
  const [showGlobe, setShowGlobe] = useState(false)

  useEffect(() => {
    // Check if user has opted out of heavy animations via localStorage or prefers-reduced-motion
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const disableGlobe = typeof localStorage !== 'undefined' && localStorage.getItem("DISABLE_HEAVY_UI") === "true"
    
    if (!reducedMotion && !disableGlobe) {
      const timer = setTimeout(() => setShowGlobe(true), 1200) // Delay to let main UI render
      return () => clearTimeout(timer)
    }
  }, [])

  if (!showGlobe) {
    return (
      <div className={`flex items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100 ${className}`} style={{ minHeight: '400px' }}>
        <div className="text-slate-400 text-sm animate-pulse">Optmizing Visualization...</div>
      </div>
    )
  }

  return (
    <div className={className}>
      <Canvas 
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        gl={{ 
          antialias: false, 
          powerPreference: "high-performance",
          alpha: true 
        }} 
        dpr={[1, 1.25]} // Cap DPR to 1.25 for performance
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} color={COLORS.white} />
        <pointLight position={[10, 10, 10]} intensity={0.6} color={COLORS.babyPink} />
        <pointLight position={[-10, -5, -10]} intensity={0.5} color={COLORS.teal} />
        <pointLight position={[0, 15, 0]} intensity={0.4} color={COLORS.blue} />
        <pointLight position={[-5, 0, 10]} intensity={0.3} color={COLORS.purple} />
        <Float speed={1.0} rotationIntensity={0.15} floatIntensity={0.2}>
          <GlobeMesh />
        </Float>
        <FloatingParticles />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  )
}
