'use client'

import { useRef } from 'react'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useGlobeStore } from './useGlobeStore'
import { latLngToVector3 } from './globe-utils'

interface GlobeMarkersProps {
  radius: number
}

function Marker({ lat, lng, label, type, radius, color, labelOffset = 0 }: {
  lat: number
  lng: number
  label: string
  type: 'origin' | 'destination'
  radius: number
  color?: string
  labelOffset?: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const pos = latLngToVector3(lat, lng, radius * 1.02)
  const markerColor = color || (type === 'origin' ? '#c44040' : '#c4a265')
  const markerSize = radius * 0.03
  const labelY = markerSize * (2.8 + labelOffset * 2.5)

  // Orient the marker along the surface normal (pointing outward)
  const normal = pos.clone().normalize()
  const quaternion = new THREE.Quaternion()
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)

  return (
    <group ref={groupRef} position={pos} quaternion={quaternion} renderOrder={999}>
      {/* Pin cone */}
      <mesh position={[0, markerSize * 0.5, 0]} renderOrder={999}>
        <coneGeometry args={[markerSize * 0.4, markerSize, 6]} />
        <meshStandardMaterial color={markerColor} metalness={0.3} roughness={0.5} depthTest={false} />
      </mesh>
      {/* Sphere on top */}
      <mesh position={[0, markerSize * 1.1, 0]} renderOrder={999}>
        <sphereGeometry args={[markerSize * 0.3, 8, 8]} />
        <meshStandardMaterial color={markerColor} metalness={0.4} roughness={0.4} emissive={markerColor} emissiveIntensity={0.3} depthTest={false} />
      </mesh>
      {/* Label */}
      <Billboard position={[0, labelY, 0]} renderOrder={1000}>
        <Text
          fontSize={markerSize * 2}
          color={markerColor}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={markerSize * 0.15}
          outlineColor="#1a1a1a"
          material-depthTest={false}
          renderOrder={1000}
          whiteSpace="nowrap"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

export function GlobeMarkers({ radius }: GlobeMarkersProps) {
  const markers = useGlobeStore((s) => s.markers)

  // Compute label offsets so nearby markers stack labels vertically
  const PROXIMITY = 5 // degrees — markers closer than this get stacked
  const offsets: number[] = markers.map(() => 0)
  for (let i = 0; i < markers.length; i++) {
    let stack = 0
    for (let j = 0; j < i; j++) {
      const dLat = Math.abs(markers[i].lat - markers[j].lat)
      const dLng = Math.abs(markers[i].lng - markers[j].lng)
      if (dLat < PROXIMITY && dLng < PROXIMITY) stack++
    }
    offsets[i] = stack
  }

  return (
    <group>
      {markers.map((m, i) => (
        <Marker
          key={m.id}
          lat={m.lat}
          lng={m.lng}
          label={m.label}
          type={m.type}
          radius={radius}
          color={m.color}
          labelOffset={offsets[i]}
        />
      ))}
    </group>
  )
}
