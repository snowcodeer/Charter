'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useGlobeStore } from './useGlobeStore'
import { latLngToVector3 } from './globe-utils'

interface GlobeMarkersProps {
  radius: number
}

function Marker({ lat, lng, label, type, radius, color }: {
  lat: number
  lng: number
  label: string
  type: 'origin' | 'destination'
  radius: number
  color?: string
}) {
  const groupRef = useRef<THREE.Group>(null)
  const pos = latLngToVector3(lat, lng, radius)
  const markerColor = color || (type === 'origin' ? '#c44040' : '#c4a265')
  const markerSize = radius * 0.03

  // Orient the marker along the surface normal (pointing outward)
  const normal = pos.clone().normalize()
  const quaternion = new THREE.Quaternion()
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)

  useFrame(() => {
    if (groupRef.current) {
      // Gentle bob animation
      const scale = 1 + Math.sin(Date.now() * 0.004) * 0.1
      groupRef.current.scale.setScalar(scale)
    }
  })

  return (
    <group ref={groupRef} position={pos} quaternion={quaternion}>
      {/* Pin cone */}
      <mesh position={[0, markerSize * 0.5, 0]}>
        <coneGeometry args={[markerSize * 0.4, markerSize, 6]} />
        <meshStandardMaterial color={markerColor} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Sphere on top */}
      <mesh position={[0, markerSize * 1.1, 0]}>
        <sphereGeometry args={[markerSize * 0.3, 8, 8]} />
        <meshStandardMaterial color={markerColor} metalness={0.4} roughness={0.4} emissive={markerColor} emissiveIntensity={0.3} />
      </mesh>
      {/* Label */}
      <Billboard position={[0, markerSize * 2, 0]}>
        <Text
          fontSize={markerSize * 1.2}
          color={markerColor}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={markerSize * 0.08}
          outlineColor="#1a1a1a"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

export function GlobeMarkers({ radius }: GlobeMarkersProps) {
  const markers = useGlobeStore((s) => s.markers)

  return (
    <group>
      {markers.map((m) => (
        <Marker
          key={m.id}
          lat={m.lat}
          lng={m.lng}
          label={m.label}
          type={m.type}
          radius={radius}
          color={m.color}
        />
      ))}
    </group>
  )
}
