import { create } from 'zustand'

interface CrystalBallState {
  isListening: boolean
  isSpeaking: boolean
  isThinking: boolean
  voiceMode: boolean
  setIsListening: (v: boolean) => void
  setIsSpeaking: (v: boolean) => void
  setIsThinking: (v: boolean) => void
  setVoiceMode: (v: boolean) => void
  // Callback set by page, invoked by OfficeModel on click
  onCrystalClick: (() => void) | null
  setOnCrystalClick: (fn: (() => void) | null) => void
}

export const useCrystalBallStore = create<CrystalBallState>((set) => ({
  isListening: false,
  isSpeaking: false,
  isThinking: false,
  voiceMode: false,
  setIsListening: (v) => set({ isListening: v }),
  setIsSpeaking: (v) => set({ isSpeaking: v }),
  setIsThinking: (v) => set({ isThinking: v }),
  setVoiceMode: (v) => set({ voiceMode: v }),
  onCrystalClick: null,
  setOnCrystalClick: (fn) => set({ onCrystalClick: fn }),
}))
