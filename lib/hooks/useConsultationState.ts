'use client'

export type ConsultationState = 'idle' | 'listening' | 'processing' | 'revealing'

export interface ConsultationStateInput {
  isRecording: boolean
  isLoading: boolean
  streamingText: string
}

export function useConsultationState(input: ConsultationStateInput): ConsultationState {
  const { isRecording, isLoading, streamingText } = input

  if (isRecording) return 'listening'
  if (isLoading && !streamingText) return 'processing'
  if (streamingText.length > 0) return 'revealing'

  return 'idle'
}
