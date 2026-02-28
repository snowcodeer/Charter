import WebSocket from 'ws'

interface TTSConfig {
  voiceId: string
  apiKey: string
  onAudioChunk: (base64Audio: string) => void
  onError: (error: string) => void
  onDone: () => void
}

export class ElevenLabsTTS {
  private ws: WebSocket | null = null
  private config: TTSConfig
  private isClosed = false

  constructor(config: TTSConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_24000`

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)

      this.ws.on('open', () => {
        // BOS message — configure voice + auth
        this.ws!.send(JSON.stringify({
          text: ' ',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.0,
          },
          generation_config: {
            chunk_length_schedule: [50, 80, 120, 200],
          },
          xi_api_key: this.config.apiKey,
        }))
        resolve()
      })

      this.ws.on('message', (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.audio) {
            this.config.onAudioChunk(msg.audio)
          }
          if (msg.isFinal) {
            this.config.onDone()
          }
        } catch { /* ignore non-JSON */ }
      })

      this.ws.on('error', (err) => {
        this.config.onError(err.message)
        reject(err)
      })

      this.ws.on('close', () => {
        this.isClosed = true
      })
    })
  }

  sendText(token: string): void {
    if (!this.ws || this.isClosed || this.ws.readyState !== WebSocket.OPEN) return
    // ElevenLabs requires text to end with a space
    this.ws.send(JSON.stringify({
      text: token,
      try_trigger_generation: false,
    }))
  }

  flush(): void {
    if (!this.ws || this.isClosed || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({
      text: ' ',
      flush: true,
    }))
  }

  close(): void {
    if (!this.ws || this.isClosed || this.ws.readyState !== WebSocket.OPEN) return
    // EOS — empty string signals end of stream
    this.ws.send(JSON.stringify({ text: '' }))
  }
}
