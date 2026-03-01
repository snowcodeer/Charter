'use client'

import { useEffect, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobeStore } from './globe/useGlobeStore'
import { GlobeParticles } from './globe/GlobeParticles'
import { useCrystalBallStore } from '@/lib/hooks/useCrystalBallStore'

// ─── Swirling nebula shader inside the crystal ball ──────────────────────────
const SWIRL_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SWIRL_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vPos;

  float h(float n) { return fract(sin(n) * 43758.5453); }
  float vnoise(vec3 x) {
    vec3 p = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + p.z * 113.0;
    return mix(
      mix(mix(h(n),h(n+1.0),f.x), mix(h(n+57.0),h(n+58.0),f.x), f.y),
      mix(mix(h(n+113.0),h(n+114.0),f.x), mix(h(n+170.0),h(n+171.0),f.x), f.y),
      f.z);
  }

  void main() {
    vec3 n = normalize(vPos);
    float t = uTime * 0.18;

    // Twist the coordinate space
    float twist = sin(n.y * 3.2 + t) * 1.3;
    float cx = n.x * cos(twist) - n.z * sin(twist);
    float cz = n.x * sin(twist) + n.z * cos(twist);
    vec3 s = vec3(cx, n.y, cz);

    // FBM — three octaves
    float f  = vnoise(s * 2.8 + vec3(t * 0.28, 0.0, 0.0));
    f += 0.50 * vnoise(s * 5.5 - vec3(0.0, t * 0.22, 0.0));
    f += 0.25 * vnoise(s * 11.0 + vec3(t * 0.09, t * 0.06, 0.0));
    f /= 1.75;

    // Counter-swirl layer for depth
    float g = vnoise(vec3(-n.z, n.x, n.y) * 3.2 + t * 0.14);
    float pattern = clamp(f * 0.65 + g * 0.35, 0.0, 1.0);

    // Deep violet → mid purple → pale lavender
    vec3 c0 = vec3(0.09, 0.02, 0.22);
    vec3 c1 = vec3(0.44, 0.16, 0.72);
    vec3 c2 = vec3(0.80, 0.64, 0.98);
    vec3 color = mix(c0, c1, smoothstep(0.0, 0.55, pattern));
    color      = mix(color, c2, smoothstep(0.50, 1.0, pattern));

    float alpha = 0.18 + pattern * 0.38;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.58));
  }
`

/** Animated nebula rendered just inside the glass — the "something swimming" */
function CrystalSwirl({ radius }: { radius: number }) {
  const matRef  = useRef<THREE.ShaderMaterial>(null)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    if (matRef.current) matRef.current.uniforms.uTime.value = elapsed.current
  })

  return (
    <mesh>
      <sphereGeometry args={[radius * 0.90, 56, 40]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={SWIRL_VERT}
        fragmentShader={SWIRL_FRAG}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

/** Softly pulsing halo — breathes rather than sitting static */
function GlowShell({ radius }: { radius: number }) {
  const matRef  = useRef<THREE.MeshStandardMaterial>(null)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    if (matRef.current) {
      matRef.current.opacity = 0.07 + (Math.sin(elapsed.current * 0.75) * 0.5 + 0.5) * 0.10
    }
  })

  return (
    <mesh>
      <sphereGeometry args={[radius * 1.07, 48, 32]} />
      <meshStandardMaterial
        ref={matRef}
        color="#6a3a9a"
        emissive="#4a1a70"
        emissiveIntensity={0.25}
        transparent
        opacity={0.12}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

// ─── Fog wisps drifting outside the glass ────────────────────────────────────
const FOG_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FOG_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vPos;

  float h(float n) { return fract(sin(n) * 43758.5453); }
  float vnoise(vec3 x) {
    vec3 p = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + p.z * 113.0;
    return mix(
      mix(mix(h(n),h(n+1.0),f.x), mix(h(n+57.0),h(n+58.0),f.x), f.y),
      mix(mix(h(n+113.0),h(n+114.0),f.x), mix(h(n+170.0),h(n+171.0),f.x), f.y),
      f.z);
  }

  void main() {
    vec3 n = normalize(vPos);
    float t = uTime * 0.07;

    // Three slow-drifting noise layers at different scales → patchy wisps
    float f1 = vnoise(n * 1.8 + vec3(t * 0.55, t * 0.35, 0.0));
    float f2 = vnoise(n * 3.6 - vec3(0.0,      t * 0.28, t * 0.45));
    float f3 = vnoise(n * 7.0 + vec3(t * 0.12, 0.0,      t * 0.22));
    float fog = f1 * 0.50 + f2 * 0.34 + f3 * 0.16;

    // Crisp, uneven wisps — pow pushes faint areas to near-zero
    float alpha = pow(fog, 1.8) * 0.32;

    // Near-white with a faint lavender cast
    vec3 col = mix(vec3(0.90, 0.85, 0.98), vec3(0.97, 0.95, 1.00), fog);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.28));
  }
`

