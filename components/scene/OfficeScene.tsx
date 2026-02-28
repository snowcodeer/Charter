'use client'

import { Suspense, useCallback, useState } from 'react'
import { Canvas } from '@react-three/fiber'

import * as THREE from 'three'
import { SceneLighting } from './SceneLighting'
import { OfficeModel } from './OfficeModel'
import { FirstPersonControls } from './FirstPersonControls'
import { LoadingScreen } from './LoadingScreen'
import { InteractiveGlobe } from './globe/InteractiveGlobe'
import { useGlobeStore } from './globe/useGlobeStore'

interface GlobeInfo {
  center: THREE.Vector3
  radius: number
}

export function OfficeScene() {
  const [globeInfo, setGlobeInfo] = useState<GlobeInfo | null>(null)
  const isFocused = useGlobeStore((s) => s.isFocused)

  const handleGlobeFound = useCallback((info: GlobeInfo) => {
    setGlobeInfo(info)
  }, [])

  return (
    <div className="fixed inset-0">
      <Canvas
        shadows
        camera={{ fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        frameloop="always"
      >
        <Suspense fallback={null}>
          <SceneLighting />
          <OfficeModel onGlobeFound={handleGlobeFound} />
          <FirstPersonControls />
          {globeInfo && (
            <InteractiveGlobe position={globeInfo.center} radius={globeInfo.radius} />
          )}
        </Suspense>
      </Canvas>
      <LoadingScreen />
      {!isFocused && (
        <div className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center">
          <div className="w-5 h-5 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-[#c4a455]/60" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#c4a455]/60" />
          </div>
        </div>
      )}
    </div>
  )
}
