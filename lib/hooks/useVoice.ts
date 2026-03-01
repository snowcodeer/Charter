'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVoiceOptions {
  onTranscript: (text: string) => void
  onPartialTranscript?: (text: string) => void
}

export function useVoice({ onTranscript, onPartialTranscript }: UseVoiceOptions) {
  const [voiceMode, setVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Audio playback refs
  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextPlayTimeRef = useRef(0)
  const playingCountRef = useRef(0)

  // STT refs
  const sttWsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const micCtxRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  // When true, the main ws.onmessage should NOT fire onTranscript for committed_transcript
  // because stopRecording's dedicated handler will handle it instead
  const suppressMainHandlerRef = useRef(false)

  // Stable refs for callbacks
  const onTranscriptRef = useRef(onTranscript)
  const onPartialRef = useRef(onPartialTranscript)
  onTranscriptRef.current = onTranscript
  onPartialRef.current = onPartialTranscript

  // --- Audio Playback (TTS) ---

  function getAudioContext(): AudioContext {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 })
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }

  const handleAudioChunk = useCallback((base64: string) => {
    const ctx = getAudioContext()

    const binaryStr = atob(base64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    const int16 = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000)
    audioBuffer.getChannelData(0).set(float32)

    const now = ctx.currentTime
    if (nextPlayTimeRef.current < now) {
      nextPlayTimeRef.current = now
    }

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.start(nextPlayTimeRef.current)
    nextPlayTimeRef.current += audioBuffer.duration

    playingCountRef.current++
    setIsPlaying(true)

    source.onended = () => {
      playingCountRef.current--
      if (playingCountRef.current <= 0) {
        playingCountRef.current = 0
        setIsPlaying(false)
      }
    }
  }, [])

  const handleAudioDone = useCallback(() => {
    // All audio chunks received — playback continues from queue
  }, [])

  const stopPlayback = useCallback(() => {
    nextPlayTimeRef.current = 0
    playingCountRef.current = 0
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    setIsPlaying(false)
  }, [])

  // --- STT (Mic → ElevenLabs → Text) ---

  const startRecording = useCallback(async () => {
    try {
      console.log('[STT] Starting recording...')

      // 1. Get auth from server
      const tokenRes = await fetch('/api/agent/stt-token', { method: 'POST' })
      const tokenData = await tokenRes.json()

      if (tokenData.error) {
        console.error('[STT] Token error:', tokenData.error)
        return
      }

      const authParam = tokenData.token
        ? `token=${tokenData.token}`
        : `xi-api-key=${tokenData.apiKey}`

      console.log('[STT] Auth obtained, connecting WebSocket...')

      // 2. Connect STT WebSocket
      const sttUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&${authParam}&audio_format=pcm_16000&commit_strategy=vad&vad_silence_threshold_secs=1.0`
      const ws = new WebSocket(sttUrl)
      sttWsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          console.log('[STT] Message:', msg.message_type, msg.text?.slice(0, 50) || '')

          if (msg.message_type === 'committed_transcript' && msg.text?.trim()) {
            console.log('[STT] COMMITTED:', msg.text.trim())
            // Skip if stopRecording's dedicated handler is handling this
            if (suppressMainHandlerRef.current) {
              console.log('[STT] Suppressed main handler — stopRecording handler will fire')
            } else {
              onTranscriptRef.current(msg.text.trim())
            }
          } else if (msg.message_type === 'partial_transcript' && msg.text?.trim()) {
            onPartialRef.current?.(msg.text.trim())
          } else if (msg.message_type === 'session_started') {
            console.log('[STT] Session started:', msg)
          } else if (msg.message_type === 'error') {
            console.error('[STT] Server error:', msg)
          }
        } catch { /* ignore non-JSON */ }
      }

      ws.onerror = (e) => console.error('[STT] WebSocket error:', e)
      ws.onclose = (e) => console.log('[STT] WebSocket closed:', e.code, e.reason)

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const origOnOpen = ws.onopen
        ws.onopen = (e) => {
          if (origOnOpen) (origOnOpen as (e: Event) => void)(e)
          console.log('[STT] WebSocket connected')
          resolve()
        }
        const timeout = setTimeout(() => reject(new Error('STT connection timeout')), 5000)
        ws.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('STT WebSocket failed')) }, { once: true })
      })

      // 3. Capture mic audio
      console.log('[STT] Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      mediaStreamRef.current = stream
      console.log('[STT] Microphone granted, setting up AudioWorklet...')

      // 4. AudioWorklet for PCM capture
      const micCtx = new AudioContext({ sampleRate: 16000 })
      micCtxRef.current = micCtx

      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0]?.[0]
            if (input) {
              this.port.postMessage(input)
            }
            return true
          }
        }
        registerProcessor('pcm-processor', PCMProcessor)
      `
      const blob = new Blob([workletCode], { type: 'application/javascript' })
      const workletUrl = URL.createObjectURL(blob)
      await micCtx.audioWorklet.addModule(workletUrl)
      URL.revokeObjectURL(workletUrl)

      const source = micCtx.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(micCtx, 'pcm-processor')
      workletNodeRef.current = workletNode

      let chunkCount = 0
      workletNode.port.onmessage = (e: MessageEvent) => {
        if (!sttWsRef.current || sttWsRef.current.readyState !== WebSocket.OPEN) return
        const float32 = e.data as Float32Array

        // Float32 → Int16 PCM
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Int16 → base64
        const uint8 = new Uint8Array(int16.buffer)
        let binary = ''
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i])
        }

        sttWsRef.current.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: btoa(binary),
        }))

        chunkCount++
        if (chunkCount % 100 === 0) {
          console.log(`[STT] Sent ${chunkCount} audio chunks`)
        }
      }

      source.connect(workletNode)
      workletNode.connect(micCtx.destination)
      setIsRecording(true)
      console.log('[STT] Recording started successfully')
    } catch (err) {
      console.error('[STT] Failed to start:', err)
    }
  }, [])

  const stopRecording = useCallback(async () => {
    console.log('[STT] Stopping recording...')

    // 1. Stop mic first so no more audio is sent
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (micCtxRef.current && micCtxRef.current.state !== 'closed') {
      micCtxRef.current.close()
      micCtxRef.current = null
    }

    // 2. Force-commit any pending transcript before closing
    if (sttWsRef.current && sttWsRef.current.readyState === WebSocket.OPEN) {
      console.log('[STT] Sending force-commit...')

      // Suppress the main onmessage handler so only our dedicated handler fires
      suppressMainHandlerRef.current = true

      // Send a silent chunk with commit=true to force-commit
      sttWsRef.current.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: btoa(String.fromCharCode(...new Uint8Array(640))), // 320 samples of silence (20ms at 16kHz)
        commit: true,
      }))

      // Wait briefly for committed_transcript to come back
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 1500)
        const ws = sttWsRef.current
        if (!ws) { clearTimeout(timeout); resolve(); return }

        const handler = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.message_type === 'committed_transcript') {
              console.log('[STT] Got final commit:', msg.text)
              if (msg.text?.trim()) {
                onTranscriptRef.current(msg.text.trim())
              }
              clearTimeout(timeout)
              ws.removeEventListener('message', handler)
              resolve()
            }
          } catch { /* ignore */ }
        }
        ws.addEventListener('message', handler)
      })

      // 3. Now close the WebSocket
      suppressMainHandlerRef.current = false
      sttWsRef.current.close()
      sttWsRef.current = null
    }

    setIsRecording(false)
    console.log('[STT] Recording stopped')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Sync cleanup on unmount (can't await)
      if (workletNodeRef.current) { workletNodeRef.current.disconnect(); workletNodeRef.current = null }
      if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null }
      if (micCtxRef.current && micCtxRef.current.state !== 'closed') { micCtxRef.current.close(); micCtxRef.current = null }
      if (sttWsRef.current) { sttWsRef.current.close(); sttWsRef.current = null }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') { audioCtxRef.current.close(); audioCtxRef.current = null }
    }
  }, [])

  return {
    voiceMode,
    setVoiceMode,
    isRecording,
    isPlaying,
    startRecording,
    stopRecording,
    stopPlayback,
    handleAudioChunk,
    handleAudioDone,
  }
}
