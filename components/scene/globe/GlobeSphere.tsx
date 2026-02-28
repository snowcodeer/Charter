'use client'

import { useRef } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

interface GlobeSphereProps {
  radius: number
}

function TexturedSphere({ radius }: GlobeSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useTexture('/textures/earth-vintage.jpg')

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 64, 48]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  )
}

function FallbackSphere({ radius }: GlobeSphereProps) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 64, 48]} />
      <meshStandardMaterial color="#8b7355" roughness={0.8} metalness={0.1} />
    </mesh>
  )
}

export function GlobeSphere({ radius }: GlobeSphereProps) {
  return <TexturedSphere radius={radius} />
}
