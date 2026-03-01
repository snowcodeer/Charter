'use client'

interface GoogleAuthPromptProps {
  onDismiss: () => void
}

export function GoogleAuthPrompt({ onDismiss }: GoogleAuthPromptProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#faf6ef] text-[#3a2e1f] rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold font-serif">Connect Your Google Account</h2>
          <p className="text-sm text-[#8b7a60]">
            Connecting Google unlocks calendar, Gmail, and Drive features — letting Charter
            manage your travel plans, itineraries, and documents on your behalf.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => { window.location.href = '/api/auth/google' }}
            className="block w-full text-center bg-[#3a2e1f] text-[#faf6ef] px-5 py-3 rounded-lg font-medium hover:bg-[#5a4a35] transition-colors cursor-pointer"
          >
            Connect Google
          </button>
        </div>

        <button
          onClick={onDismiss}
          className="w-full text-center text-sm text-[#8b7a60] hover:text-[#3a2e1f] transition-colors cursor-pointer"
        >
          Maybe Later
        </button>
      </div>
    </div>
  )
}
