'use client'

import { useRef, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { GlobeSphere } from './GlobeSphere'
import { CountryBorders } from './CountryBorders'
import { GlobeArcs } from './GlobeArcs'
import { GlobeMarkers } from './GlobeMarkers'
import { useGlobeStore } from './useGlobeStore'
import { vector3ToLatLng } from './globe-utils'

interface InteractiveGlobeProps {
  position: THREE.Vector3
  radius: number
}

export function InteractiveGlobe({ position, radius }: InteractiveGlobeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const isFocused = useGlobeStore((s) => s.isFocused)
  const setFocusedCountry = useGlobeStore((s) => s.setFocusedCountry)

  // Slow idle rotation around the tilted axis
  useFrame((_, delta) => {
    if (spinRef.current && !isFocused) {
      spinRef.current.rotation.y += delta * 0.08
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isFocused) return
    e.stopPropagation()
    const localPoint = groupRef.current
      ? groupRef.current.worldToLocal(e.point.clone())
      : e.point
    const { lat, lng } = vector3ToLatLng(localPoint, radius)
    console.log(`[Globe] Clicked at lat: ${lat.toFixed(2)}, lng: ${lng.toFixed(2)}`)
    setFocusedCountry(`${lat.toFixed(1)},${lng.toFixed(1)}`)
  }

  return (
    <group ref={groupRef} position={position}>
      {/* Tilt group — Earth's 23.4° axial tilt */}
      <group rotation={[0, 0, THREE.MathUtils.degToRad(23.4)]}>
        {/* Spin group — rotates around the tilted Y axis */}
        <group ref={spinRef}>
          <Suspense fallback={
            <mesh>
              <sphereGeometry args={[radius, 32, 24]} />
              <meshStandardMaterial color="#8b7355" roughness={0.8} />
            </mesh>
          }>
            <GlobeSphere radius={radius} />
          </Suspense>
          <CountryBorders radius={radius} />
          <GlobeArcs radius={radius} />
          <GlobeMarkers radius={radius} />
          {/* Invisible click target sphere */}
          <mesh onClick={handleClick} visible={false}>
            <sphereGeometry args={[radius * 1.01, 32, 24]} />
            <meshBasicMaterial />
          </mesh>
        </group>
      </group>
    </group>
  )
}
