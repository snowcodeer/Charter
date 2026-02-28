'use client'

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobeStore } from './globe/useGlobeStore'

const CINEMATIC_POS = new THREE.Vector3(-1.60, 2.45, 0)
const CINEMATIC_ROT = new THREE.Euler(-1.42, -1.32, -1.42)
const CINEMATIC_FOV = 28

interface FirstPersonControlsProps {
  globeCenter?: THREE.Vector3 | null
}

export function FirstPersonControls({ globeCenter }: FirstPersonControlsProps) {
  const { camera } = useThree()
  const setFocused = useGlobeStore((s) => s.setFocused)

  // Set cinematic camera once
  useEffect(() => {
    camera.position.copy(CINEMATIC_POS)
    camera.rotation.copy(CINEMATIC_ROT)
    ;(camera as THREE.PerspectiveCamera).fov = CINEMATIC_FOV
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
    setFocused(true)
  }, [camera, setFocused])

  return null
}
