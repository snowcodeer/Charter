'use client'

import { useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import { latLngToVector3 } from './globe-utils'

interface CountryBordersProps {
  radius: number
}

interface TopoJSON {
  type: string
  objects: Record<string, TopoObject>
  arcs: number[][][]
  transform?: {
    scale: [number, number]
    translate: [number, number]
  }
}

interface TopoObject {
  type: string
  geometries: TopoGeometry[]
}

interface TopoGeometry {
  type: string
  arcs: number[] | number[][] | number[][][]
  properties?: { name?: string }
}

/** Decode a TopoJSON arc index array into coordinates */
function decodeArcs(topo: TopoJSON): number[][][] {
  const { arcs, transform } = topo
  const scale = transform?.scale || [1, 1]
  const translate = transform?.translate || [0, 0]

  return arcs.map((arc) => {
    let x = 0, y = 0
    return arc.map(([dx, dy]) => {
      x += dx
      y += dy
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]]
    })
  })
}

/** Resolve arc references in a TopoJSON geometry */
function resolveArcs(arcRefs: number[], decodedArcs: number[][][]): number[][] {
  const coords: number[][] = []
  for (const ref of arcRefs) {
    const arc = ref >= 0 ? decodedArcs[ref] : [...decodedArcs[~ref]].reverse()
    coords.push(...arc)
  }
  return coords
}

export function CountryBorders({ radius }: CountryBordersProps) {
  const [topo, setTopo] = useState<TopoJSON | null>(null)

  useEffect(() => {
    fetch('/data/countries-110m.json')
      .then((r) => r.json())
      .then(setTopo)
      .catch((err) => console.warn('[CountryBorders] Failed to load:', err))
  }, [])

  const geometry = useMemo(() => {
    if (!topo) return null

    const decodedArcs = decodeArcs(topo)
    const positions: number[] = []
    const surfaceRadius = radius * 1.001 // Slightly above surface

    const countriesObj = topo.objects.countries || Object.values(topo.objects)[0]
    if (!countriesObj) return null

    for (const geo of countriesObj.geometries) {
      let rings: number[][][] = []

      if (geo.type === 'Polygon') {
        rings = (geo.arcs as number[][]).map((ring) => resolveArcs(ring, decodedArcs))
      } else if (geo.type === 'MultiPolygon') {
        for (const polygon of geo.arcs as number[][][]) {
          for (const ring of polygon) {
            rings.push(resolveArcs(ring, decodedArcs))
          }
        }
      }

      for (const ring of rings) {
        for (let i = 0; i < ring.length - 1; i++) {
          const [lng1, lat1] = ring[i]
          const [lng2, lat2] = ring[i + 1]
          const p1 = latLngToVector3(lat1, lng1, surfaceRadius)
          const p2 = latLngToVector3(lat2, lng2, surfaceRadius)
          positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
        }
      }
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geom
  }, [topo, radius])

  if (!geometry) return null

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#5c4a3a" transparent opacity={0.6} />
    </lineSegments>
  )
}
