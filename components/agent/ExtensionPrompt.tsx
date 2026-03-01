'use client'

interface ExtensionPromptProps {
  onDismiss: () => void
}

export function ExtensionPrompt({ onDismiss }: ExtensionPromptProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#faf6ef] text-[#3a2e1f] rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold font-serif">Chrome Extension Required</h2>
          <p className="text-sm text-[#8b7a60]">
            Charter needs the browser extension to navigate pages, fill forms, and complete tasks
            on your behalf. Install it to continue.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-[#3a2e1f] text-[#faf6ef] px-5 py-3 rounded-lg font-medium hover:bg-[#5a4a35] transition-colors"
          >
            Get from Chrome Web Store
          </a>
          <a
            href="/extension"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center border-2 border-[#3a2e1f] text-[#3a2e1f] px-5 py-3 rounded-lg font-medium hover:bg-[#3a2e1f] hover:text-[#faf6ef] transition-colors"
          >
            Download &amp; Sideload Manually
          </a>
        </div>

        <button
          onClick={onDismiss}
          className="w-full text-center text-sm text-[#8b7a60] hover:text-[#3a2e1f] transition-colors cursor-pointer"
        >
          Dismiss — I&apos;ll install it later
        </button>
      </div>
    </div>
  )
}
