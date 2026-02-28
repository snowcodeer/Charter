'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { latLngToVector3 } from './globe-utils'
import { useCountryData } from './useCountryData'
import { useGlobeStore } from './useGlobeStore'

interface CountryBordersProps {
  radius: number
}

export function CountryBorders({ radius }: CountryBordersProps) {
  const countries = useCountryData()
  const highlightedCountries = useGlobeStore((s) => s.highlightedCountries)

  const { normalGeometry, highlightGeometry } = useMemo(() => {
    if (!countries) return { normalGeometry: null, highlightGeometry: null }

    const highlightSet = new Set(highlightedCountries)
    const normalPositions: number[] = []
    const highlightPositions: number[] = []
    const normalRadius = radius * 1.001
    const highlightRadius = radius * 1.003

    for (const country of countries) {
      const isHighlighted = country.iso3 !== undefined && highlightSet.has(country.iso3)
      const target = isHighlighted ? highlightPositions : normalPositions
      const r = isHighlighted ? highlightRadius : normalRadius

      for (const polygon of country.rings) {
        for (const ring of polygon) {
          for (let i = 0; i < ring.length - 1; i++) {
            const [lng1, lat1] = ring[i]
            const [lng2, lat2] = ring[i + 1]
            const p1 = latLngToVector3(lat1, lng1, r)
            const p2 = latLngToVector3(lat2, lng2, r)
            target.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
          }
        }
      }
    }

    const nGeom = normalPositions.length > 0 ? new THREE.BufferGeometry() : null
    if (nGeom) {
      nGeom.setAttribute('position', new THREE.Float32BufferAttribute(normalPositions, 3))
    }

    const hGeom = highlightPositions.length > 0 ? new THREE.BufferGeometry() : null
    if (hGeom) {
      hGeom.setAttribute('position', new THREE.Float32BufferAttribute(highlightPositions, 3))
    }

    return { normalGeometry: nGeom, highlightGeometry: hGeom }
  }, [countries, highlightedCountries, radius])

  return (
    <>
      {normalGeometry && (
        <lineSegments geometry={normalGeometry}>
          <lineBasicMaterial color="#5c4a3a" transparent opacity={0.6} />
        </lineSegments>
      )}
      {highlightGeometry && (
        <lineSegments geometry={highlightGeometry}>
          <lineBasicMaterial color="#ffffff" transparent opacity={1.0} />
        </lineSegments>
      )}
    </>
  )
}
