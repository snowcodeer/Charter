'use client'

import { useState, useRef, useEffect } from 'react'
import { searchAirports, type Airport } from '@/lib/data/airports'
import { useGlobeStore } from '@/components/scene/globe/useGlobeStore'

interface DestinationSearchProps {
  /** When true, renders inline for embedding in sidebar */
  inline?: boolean
  variant?: 'parchment' | 'dark'
}

export function DestinationSearch({ inline = false, variant = 'parchment' }: DestinationSearchProps) {
  const dark = variant === 'dark'
  const [fromQuery, setFromQuery] = useState('')
  const [toQuery, setToQuery] = useState('')
  const [fromAirport, setFromAirport] = useState<Airport | null>(null)
  const [toAirport, setToAirport] = useState<Airport | null>(null)
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const { setMarkers, setArcs, setFocusTarget, clearAll } = useGlobeStore()

  const fromResults = activeField === 'from' ? searchAirports(fromQuery) : []
  const toResults = activeField === 'to' ? searchAirports(toQuery) : []

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setActiveField(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Update globe when airports are selected
  useEffect(() => {
    const markers = []
    if (fromAirport) {
      markers.push({
        id: 'dest-from',
        lat: fromAirport.lat,
        lng: fromAirport.lng,
        label: `${fromAirport.city} (${fromAirport.iata})`,
        type: 'origin' as const,
      })
    }
    if (toAirport) {
      markers.push({
        id: 'dest-to',
        lat: toAirport.lat,
        lng: toAirport.lng,
        label: `${toAirport.city} (${toAirport.iata})`,
        type: 'destination' as const,
      })
    }
    setMarkers(markers)

    if (fromAirport && toAirport) {
      setArcs([{
        id: 'dest-arc',
        from: { lat: fromAirport.lat, lng: fromAirport.lng, label: fromAirport.iata },
        to: { lat: toAirport.lat, lng: toAirport.lng, label: toAirport.iata },
      }])
      setFocusTarget({
        lat: (fromAirport.lat + toAirport.lat) / 2,
        lng: (fromAirport.lng + toAirport.lng) / 2,
      })
    } else if (fromAirport) {
      setArcs([])
      setFocusTarget({ lat: fromAirport.lat, lng: fromAirport.lng })
    } else if (toAirport) {
      setArcs([])
      setFocusTarget({ lat: toAirport.lat, lng: toAirport.lng })
    } else {
      setArcs([])
    }
  }, [fromAirport, toAirport, setMarkers, setArcs, setFocusTarget])

  function selectFrom(airport: Airport) {
    setFromAirport(airport)
    setFromQuery(`${airport.city} (${airport.iata})`)
    setActiveField(null)
  }

  function selectTo(airport: Airport) {
    setToAirport(airport)
    setToQuery(`${airport.city} (${airport.iata})`)
    setActiveField(null)
  }

  function handleClear() {
    setFromQuery('')
    setToQuery('')
    setFromAirport(null)
    setToAirport(null)
    setActiveField(null)
    clearAll()
  }

  // Inline version for sidebar
  if (inline) {
    return (
      <div ref={panelRef}>
        <div className="flex items-center justify-between">
          <p className={`text-xs uppercase tracking-wider font-semibold ${dark ? 'text-[#9a8a6e]' : 'text-[#6b5344]'}`}>
            Route Search
          </p>
          {(fromAirport || toAirport) && (
            <button
              type="button"
              onClick={handleClear}
              className={`text-xs ${dark ? 'text-[#6b5a46] hover:text-[#e8dcc4]' : 'text-[#8b7355] hover:text-[#4a3728]'} transition-colors`}
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-1.5 flex flex-col gap-2">
          {/* From */}
          <div className="relative">
            <label className={`text-[10px] uppercase tracking-wider ${dark ? 'text-[#6b5a46]' : 'text-[#8b7355]'}`}>From</label>
            <input
              type="text"
              value={fromQuery}
              onChange={(e) => { setFromQuery(e.target.value); setFromAirport(null); setActiveField('from') }}
              onFocus={() => setActiveField('from')}
              placeholder="City or airport code..."
              className={`w-full mt-0.5 px-2.5 py-1.5 rounded-lg border text-sm outline-none ${
                dark
                  ? 'bg-[#1e1612] border-[#4a382a] text-[#e8dcc4] placeholder-[#6b5a46] focus:border-[#c4a455]'
                  : 'border-[#8b7355] bg-[rgba(42,31,24,0.06)] text-[#2a1f18]'
              }`}
            />
            {fromResults.length > 0 && (dark ? <DarkDropdown results={fromResults} onSelect={selectFrom} /> : <InlineDropdown results={fromResults} onSelect={selectFrom} />)}
          </div>

          {/* To */}
          <div className="relative">
            <label className={`text-[10px] uppercase tracking-wider ${dark ? 'text-[#6b5a46]' : 'text-[#8b7355]'}`}>To</label>
            <input
              type="text"
              value={toQuery}
              onChange={(e) => { setToQuery(e.target.value); setToAirport(null); setActiveField('to') }}
              onFocus={() => setActiveField('to')}
              placeholder="City or airport code..."
              className={`w-full mt-0.5 px-2.5 py-1.5 rounded-lg border text-sm outline-none ${
                dark
                  ? 'bg-[#1e1612] border-[#4a382a] text-[#e8dcc4] placeholder-[#6b5a46] focus:border-[#c4a455]'
                  : 'border-[#8b7355] bg-[rgba(42,31,24,0.06)] text-[#2a1f18]'
              }`}
            />
            {toResults.length > 0 && (dark ? <DarkDropdown results={toResults} onSelect={selectTo} /> : <InlineDropdown results={toResults} onSelect={selectTo} />)}
          </div>
        </div>
      </div>
    )
  }

  // Floating dark version (unused now but kept for flexibility)
  return (
    <div
      ref={panelRef}
      className="fixed top-16 right-4 z-30 w-72 rounded-lg border border-[#8b7355]/60 bg-[#1a1410]/80 backdrop-blur-md p-3 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#d4b896] uppercase tracking-wider font-semibold">Route Search</span>
        {(fromAirport || toAirport) && (
          <button type="button" onClick={handleClear} className="text-[10px] px-2 py-0.5 rounded-full border border-[#6b5344] text-[#b8956f] hover:text-[#e8cdb5] transition-colors">
            Clear
          </button>
        )}
      </div>

      <div className="relative">
        <label className="text-[10px] text-[#8b7355] uppercase tracking-wider">From</label>
        <input type="text" value={fromQuery} onChange={(e) => { setFromQuery(e.target.value); setFromAirport(null); setActiveField('from') }} onFocus={() => setActiveField('from')} placeholder="City or airport code..." className="w-full mt-0.5 px-2.5 py-1.5 rounded border border-[#6b5344]/60 bg-[#2a1f18]/60 text-sm text-[#faf5f0] outline-none placeholder:text-[#6b5344] focus:border-[#8b7355]" />
        {fromResults.length > 0 && <Dropdown results={fromResults} onSelect={selectFrom} />}
      </div>

      <div className="relative">
        <label className="text-[10px] text-[#8b7355] uppercase tracking-wider">To</label>
        <input type="text" value={toQuery} onChange={(e) => { setToQuery(e.target.value); setToAirport(null); setActiveField('to') }} onFocus={() => setActiveField('to')} placeholder="City or airport code..." className="w-full mt-0.5 px-2.5 py-1.5 rounded border border-[#6b5344]/60 bg-[#2a1f18]/60 text-sm text-[#faf5f0] outline-none placeholder:text-[#6b5344] focus:border-[#8b7355]" />
        {toResults.length > 0 && <Dropdown results={toResults} onSelect={selectTo} />}
      </div>
    </div>
  )
}

function DarkDropdown({ results, onSelect }: { results: Airport[]; onSelect: (a: Airport) => void }) {
  return (
    <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-[#4a382a] bg-[#1e1612] z-50 max-h-48 overflow-y-auto">
      {results.map((a) => (
        <button
          key={a.iata}
          type="button"
          onClick={() => onSelect(a)}
          className="w-full text-left px-3 py-1.5 hover:bg-[#2a1f18] transition-colors flex items-center gap-2"
        >
          <span className="text-xs font-mono text-[#c4a455]">{a.iata}</span>
          <span className="text-xs text-[#e8dcc4] truncate">{a.city} — {a.name}</span>
        </button>
      ))}
    </div>
  )
}

function InlineDropdown({ results, onSelect }: { results: Airport[]; onSelect: (a: Airport) => void }) {
  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 rounded border z-50 max-h-36 overflow-y-auto"
      style={{ borderColor: '#8b7355', backgroundColor: '#f0ddc0' }}
    >
      {results.map((a) => (
        <button
          key={a.iata}
          type="button"
          onClick={() => onSelect(a)}
          className="w-full text-left px-2 py-1 text-sm hover:bg-[#e8cdb0] transition-colors flex items-center gap-2"
          style={{ color: '#2a1f18' }}
        >
          <span className="font-mono" style={{ fontSize: 11, color: '#6b5344' }}>{a.iata}</span>
          <span style={{ fontSize: 12 }} className="truncate">{a.city} — {a.name}</span>
        </button>
      ))}
    </div>
  )
}

function Dropdown({ results, onSelect }: { results: Airport[]; onSelect: (a: Airport) => void }) {
  return (
    <div className="absolute left-0 right-0 top-full mt-1 rounded border border-[#6b5344]/60 bg-[#1a1410]/95 backdrop-blur-md z-50 max-h-48 overflow-y-auto">
      {results.map((a) => (
        <button
          key={a.iata}
          type="button"
          onClick={() => onSelect(a)}
          className="w-full text-left px-2.5 py-1.5 hover:bg-[#2a1f18]/80 transition-colors flex items-center gap-2"
        >
          <span className="text-xs font-mono text-[#d4b896]">{a.iata}</span>
          <span className="text-xs text-[#e8cdb5] truncate">{a.city} — {a.name}</span>
        </button>
      ))}
    </div>
  )
}
