'use client'

import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobeStore } from './globe/useGlobeStore'

export interface GlobeInfo {
  center: THREE.Vector3
  radius: number
}

interface OfficeModelProps {
  onGlobeFound?: (info: GlobeInfo) => void
}

export function OfficeModel({ onGlobeFound }: OfficeModelProps) {
  const { scene, animations } = useGLTF('/models/Office_anim.glb')
  const groupRef = useRef<THREE.Group>(null)
  const mistRef = useRef<THREE.Object3D | null>(null)
  const { camera } = useThree()
  const isFocused = useGlobeStore((s) => s.isFocused)

  // Book animation state
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const bookActionRef = useRef<THREE.AnimationAction | null>(null)
  const bookMeshesRef = useRef<THREE.Mesh[]>([])
  const raycaster = useRef(new THREE.Raycaster())
  const isBookHovered = useRef(false)

  // Find the Mist node and book meshes
  useEffect(() => {
    const bookMeshes: THREE.Mesh[] = []

    scene.traverse((child) => {
      if (child.name === 'Mist') {
        mistRef.current = child
      }
      // Collect book meshes for raycasting (covers, pages, spine)
      const name = child.name
      if (
        name.startsWith('cover-') ||
        name.startsWith('paper') ||
        name === 'pine_34'
      ) {
        child.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) bookMeshes.push(c as THREE.Mesh)
        })
      }
    })

    bookMeshesRef.current = bookMeshes

    // Set up animation mixer for the book
    const mixer = new THREE.AnimationMixer(scene)
    mixerRef.current = mixer

    const bookClip = animations.find((clip) => clip.name === 'Animation.001')
    if (bookClip) {
      const action = mixer.clipAction(bookClip)
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      action.paused = true
      bookActionRef.current = action
    }

    return () => { mixer.stopAllAction() }
  }, [scene, animations])

  useFrame((_, delta) => {
    // Rotate crystal ball mist
    if (mistRef.current) {
      mistRef.current.rotateY(delta * 0.5)
    }

    // Update book animation mixer
    mixerRef.current?.update(delta)

    // Raycast from crosshair (camera center) in looking mode
    if (!isFocused && bookActionRef.current && bookMeshesRef.current.length > 0) {
      raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera)
      const hits = raycaster.current.intersectObjects(bookMeshesRef.current, false)
      const hovering = hits.length > 0

      if (hovering && !isBookHovered.current) {
        // Start opening
        const action = bookActionRef.current
        action.paused = false
        action.timeScale = 1
        if (action.time >= action.getClip().duration) action.time = 0
        action.play()
        isBookHovered.current = true
      } else if (!hovering && isBookHovered.current) {
        // Reverse to close
        const action = bookActionRef.current
        action.paused = false
        action.timeScale = -1
        if (action.time <= 0) action.time = action.getClip().duration
        action.play()
        isBookHovered.current = false
      }
    }
  })

  useEffect(() => {
    let globeBase: THREE.Object3D | null = null
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
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/models/Office_anim.glb')
