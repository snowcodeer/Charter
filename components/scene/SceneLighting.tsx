'use client'

import { Environment } from '@react-three/drei'

export function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 3]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Environment preset="city" />
    </>
  )
}
