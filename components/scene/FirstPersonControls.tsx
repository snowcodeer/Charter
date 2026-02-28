'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobeStore } from './globe/useGlobeStore'

const MOUSE_SENSITIVITY = 0.002

const CINEMATIC_POS = new THREE.Vector3(-1.52, 2.48, 0.05)
const CINEMATIC_ROT = new THREE.Euler(-1.42, -1.32, -1.42)
const CINEMATIC_FOV = 30

const LOOK_POS = new THREE.Vector3(-1.47, 2.45, 0)
const LOOK_FOV = 50
const MIN_PITCH = -Math.PI / 3
const MAX_PITCH = Math.PI / 4

type ControlMode = 'cinematic' | 'looking'

export function FirstPersonControls() {
  const mode = useRef<ControlMode>('cinematic')
  const locked = useRef(false)
  const yaw = useRef(0)
  const pitch = useRef(0)
  const { camera, gl } = useThree()
  const setFocused = useGlobeStore((s) => s.setFocused)

  const enterCinematic = useCallback(() => {
    mode.current = 'cinematic'
    locked.current = false
    setFocused(true)
    camera.position.copy(CINEMATIC_POS)
    camera.rotation.copy(CINEMATIC_ROT)
    ;(camera as THREE.PerspectiveCamera).fov = CINEMATIC_FOV
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
  }, [camera, setFocused])

  // Start in cinematic
  useEffect(() => {
    enterCinematic()
  }, [enterCinematic])

  // Double-click to enter look-around mode, pointer lock exit returns to cinematic
  useEffect(() => {
    const canvas = gl.domElement
    let lockCooldown = 0

    const onDoubleClick = () => {
      if (mode.current === 'cinematic' && Date.now() - lockCooldown > 500) {
        canvas.requestPointerLock()
      }
    }

    const onLockChange = () => {
      if (document.pointerLockElement === canvas) {
        locked.current = true
        mode.current = 'looking'
        setFocused(false)

        // Move camera to standing position
        camera.position.copy(LOOK_POS)

        // Initialize yaw/pitch looking toward the desk
        pitch.current = -0.15
        yaw.current = -1.31

        ;(camera as THREE.PerspectiveCamera).fov = LOOK_FOV
        ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
      } else {
        locked.current = false
        lockCooldown = Date.now()
        enterCinematic()
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current || mode.current !== 'looking') return
      yaw.current -= e.movementX * MOUSE_SENSITIVITY
      pitch.current -= e.movementY * MOUSE_SENSITIVITY
      pitch.current = THREE.MathUtils.clamp(pitch.current, MIN_PITCH, MAX_PITCH)
    }

    canvas.addEventListener('dblclick', onDoubleClick)
    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('mousemove', onMouseMove)

    return () => {
      canvas.removeEventListener('dblclick', onDoubleClick)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [gl, camera, enterCinematic, setFocused])

  useFrame(() => {
    if (mode.current !== 'looking') return
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)
  })

  return null
}
