'use client'

import { Suspense, useCallback, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
import { SceneLighting } from './SceneLighting'
import { OfficeModel } from './OfficeModel'
import { FirstPersonControls } from './FirstPersonControls'
import { CameraDebugTracker, CameraDebugDisplay } from './CameraDebug'
import { LoadingScreen } from './LoadingScreen'
import { InteractiveGlobe } from './globe/InteractiveGlobe'

interface GlobeInfo {
  center: THREE.Vector3
  radius: number
}

export function OfficeScene() {
  const [globeInfo, setGlobeInfo] = useState<GlobeInfo | null>(null)

  const handleGlobeFound = useCallback((info: GlobeInfo) => {
    setGlobeInfo(info)
  }, [])

  return (
    <div className="fixed inset-0">
      <Canvas
        shadows
        camera={{ fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>
            <SceneLighting />
            <OfficeModel onGlobeFound={handleGlobeFound} />
          </Physics>
          <FirstPersonControls globeCenter={globeInfo?.center ?? null} />
          {globeInfo && (
            <InteractiveGlobe position={globeInfo.center} radius={globeInfo.radius} />
          )}
          <CameraDebugTracker />
        </Suspense>
      </Canvas>
      <CameraDebugDisplay />
      <LoadingScreen />
    </div>
  )
}
