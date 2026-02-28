import { create } from 'zustand'

export interface GlobeArc {
  id: string
  from: { lat: number; lng: number; label?: string }
  to: { lat: number; lng: number; label?: string }
  color?: string
}

export interface GlobeMarker {
  id: string
  lat: number
  lng: number
  label: string
  type: 'origin' | 'destination'
  color?: string
}

interface GlobeState {
  arcs: GlobeArc[]
  markers: GlobeMarker[]
  isFocused: boolean
  focusedCountry: string | null
  selectedNationality: string | null
  highlightedCountries: string[]
  hoveredCountry: { name: string; iso3: string; screenX: number; screenY: number } | null

  setArcs: (arcs: GlobeArc[]) => void
  addArc: (arc: GlobeArc) => void
  setMarkers: (markers: GlobeMarker[]) => void
  addMarker: (marker: GlobeMarker) => void
  setFocused: (focused: boolean) => void
  setFocusedCountry: (country: string | null) => void
  setSelectedNationality: (code: string | null) => void
  setHighlightedCountries: (codes: string[]) => void
  setHoveredCountry: (country: GlobeState['hoveredCountry']) => void
  clearAll: () => void
}

export const useGlobeStore = create<GlobeState>((set) => ({
  arcs: [],
  markers: [],
  isFocused: false,
  focusedCountry: null,
  selectedNationality: null,
  highlightedCountries: [],
  hoveredCountry: null,

  setArcs: (arcs) => set({ arcs }),
  addArc: (arc) => set((s) => ({ arcs: [...s.arcs, arc] })),
  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => set((s) => ({ markers: [...s.markers, marker] })),
  setFocused: (isFocused) => set({ isFocused }),
  setFocusedCountry: (focusedCountry) => set({ focusedCountry }),
  setSelectedNationality: (selectedNationality) => set({ selectedNationality }),
  setHighlightedCountries: (highlightedCountries) => set({ highlightedCountries }),
  setHoveredCountry: (hoveredCountry) => set({ hoveredCountry }),
  clearAll: () => set({ arcs: [], markers: [], focusedCountry: null }),
}))
