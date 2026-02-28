'use client'

import { useRef, useEffect, Suspense } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
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
  const dragging = useRef(false)
  const setFocusedCountry = useGlobeStore((s) => s.setFocusedCountry)
  const { gl } = useThree()

  // Drag to rotate globe
  useEffect(() => {
    const canvas = gl.domElement

    const onMouseDown = () => { dragging.current = true }
    const onMouseUp = () => { dragging.current = false }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !spinRef.current) return
      spinRef.current.rotation.y += e.movementX * 0.005
    }

    canvas.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mousemove', onMouseMove)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [gl])

  // Slow idle rotation when not dragging
  useFrame((_, delta) => {
    if (spinRef.current && !dragging.current) {
      spinRef.current.rotation.y += delta * 0.08
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
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
        {/* Spin group — drag or idle rotation */}
        <group ref={spinRef} rotation={[0, Math.PI * 0.3, 0]}>
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
