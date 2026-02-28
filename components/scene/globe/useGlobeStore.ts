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

  setArcs: (arcs: GlobeArc[]) => void
  addArc: (arc: GlobeArc) => void
  setMarkers: (markers: GlobeMarker[]) => void
  addMarker: (marker: GlobeMarker) => void
  setFocused: (focused: boolean) => void
  setFocusedCountry: (country: string | null) => void
  clearAll: () => void
}

export const useGlobeStore = create<GlobeState>((set) => ({
  arcs: [],
  markers: [],
  isFocused: false,
  focusedCountry: null,

  setArcs: (arcs) => set({ arcs }),
  addArc: (arc) => set((s) => ({ arcs: [...s.arcs, arc] })),
  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => set((s) => ({ markers: [...s.markers, marker] })),
  setFocused: (isFocused) => set({ isFocused }),
  setFocusedCountry: (focusedCountry) => set({ focusedCountry }),
  clearAll: () => set({ arcs: [], markers: [], focusedCountry: null }),
}))
