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

const CINEMATIC_POS = new THREE.Vector3(-1.58, 2.50, 0.05)
const CINEMATIC_ROT = new THREE.Euler(-1.42, -1.32, -1.42)
const CINEMATIC_FOV = 32

const CENTER_YAW = -1.31
const YAW_LIMIT = Math.PI / 2
const MIN_YAW = CENTER_YAW - YAW_LIMIT
const MAX_YAW = CENTER_YAW + YAW_LIMIT
const MIN_PITCH = -Math.PI / 3
const MAX_PITCH = Math.PI / 4

type ControlMode = 'cinematic' | 'walking'

interface FirstPersonControlsProps {
  globeCenter?: THREE.Vector3 | null
}

export function FirstPersonControls({ globeCenter }: FirstPersonControlsProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const keys = useRef<Set<string>>(new Set())
  const mode = useRef<ControlMode>('cinematic')
  const locked = useRef(false)
  const yaw = useRef(CENTER_YAW)
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

    const rb = rigidBodyRef.current
    if (rb) {
      rb.setTranslation({ x: CINEMATIC_POS.x, y: CINEMATIC_POS.y, z: CINEMATIC_POS.z }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
  }, [camera, setFocused])

  // Start in cinematic
  useEffect(() => {
    enterCinematic()
  }, [enterCinematic])

  // Double-click canvas to enter walking mode, Escape (via pointer lock exit) returns to cinematic
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
        mode.current = 'walking'
        setFocused(false)
        pitch.current = -0.15
        ;(camera as THREE.PerspectiveCamera).fov = 50
        ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
      } else {
        locked.current = false
        lockCooldown = Date.now()
        enterCinematic()
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current || mode.current !== 'walking') return
      yaw.current -= e.movementX * MOUSE_SENSITIVITY
      pitch.current -= e.movementY * MOUSE_SENSITIVITY
      yaw.current = THREE.MathUtils.clamp(yaw.current, MIN_YAW, MAX_YAW)
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

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      keys.current.add(e.code)
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
  }, [])

  useFrame(() => {
    if (mode.current === 'cinematic') return

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
