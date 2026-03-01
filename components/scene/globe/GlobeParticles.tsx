'use client'

import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface GlobeParticlesProps {
  radius: number
  count?: number
}

export function GlobeParticles({ radius, count = 350 }: GlobeParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)

  // Per-particle horizontal drift direction (XZ plane) — slight wobble
  const driftRef = useRef<Float32Array>(new Float32Array(count * 2))
  const lifeRef  = useRef<Float32Array>(new Float32Array(count))
  const maxLifeRef = useRef<Float32Array>(new Float32Array(count))

  // How far above the sphere centre a particle may climb before recycling
  const maxRise = radius * 1.5

  function spawnParticle(
    pos: Float32Array,
    i: number,
    staggered: boolean
  ) {
    // Spawn anywhere on the sphere surface (full sphere, not just top)
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const nx = Math.sin(phi) * Math.cos(theta)
    const ny = Math.cos(phi)
    const nz = Math.sin(phi) * Math.sin(theta)

    const spawnR = radius * (1.0 + Math.random() * 0.12)
    pos[i * 3]     = spawnR * nx
    pos[i * 3 + 1] = spawnR * ny
    pos[i * 3 + 2] = spawnR * nz

    // Gentle random horizontal drift (XZ only, very small)
    driftRef.current[i * 2]     = (Math.random() - 0.5) * 0.0012
    driftRef.current[i * 2 + 1] = (Math.random() - 0.5) * 0.0012

    maxLifeRef.current[i] = 2.0 + Math.random() * 2.0
    lifeRef.current[i]    = staggered ? Math.random() * maxLifeRef.current[i] : 0
  }

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      spawnParticle(positions, i, true)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, count])

  useFrame((_, delta) => {
    if (!pointsRef.current) return
    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute
    const pos   = posAttr.array as Float32Array
    const drift = driftRef.current
    const life  = lifeRef.current
    const maxLife = maxLifeRef.current

    // Rise speed: slow float, like incense smoke
    const riseSpeed = 0.0022

    for (let i = 0; i < count; i++) {
      life[i] += delta

      const y = pos[i * 3 + 1]

      // Recycle when particle has climbed past the top of the ball, or lifetime ends
      if (y > maxRise || life[i] >= maxLife[i]) {
        spawnParticle(pos, i, false)
        continue
      }

      // Drift upward + gentle horizontal wobble
      pos[i * 3]     += drift[i * 2]
      pos[i * 3 + 1] += riseSpeed
      pos[i * 3 + 2] += drift[i * 2 + 1]
    }

    posAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#c8a8ff"
        size={0.004}
        sizeAttenuation
        transparent
        opacity={0.42}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
