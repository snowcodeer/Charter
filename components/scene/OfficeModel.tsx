'use client'

import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

export interface GlobeInfo {
  center: THREE.Vector3
  radius: number
}

interface OfficeModelProps {
  onGlobeFound?: (info: GlobeInfo) => void
}

export function OfficeModel({ onGlobeFound }: OfficeModelProps) {
  const { scene } = useGLTF('/models/Office-part.glb')
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    let globeBase: THREE.Object3D | null = null
    let globeNode: THREE.Object3D | null = null

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }

      const name = child.name.toLowerCase()
      // Match the actual node names from the GLB
      if (name.includes('globe base') || name.includes('globe_base')) {
        globeBase = child
      }
      if (name === 'globe_low.001' || name === 'globe_low') {
        globeNode = child
      }
    })

    if (globeBase) {
      // Use the base mesh to compute where the globe sphere should go
      const box = new THREE.Box3().setFromObject(globeBase)
      const baseCenter = box.getCenter(new THREE.Vector3())
      const baseSize = box.getSize(new THREE.Vector3())

      // Globe sphere sits inside the stand ring — center of the base bounding box
      const radius = Math.max(baseSize.x, baseSize.z) * 0.52
      const center = new THREE.Vector3(
        baseCenter.x,
        baseCenter.y,
        baseCenter.z
      )

      console.log('[OfficeModel] Globe base found, computed sphere center:', center, 'radius:', radius)
      onGlobeFound?.({ center, radius })
    } else {
      console.warn('[OfficeModel] No globe base mesh found in scene')
    }
  }, [scene, onGlobeFound])

  return (
    <RigidBody type="fixed" colliders="trimesh">
      <group ref={groupRef}>
        <primitive object={scene} />
      </group>
    </RigidBody>
  )
}

useGLTF.preload('/models/Office-part.glb')
