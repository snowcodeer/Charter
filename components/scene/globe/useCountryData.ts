'use client'

import { useState, useEffect } from 'react'

// ── TopoJSON types ──────────────────────────────────────────────

export interface TopoJSON {
  type: string
  objects: Record<string, TopoObject>
  arcs: number[][][]
  transform?: {
    scale: [number, number]
    translate: [number, number]
  }
}

export interface TopoObject {
  type: string
  geometries: TopoGeometry[]
}

export interface TopoGeometry {
  type: string
  id?: string
  arcs: number[] | number[][] | number[][][]
  properties?: { name?: string }
}

// ── Decoded country data ────────────────────────────────────────

export interface CountryData {
  /** UN numeric code (e.g. "840") */
  id: string
  /** ISO alpha-3 code (e.g. "USA") */
  iso3: string | undefined
  /** Country name from TopoJSON properties */
  name: string | undefined
  /** Polygon rings: each polygon is [outerRing, ...holeRings], each ring is [lng, lat][] */
  rings: number[][][][]
}

// ── Arc decoding helpers ────────────────────────────────────────

export function decodeArcs(topo: TopoJSON): number[][][] {
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

export function resolveArcs(arcRefs: number[], decodedArcs: number[][][]): number[][] {
  const coords: number[][] = []
  for (const ref of arcRefs) {
    const arc = ref >= 0 ? decodedArcs[ref] : [...decodedArcs[~ref]].reverse()
    coords.push(...arc)
  }
  return coords
}

// ── Singleton cache ─────────────────────────────────────────────

let cachedPromise: Promise<CountryData[]> | null = null

function fetchCountryData(): Promise<CountryData[]> {
  if (cachedPromise) return cachedPromise

  cachedPromise = Promise.all([
    fetch('/data/countries-110m.json').then((r) => r.json()) as Promise<TopoJSON>,
    fetch('/data/un-to-iso.json').then((r) => r.json()) as Promise<Record<string, string>>,
  ]).then(([topo, unToIso]) => {
    const decodedArcs = decodeArcs(topo)
    const countriesObj = topo.objects.countries || Object.values(topo.objects)[0]
    if (!countriesObj) return []

    return countriesObj.geometries.map((geo): CountryData => {
      const rings: number[][][][] = []

      if (geo.type === 'Polygon') {
        const resolved = (geo.arcs as number[][]).map((ring) => resolveArcs(ring, decodedArcs))
        rings.push(resolved)
      } else if (geo.type === 'MultiPolygon') {
        for (const polygon of geo.arcs as number[][][]) {
          const resolved = polygon.map((ring) => resolveArcs(ring, decodedArcs))
          rings.push(resolved)
        }
      }

      return {
        id: geo.id || '',
        iso3: geo.id ? unToIso[geo.id] : undefined,
        name: geo.properties?.name,
        rings,
      }
    })
  })

  return cachedPromise
}

// ── Hook ────────────────────────────────────────────────────────

export function useCountryData(): CountryData[] | null {
  const [data, setData] = useState<CountryData[] | null>(null)

  useEffect(() => {
    fetchCountryData().then(setData)
  }, [])

  return data
}
