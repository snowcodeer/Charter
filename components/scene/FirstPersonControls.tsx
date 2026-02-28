'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useGlobeStore } from './globe/useGlobeStore'

const SPEED = 4
const SPRINT_MULTIPLIER = 2
const PLAYER_HEIGHT = 1.6
const EYE_OFFSET = 0.6
const MOUSE_SENSITIVITY = 0.002

const CINEMATIC_POS = new THREE.Vector3(-1.60, 2.45, 0)
const CINEMATIC_ROT = new THREE.Euler(-1.42, -1.32, -1.42)
const CINEMATIC_FOV = 35

// Globe focus camera offset (above and slightly back from globe)
const GLOBE_FOCUS_DISTANCE = 0.6
const GLOBE_FOCUS_FOV = 40

// Yaw/pitch limits (prevent looking behind where the back wall was removed)
const CENTER_YAW = -1.31
const YAW_LIMIT = Math.PI / 2
const MIN_YAW = CENTER_YAW - YAW_LIMIT
const MAX_YAW = CENTER_YAW + YAW_LIMIT
const MIN_PITCH = -Math.PI / 3
const MAX_PITCH = Math.PI / 4

// Globe interaction distance threshold
const GLOBE_INTERACT_DISTANCE = 2.5

type ControlMode = 'cinematic' | 'walking' | 'globe-focus'

interface FirstPersonControlsProps {
  globeCenter?: THREE.Vector3 | null
  onModeChange?: (mode: ControlMode) => void
}

export function FirstPersonControls({ globeCenter, onModeChange }: FirstPersonControlsProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const keys = useRef<Set<string>>(new Set())
  const mode = useRef<ControlMode>('cinematic')
  const locked = useRef(false)
  const yaw = useRef(CENTER_YAW)
  const pitch = useRef(0)
  const { camera, gl } = useThree()

  // Globe focus orbit state
  const orbitAngle = useRef(0)
  const orbitPitch = useRef(0.4) // Slightly above
  const orbitDragging = useRef(false)

  const setFocused = useGlobeStore((s) => s.setFocused)

  const enterCinematic = useCallback(() => {
    mode.current = 'cinematic'
    locked.current = false
    setFocused(false)
    camera.position.copy(CINEMATIC_POS)
    camera.rotation.copy(CINEMATIC_ROT)
    ;(camera as THREE.PerspectiveCamera).fov = CINEMATIC_FOV
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
    onModeChange?.('cinematic')

    const rb = rigidBodyRef.current
    if (rb) {
      rb.setTranslation({ x: CINEMATIC_POS.x, y: CINEMATIC_POS.y, z: CINEMATIC_POS.z }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
  }, [camera, setFocused, onModeChange])

  const enterGlobeFocus = useCallback(() => {
    if (!globeCenter) return

    mode.current = 'globe-focus'
    locked.current = false
    setFocused(true)

    // Exit pointer lock if active
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }

    ;(camera as THREE.PerspectiveCamera).fov = GLOBE_FOCUS_FOV
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
    onModeChange?.('globe-focus')
  }, [camera, globeCenter, setFocused, onModeChange])

  // Set initial cinematic camera
  useEffect(() => {
    enterCinematic()
  }, [enterCinematic])

  // Pointer lock handling
  useEffect(() => {
    const canvas = gl.domElement

    const onClick = () => {
      if (!locked.current && mode.current !== 'globe-focus') {
        canvas.requestPointerLock()
      }
    }

    const onLockChange = () => {
      if (document.pointerLockElement === canvas) {
        locked.current = true
        if (mode.current !== 'globe-focus') {
          mode.current = 'walking'
          pitch.current = -0.15
          ;(camera as THREE.PerspectiveCamera).fov = 50
          ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
          onModeChange?.('walking')
        }
      } else {
        locked.current = false
        if (mode.current === 'walking') {
          enterCinematic()
        }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (mode.current === 'globe-focus') {
        if (orbitDragging.current) {
          orbitAngle.current -= e.movementX * 0.005
          orbitPitch.current = THREE.MathUtils.clamp(
            orbitPitch.current - e.movementY * 0.005,
            0.1,
            Math.PI / 2 - 0.1
          )
        }
        return
      }

      if (!locked.current) return

      yaw.current -= e.movementX * MOUSE_SENSITIVITY
      pitch.current -= e.movementY * MOUSE_SENSITIVITY

      yaw.current = THREE.MathUtils.clamp(yaw.current, MIN_YAW, MAX_YAW)
      pitch.current = THREE.MathUtils.clamp(pitch.current, MIN_PITCH, MAX_PITCH)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (mode.current === 'globe-focus') {
        orbitDragging.current = true
      }
    }

    const onMouseUp = () => {
      orbitDragging.current = false
    }

    canvas.addEventListener('click', onClick)
    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)

    return () => {
      canvas.removeEventListener('click', onClick)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [gl, camera, enterCinematic, onModeChange])

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      keys.current.add(e.code)

      // E key: toggle globe focus when near globe
      if (e.code === 'KeyE' && globeCenter) {
        if (mode.current === 'globe-focus') {
          enterCinematic()
          return
        }
        const dist = camera.position.distanceTo(globeCenter)
        if (dist < GLOBE_INTERACT_DISTANCE) {
          enterGlobeFocus()
        }
      }

      // Escape: exit globe focus
      if (e.code === 'Escape' && mode.current === 'globe-focus') {
        enterCinematic()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.code)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [globeCenter, camera, enterCinematic, enterGlobeFocus])

  useFrame((_, delta) => {
    // Globe focus mode: orbit around the globe
    if (mode.current === 'globe-focus' && globeCenter) {
      const dist = GLOBE_FOCUS_DISTANCE
      const x = globeCenter.x + dist * Math.sin(orbitAngle.current) * Math.cos(orbitPitch.current)
      const y = globeCenter.y + dist * Math.sin(orbitPitch.current)
      const z = globeCenter.z + dist * Math.cos(orbitAngle.current) * Math.cos(orbitPitch.current)

      camera.position.lerp(new THREE.Vector3(x, y, z), 0.08)
      camera.lookAt(globeCenter)
      return
    }

    if (mode.current === 'cinematic') return

    // Apply yaw/pitch to camera
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)

    const rb = rigidBodyRef.current
    if (!rb) return

    const pos = rb.translation()
    camera.position.set(pos.x, pos.y + EYE_OFFSET, pos.z)

    if (!locked.current) {
      rb.setLinvel({ x: 0, y: rb.linvel().y, z: 0 }, true)
      return
    }

    const speed = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
      ? SPEED * SPRINT_MULTIPLIER
      : SPEED

    const direction = new THREE.Vector3()
    if (keys.current.has('KeyW') || keys.current.has('ArrowUp')) direction.z -= 1
    if (keys.current.has('KeyS') || keys.current.has('ArrowDown')) direction.z += 1
    if (keys.current.has('KeyA') || keys.current.has('ArrowLeft')) direction.x -= 1
    if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) direction.x += 1

    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(forward, camera.up).normalize()

    const move = new THREE.Vector3()
    move.addScaledVector(forward, -direction.z)
    move.addScaledVector(right, direction.x)

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed)
    }

    const currentVel = rb.linvel()
    rb.setLinvel({ x: move.x, y: currentVel.y, z: move.z }, true)
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
  })

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={[-1.47, 3, 0]}
      enabledRotations={[false, false, false]}
      mass={1}
      lockRotations
      colliders={false}
      linearDamping={0.5}
    >
      <CapsuleCollider args={[PLAYER_HEIGHT / 2, 0.2]} />
    </RigidBody>
  )
}
