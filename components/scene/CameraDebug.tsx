'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

const DEBUG_ELEMENT_ID = 'camera-debug-overlay'

// Runs inside Canvas — writes directly to DOM for zero-latency updates
export function CameraDebugTracker() {
  const { camera } = useThree()

  useFrame(() => {
    const el = document.getElementById(DEBUG_ELEMENT_ID)
    if (!el) return
    const p = camera.position
    const r = camera.rotation
    el.textContent = `pos: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]\nrot: [${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}]`
  })

  return null
}

// Renders outside Canvas as plain DOM
export function CameraDebugDisplay() {
  return (
    <div
      id={DEBUG_ELEMENT_ID}
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        background: 'rgba(0,0,0,0.75)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 13,
        padding: '8px 12px',
        borderRadius: 6,
        whiteSpace: 'pre',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    />
  )
}
