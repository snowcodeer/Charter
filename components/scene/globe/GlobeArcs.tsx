'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobeStore } from './useGlobeStore'
import { createArcCurve } from './globe-utils'

interface GlobeArcsProps {
  radius: number
}

function ArcLine({ from, to, radius, color = '#c4a265' }: {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  radius: number
  color?: string
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const tubeGeometry = useMemo(() => {
    const curve = createArcCurve(from, to, radius)
    return new THREE.TubeGeometry(curve, 48, radius * 0.01, 6, false)
  }, [from, to, radius])

  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
  }), [color])

  useFrame((_, delta) => {
    if (meshRef.current) {
      // Subtle pulse effect
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.6 + Math.sin(Date.now() * 0.003) * 0.25
    }
  })

  return <mesh ref={meshRef} geometry={tubeGeometry} material={material} />
}

export function GlobeArcs({ radius }: GlobeArcsProps) {
  const arcs = useGlobeStore((s) => s.arcs)

  return (
    <group>
      {arcs.map((arc) => (
        <ArcLine
          key={arc.id}
          from={arc.from}
          to={arc.to}
          radius={radius}
          color={arc.color}
        />
      ))}
    </group>
  )
}
