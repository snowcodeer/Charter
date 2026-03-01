'use client'

import { useEffect, useState } from 'react'
import { useGlobeStore } from './useGlobeStore'

type VisaData = Record<string, Record<string, string>>

const VISA_LABELS: Record<string, string> = {
  vf: 'Visa-free',
  voa: 'Visa on arrival',
  eta: 'eTA required',
  vr: 'Visa required',
  na: 'Not available',
}

const VISA_COLORS: Record<string, string> = {
  vf: '#c4a455',
  voa: '#b08040',
  eta: '#b08040',
  vr: '#8b4040',
  na: '#666',
}

export function GlobeTooltip() {
  const hovered = useGlobeStore((s) => s.hoveredCountry)
  const selectedNationality = useGlobeStore((s) => s.selectedNationality)
  const [visaData, setVisaData] = useState<VisaData | null>(null)

  useEffect(() => {
    fetch('/data/visa-requirements.json').then(r => r.json()).then(setVisaData)
  }, [])

  if (!hovered) return null

  const passportData = selectedNationality && visaData ? visaData[selectedNationality] : null
  const visaStatus = passportData ? passportData[hovered.iso3] : undefined
  const isSelf = hovered.iso3 === selectedNationality

  return (
    <div
      className="fixed z-30 pointer-events-none"
      style={{
        left: hovered.screenX,
        top: hovered.screenY,
        transform: 'translate(-50%, -100%) translateY(-12px)',
      }}
    >
      <div className="bg-[#1a1410]/90 border border-[#3d2e22] rounded px-3 py-2 shadow-lg min-w-[120px]">
        <p className="text-sm font-medium text-[#e8dcc4]">{hovered.name}</p>
        <p className="text-xs text-[#9a8a6e]">{hovered.iso3}</p>
        {isSelf && (
          <p className="text-xs mt-1" style={{ color: '#4a6a8a' }}>Your nationality</p>
        )}
        {!isSelf && visaStatus && (
          <p className="text-xs mt-1" style={{ color: VISA_COLORS[visaStatus] || '#666' }}>
            {VISA_LABELS[visaStatus] || visaStatus}
          </p>
        )}
        {!isSelf && selectedNationality && !visaStatus && (
          <p className="text-xs mt-1 text-[#6b5a46]">No visa data</p>
        )}
      </div>
    </div>
  )
}
