'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import { geoEquirectangular, geoPath, geoGraticule } from 'd3-geo'
import * as topojson from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'

interface GlobeSphereProps {
  radius: number
}

const TEX_W = 2048
const TEX_H = 1024

function renderParchmentMap(topo: Topology): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d')!

  // Ocean — light warm parchment
  ctx.fillStyle = '#f2e8d0'
  ctx.fillRect(0, 0, TEX_W, TEX_H)

  const projection = geoEquirectangular()
    .fitSize([TEX_W, TEX_H], { type: 'Sphere' })
  const path = geoPath(projection, ctx)

  // Graticule lines — faint grid
  const graticule = geoGraticule().step([15, 15])
  ctx.beginPath()
  path(graticule())
  ctx.strokeStyle = '#d4c4a0'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // Land fills
  const countriesObj = topo.objects.countries || Object.values(topo.objects)[0]
  if (countriesObj) {
    const land = topojson.feature(topo, countriesObj as GeometryCollection)
    ctx.beginPath()
    path(land)
    ctx.fillStyle = '#c4ad88'
    ctx.fill()
  }

  // Country borders — darker brown
  if (countriesObj) {
    const mesh = topojson.mesh(topo, countriesObj as GeometryCollection)
    ctx.beginPath()
    path(mesh)
    ctx.strokeStyle = '#9a8a6e'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  // Coastline — darker outline
  if (countriesObj) {
    const land = topojson.feature(topo, countriesObj as GeometryCollection)
    ctx.beginPath()
    path(land)
    ctx.strokeStyle = '#8a7a62'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  // Slight paper grain noise
  const imageData = ctx.getImageData(0, 0, TEX_W, TEX_H)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12
    d[i] = Math.min(255, Math.max(0, d[i] + noise))
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise))
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise))
  }
  ctx.putImageData(imageData, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function ParchmentSphere({ radius }: GlobeSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [topo, setTopo] = useState<Topology | null>(null)

  useEffect(() => {
    fetch('/data/countries-110m.json').then(r => r.json()).then(setTopo)
  }, [])

  const texture = useMemo(() => {
    if (!topo) return null
    return renderParchmentMap(topo)
  }, [topo])

  if (!texture) {
    return (
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 64, 48]} />
        <meshStandardMaterial color="#a08c6a" roughness={0.85} metalness={0.05} />
      </mesh>
    )
  }

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 64, 48]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  )
}

export function GlobeSphere({ radius }: GlobeSphereProps) {
  return <ParchmentSphere radius={radius} />
}
