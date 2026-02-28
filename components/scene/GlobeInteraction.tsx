'use client'

import { useRef, useCallback, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface GlobeInteractionProps {
  globeMesh: THREE.Object3D | null
}

const SCENE_CAMERA = {
  target: new THREE.Vector3(0, 1, 0),
  minDistance: 2,
  maxDistance: 20,
}

const GLOBE_CAMERA = {
  minDistance: 0.5,
  maxDistance: 5,
}

export function GlobeInteraction({ globeMesh }: GlobeInteractionProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const { camera, raycaster, pointer, scene } = useThree()
  const [focusedOnGlobe, setFocusedOnGlobe] = useState(false)

  const handlePointerDown = useCallback(() => {
    if (!globeMesh) return

    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(globeMesh, true)

    if (intersects.length > 0 && !focusedOnGlobe) {
      // Clicked on globe — zoom in
      const box = new THREE.Box3().setFromObject(globeMesh)
      const center = box.getCenter(new THREE.Vector3())

      if (controlsRef.current) {
        controlsRef.current.target.copy(center)
        controlsRef.current.minDistance = GLOBE_CAMERA.minDistance
        controlsRef.current.maxDistance = GLOBE_CAMERA.maxDistance
        controlsRef.current.update()
      }
      setFocusedOnGlobe(true)
    } else if (focusedOnGlobe) {
      // Check if clicking away from globe
      const allMeshes: THREE.Object3D[] = []
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) allMeshes.push(child)
      })
      const allIntersects = raycaster.intersectObjects(allMeshes, false)

      const hitGlobe = allIntersects.some((hit) => {
        let obj: THREE.Object3D | null = hit.object
        while (obj) {
          if (obj === globeMesh) return true
          obj = obj.parent
        }
        return false
      })

      if (!hitGlobe) {
        // Clicked away — restore scene controls
        if (controlsRef.current) {
          controlsRef.current.target.copy(SCENE_CAMERA.target)
          controlsRef.current.minDistance = SCENE_CAMERA.minDistance
          controlsRef.current.maxDistance = SCENE_CAMERA.maxDistance
          controlsRef.current.update()
        }
        setFocusedOnGlobe(false)
      }
    }
  }, [globeMesh, camera, raycaster, pointer, scene, focusedOnGlobe])

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        target={SCENE_CAMERA.target}
        minDistance={SCENE_CAMERA.minDistance}
        maxDistance={SCENE_CAMERA.maxDistance}
        maxPolarAngle={Math.PI / 2}
        enableDamping
        dampingFactor={0.05}
      />
      {/* Invisible plane to capture pointer events */}
      <mesh visible={false} onPointerDown={handlePointerDown}>
        <sphereGeometry args={[100]} />
      </mesh>
    </>
  )
}
