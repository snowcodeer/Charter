'use client'

export interface SiriOrbProps {
  size?: number
  isListening?: boolean
  isSpeaking?: boolean
  isThinking?: boolean
  onClick?: () => void
}

export function SiriOrb({
  size = 192,
  isListening = false,
  isSpeaking = false,
  isThinking = false,
  onClick,
}: SiriOrbProps) {
  const duration = isListening ? 4 : isSpeaking ? 6 : isThinking ? 10 : 20
  const scale = isListening ? 1.1 : isSpeaking ? 1.05 : 1

  // Bright, visible colors for each state
  const colors = isListening
    ? { bg: '#1a0a0a', c1: '#ff4466', c2: '#ff2288', c3: '#cc3355' }
    : isSpeaking
    ? { bg: '#0a0a1a', c1: '#8844ff', c2: '#6633ee', c3: '#aa55ff' }
    : isThinking
    ? { bg: '#0a0a14', c1: '#4488cc', c2: '#3366aa', c3: '#5577bb' }
    : { bg: '#0a0a10', c1: '#6644aa', c2: '#4433aa', c3: '#5544cc' }

  const blurAmount = Math.max(size * 0.015, 4)
  const contrastAmount = Math.max(size * 0.008, 1.5)
  const dotSize = Math.max(size * 0.008, 0.1)
  const shadowSpread = Math.max(size * 0.008, 2)

  const glowColor = isListening
    ? 'rgba(255,68,102,0.4)'
    : isSpeaking
    ? 'rgba(136,68,255,0.35)'
    : isThinking
    ? 'rgba(68,136,204,0.2)'
    : 'rgba(100,68,170,0.15)'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Inline CSS — must be in component so @property works (Tailwind v4 strips it from globals) */}
      <style>{`
        @property --orb-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        .charter-orb {
          display: grid;
          grid-template-areas: "stack";
          overflow: hidden;
          border-radius: 50%;
          position: relative;
        }

        .charter-orb::before,
        .charter-orb::after {
          content: "";
          display: block;
          grid-area: stack;
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }

        .charter-orb::before {
          background:
            conic-gradient(from calc(var(--orb-angle) * 2) at 25% 70%, var(--c3), transparent 20% 80%, var(--c3)),
            conic-gradient(from calc(var(--orb-angle) * 2) at 45% 75%, var(--c2), transparent 30% 60%, var(--c2)),
            conic-gradient(from calc(var(--orb-angle) * -3) at 80% 20%, var(--c1), transparent 40% 60%, var(--c1)),
            conic-gradient(from calc(var(--orb-angle) * 2) at 15% 5%, var(--c2), transparent 10% 90%, var(--c2)),
            conic-gradient(from calc(var(--orb-angle) * 1) at 20% 80%, var(--c1), transparent 10% 90%, var(--c1)),
            conic-gradient(from calc(var(--orb-angle) * -2) at 85% 10%, var(--c3), transparent 20% 80%, var(--c3));
          box-shadow: inset var(--bg) 0 0 var(--shadow-spread) calc(var(--shadow-spread) * 0.2);
          filter: blur(var(--blur-amount)) contrast(var(--contrast-amount));
          animation: charter-orb-rotate var(--animation-duration) linear infinite;
        }

        .charter-orb::after {
          background-image: radial-gradient(circle at center, var(--bg) var(--dot-size), transparent var(--dot-size));
          background-size: calc(var(--dot-size) * 2) calc(var(--dot-size) * 2);
          backdrop-filter: blur(calc(var(--blur-amount) * 2)) contrast(calc(var(--contrast-amount) * 2));
          mix-blend-mode: overlay;
          mask-image: radial-gradient(black var(--mask-radius), transparent 75%);
        }

        @keyframes charter-orb-rotate {
          to { --orb-angle: 360deg; }
        }

        @keyframes charter-orb-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>

      {/* Glow */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-700"
        style={{
          boxShadow: `0 0 ${size * 0.4}px ${size * 0.1}px ${glowColor}`,
        }}
      />

      {/* Orb */}
      <div
        className="charter-orb cursor-pointer transition-transform duration-500 ease-out"
        style={{
          width: size,
          height: size,
          transform: `scale(${scale})`,
          '--bg': colors.bg,
          '--c1': colors.c1,
          '--c2': colors.c2,
          '--c3': colors.c3,
          '--animation-duration': `${duration}s`,
          '--blur-amount': `${blurAmount}px`,
          '--contrast-amount': String(contrastAmount),
          '--dot-size': `${dotSize}px`,
          '--shadow-spread': `${shadowSpread}px`,
          '--mask-radius': '25%',
        } as React.CSSProperties}
        onClick={onClick}
      />

      {/* Pulse ring when listening */}
      {isListening && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: '1px solid rgba(255,68,102,0.4)',
            animation: 'charter-orb-pulse 2s ease-out infinite',
          }}
        />
      )}
    </div>
  )
}
