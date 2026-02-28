'use client'

import { useRef, useEffect, useCallback, Suspense } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { GlobeSphere } from './GlobeSphere'
import { CountryFills } from './CountryFills'
import { CountryBorders } from './CountryBorders'
import { GlobeArcs } from './GlobeArcs'
import { GlobeMarkers } from './GlobeMarkers'
import { useGlobeStore } from './useGlobeStore'
import { useCountryData, type CountryData } from './useCountryData'
import { vector3ToLatLng } from './globe-utils'

interface InteractiveGlobeProps {
  position: THREE.Vector3
  radius: number
}

/** Ray-casting point-in-polygon test (2D, lng/lat) */
function pointInRings(lng: number, lat: number, rings: number[][][][]): boolean {
  for (const polygon of rings) {
    const outer = polygon[0]
    if (!outer || outer.length < 3) continue
    if (pointInRing(lng, lat, outer)) {
      // Check not inside a hole
      let inHole = false
      for (let h = 1; h < polygon.length; h++) {
        if (pointInRing(lng, lat, polygon[h])) { inHole = true; break }
      }
      if (!inHole) return true
    }
  }
  return false
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function findCountryAtLatLng(lat: number, lng: number, countries: CountryData[]): CountryData | null {
  for (const country of countries) {
    if (pointInRings(lng, lat, country.rings)) return country
  }
  return null
}

export function InteractiveGlobe({ position, radius }: InteractiveGlobeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const dragging = useRef(false)
  const setFocusedCountry = useGlobeStore((s) => s.setFocusedCountry)
  const setHoveredCountry = useGlobeStore((s) => s.setHoveredCountry)
  const countries = useCountryData()
  const { gl, camera } = useThree()
  const lastHoveredIso = useRef<string | null>(null)
  const hovering = useRef(false)

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

  // Slow idle rotation when not interacting
  useFrame((_, delta) => {
    if (spinRef.current && !dragging.current && !hovering.current) {
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

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    hovering.current = true
    if (!countries || dragging.current) return

    // Get the point in the spin group's local space
    const spinGroup = spinRef.current
    if (!spinGroup) return
    const localPoint = spinGroup.worldToLocal(e.point.clone())
    const { lat, lng } = vector3ToLatLng(localPoint, radius)

    const country = findCountryAtLatLng(lat, lng, countries)

    if (country && country.iso3) {
      if (lastHoveredIso.current === country.iso3) return
      lastHoveredIso.current = country.iso3

      // Project the 3D point to screen coordinates for the tooltip
      const screenPos = e.point.clone().project(camera)
      const rect = gl.domElement.getBoundingClientRect()
      const screenX = ((screenPos.x + 1) / 2) * rect.width + rect.left
      const screenY = ((-screenPos.y + 1) / 2) * rect.height + rect.top

      setHoveredCountry({
        name: country.name || country.iso3,
        iso3: country.iso3,
        screenX,
        screenY,
      })
    } else {
      if (lastHoveredIso.current !== null) {
        lastHoveredIso.current = null
        setHoveredCountry(null)
      }
    }
  }, [countries, radius, camera, gl, setHoveredCountry])

  const handlePointerLeave = useCallback(() => {
    hovering.current = false
    lastHoveredIso.current = null
    setHoveredCountry(null)
  }, [setHoveredCountry])

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
          <CountryFills radius={radius} />
          <CountryBorders radius={radius} />
          <GlobeArcs radius={radius} />
          <GlobeMarkers radius={radius} />
          {/* Invisible hit target sphere */}
          <mesh
            onClick={handleClick}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            visible={false}
          >
            <sphereGeometry args={[radius * 1.01, 32, 24]} />
            <meshBasicMaterial />
          </mesh>
        </group>
      </group>
    </group>
  )
}