/** Patchy fog wisps clinging just outside the crystal ball */
function CrystalFog({ radius }: { radius: number }) {
  const matRef  = useRef<THREE.ShaderMaterial>(null)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    if (matRef.current) matRef.current.uniforms.uTime.value = elapsed.current
  })

  return (
    <>
      {/* Inner wisp layer — tight against the glass */}
      <mesh>
        <sphereGeometry args={[radius * 1.10, 56, 40]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={FOG_VERT}
          fragmentShader={FOG_FRAG}
          uniforms={{ uTime: { value: 0 } }}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
          side={THREE.FrontSide}
        />
      </mesh>
      {/* Outer diffuse halo — slightly larger, static very low opacity */}
      <mesh>
        <sphereGeometry args={[radius * 1.22, 48, 32]} />
        <meshStandardMaterial
          color="#e8dff8"
          transparent
          opacity={0.045}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
    </>
  )
}

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

  // Crystal ball state — driven by voice store
  const { isListening, isSpeaking, isThinking, onCrystalClick } = useCrystalBallStore()
  const isCrystalActivated = isListening || isSpeaking || isThinking
  const crystalMeshesRef = useRef<THREE.Mesh[]>([])
  const crystalOriginalMatsRef = useRef<(THREE.Material | THREE.Material[])[]>([])
  const [crystalInfo, setCrystalInfo] = useState<{ center: THREE.Vector3; radius: number } | null>(null)

  // Book animation state
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const bookActionRef = useRef<THREE.AnimationAction | null>(null)
  const bookMeshesRef = useRef<THREE.Mesh[]>([])
  const raycaster = useRef(new THREE.Raycaster())
  const isBookHovered = useRef(false)

  // Find the Mist node, crystal ball meshes, and book meshes
  useEffect(() => {
    const bookMeshes: THREE.Mesh[] = []
    const crystalMeshes: THREE.Mesh[] = []
    const crystalOriginalMats: (THREE.Material | THREE.Material[])[] = []

    scene.traverse((child) => {
      const name = child.name

      if (name === 'Mist') {
        mistRef.current = child

        // Only recolour the sphere itself — traverse Mist's own subtree,
        // never the parent group (which also contains the stand/base)
        child.traverse((node) => {
          const mesh = node as THREE.Mesh
          if (mesh.isMesh) {
            crystalMeshes.push(mesh)
            crystalOriginalMats.push(mesh.material)
          }
        })
        // If Mist itself is a mesh, include it too
        const mistMesh = child as THREE.Mesh
        if (mistMesh.isMesh && !crystalMeshes.includes(mistMesh)) {
          crystalMeshes.push(mistMesh)
          crystalOriginalMats.push(mistMesh.material)
        }
      }

      // Collect book meshes for raycasting (covers, pages, spine)
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

    crystalMeshesRef.current = crystalMeshes
    crystalOriginalMatsRef.current = crystalOriginalMats
    bookMeshesRef.current = bookMeshes

    // Compute crystal ball world-space center and radius from Mist
    if (mistRef.current) {
      mistRef.current.updateWorldMatrix(true, false)
      const box = new THREE.Box3().setFromObject(mistRef.current)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const radius = Math.max(size.x, size.y, size.z) / 2
      setCrystalInfo({ center, radius })
    }

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

  // Tint crystal ball based on voice state
  useEffect(() => {
    const meshes = crystalMeshesRef.current
    if (!meshes.length) return

    if (isCrystalActivated) {
      // Pick color based on state: red=listening, purple=speaking, blue=thinking
      const color = isListening ? '#f5b0b0' : isSpeaking ? '#d0b0f5' : '#b0c8f5'
      const emissive = isListening ? '#a83030' : isSpeaking ? '#6a30a8' : '#3050a8'

      meshes.forEach((m, i) => {
        const orig = crystalOriginalMatsRef.current[i]
        if (!orig || Array.isArray(orig)) return
        const tinted = (orig as THREE.MeshStandardMaterial).clone()
        tinted.color.set(color)
        tinted.emissive.set(emissive)
        tinted.emissiveIntensity = 0.18
        tinted.roughness = 0.28
        tinted.transparent = true
        tinted.opacity = 0.72
        tinted.depthWrite = false
        m.material = tinted
      })
    } else {
      meshes.forEach((m, i) => {
        const orig = crystalOriginalMatsRef.current[i]
        if (orig) m.material = orig
      })
    }
  }, [isCrystalActivated, isListening, isSpeaking, isThinking])

  const handlePrimitiveClick = (e: ThreeEvent<MouseEvent>) => {
    // Check if the click hit a crystal ball mesh
    const crystalMeshes = crystalMeshesRef.current
    let obj: THREE.Object3D | null = e.object
    while (obj) {
      if (crystalMeshes.includes(obj as THREE.Mesh)) {
        e.stopPropagation()
        onCrystalClick?.()
        return
      }
      obj = obj.parent
    }
  }

  useFrame((_, delta) => {
    // Rotate crystal ball mist
    if (mistRef.current) {
      mistRef.current.rotateY(delta * 0.5)
    }

    // Update book animation mixer
    mixerRef.current?.update(delta)

    // Raycast from camera center to drive book open/close animation.
    // Keep this active in both cinematic and look modes so the effect
    // is not lost when interaction mode changes.
    if (bookActionRef.current && bookMeshesRef.current.length > 0) {
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
      <primitive object={scene} onClick={handlePrimitiveClick} />
      {isCrystalActivated && crystalInfo && (
        <group position={crystalInfo.center}>
          <CrystalSwirl radius={crystalInfo.radius} />
          <CrystalFog   radius={crystalInfo.radius} />
          <GlowShell    radius={crystalInfo.radius} />
          <GlobeParticles radius={crystalInfo.radius} />
        </group>
      )}
    </group>
  )
}

useGLTF.preload('/models/Office_anim.glb')
