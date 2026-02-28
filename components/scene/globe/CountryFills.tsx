'use client'

import { useMemo, useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { geoEquirectangular, geoPath } from 'd3-geo'
import * as topojson from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { useGlobeStore } from './useGlobeStore'

interface CountryFillsProps {
  radius: number
}

type VisaData = Record<string, Record<string, string>>
type UnToIso = Record<string, string>

const COLOR_VISA_FREE = '#c4a455'
const COLOR_VOA = '#b08040'
const COLOR_VISA_REQ = '#8b4040'
const COLOR_SELF = '#4a6a8a'

function getVisaColor(status: string | undefined, isSelf: boolean): string | null {
  if (isSelf) return COLOR_SELF
  if (!status) return null
  switch (status) {
    case 'vf': return COLOR_VISA_FREE
    case 'voa': return COLOR_VOA
    case 'eta': return COLOR_VOA
    case 'vr': return COLOR_VISA_REQ
    case 'na': return COLOR_VISA_REQ
    default: return null
  }
}

const TEX_WIDTH = 2048
const TEX_HEIGHT = 1024

export function CountryFills({ radius }: CountryFillsProps) {
  const [topo, setTopo] = useState<Topology | null>(null)
  const [visaData, setVisaData] = useState<VisaData | null>(null)
  const [unToIso, setUnToIso] = useState<UnToIso | null>(null)
  const selectedNationality = useGlobeStore((s) => s.selectedNationality)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    fetch('/data/countries-110m.json').then(r => r.json()).then(setTopo)
    fetch('/data/visa-requirements.json').then(r => r.json()).then(setVisaData)
    fetch('/data/un-to-iso.json').then(r => r.json()).then(setUnToIso)
  }, [])

  const texture = useMemo(() => {
    if (!topo || !visaData || !unToIso || !selectedNationality) return null

    const canvas = document.createElement('canvas')
    canvas.width = TEX_WIDTH
    canvas.height = TEX_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Equirectangular projection filling the canvas
    const projection = geoEquirectangular()
      .fitSize([TEX_WIDTH, TEX_HEIGHT], { type: 'Sphere' })

    const path = geoPath(projection, ctx)

    // Clear to fully transparent
    ctx.clearRect(0, 0, TEX_WIDTH, TEX_HEIGHT)

    const countriesObj = topo.objects.countries || Object.values(topo.objects)[0]
    if (!countriesObj) return null

    const features = topojson.feature(topo, countriesObj as GeometryCollection).features
    const passportData = visaData[selectedNationality]

    for (const feature of features) {
      const id = String(feature.id ?? '')
      const iso3 = unToIso[id]
      const isSelf = iso3 === selectedNationality
      const status = iso3 && passportData ? passportData[iso3] : undefined
      const color = getVisaColor(status, isSelf)
      if (!color) continue

      ctx.beginPath()
      path(feature)
      ctx.fillStyle = color
      ctx.globalAlpha = 0.8
      ctx.fill()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace

    // Dispose old texture
    if (textureRef.current) textureRef.current.dispose()
    textureRef.current = tex

    return tex
  }, [topo, visaData, unToIso, selectedNationality])

  if (!texture) return null

  return (
    <mesh>
      <sphereGeometry args={[radius * 1.001, 64, 48]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
