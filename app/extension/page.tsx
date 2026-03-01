export default function ExtensionPage() {
  return (
    <main className="min-h-screen bg-[#faf6ef] text-[#3a2e1f] px-6 py-16 flex justify-center">
      <article className="max-w-2xl w-full space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-serif">Charter Chrome Extension</h1>
          <p className="text-[#8b7a60]">
            Your AI travel agent — visa requirements, flight search, form filling, and trip
            planning right from your browser.
          </p>
        </div>

        {/* Chrome Web Store */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">Install from Chrome Web Store</h2>
          <p>The easiest way to install Charter:</p>
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#3a2e1f] text-[#faf6ef] px-6 py-3 rounded-lg font-medium hover:bg-[#5a4a35] transition-colors"
          >
            Get Charter on Chrome Web Store &rarr;
          </a>
          <p className="text-sm text-[#8b7a60]">
            (Coming soon — link will be updated once published)
          </p>
        </section>

        {/* Direct download */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">Direct Download</h2>
          <p>
            Download the extension as a <code className="bg-[#ede6d8] px-1.5 py-0.5 rounded text-sm">.zip</code> file
            and load it manually:
          </p>
          <a
            href="/charter-extension.zip"
            download
            className="inline-block border-2 border-[#3a2e1f] text-[#3a2e1f] px-6 py-3 rounded-lg font-medium hover:bg-[#3a2e1f] hover:text-[#faf6ef] transition-colors"
          >
            Download charter-extension.zip
          </a>
        </section>

        {/* Sideloading instructions */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">Sideloading Instructions</h2>
          <ol className="list-decimal pl-5 space-y-3">
            <li>
              Download and unzip <strong>charter-extension.zip</strong> to a folder on your
              computer.
            </li>
            <li>
              Open Chrome and navigate to{' '}
              <code className="bg-[#ede6d8] px-1.5 py-0.5 rounded text-sm">chrome://extensions</code>.
            </li>
            <li>
              Enable <strong>Developer mode</strong> using the toggle in the top-right corner.
            </li>
            <li>
              Click <strong>Load unpacked</strong> and select the unzipped extension folder.
            </li>
            <li>
              The Charter icon will appear in your toolbar. Click it to open the popup and start
              planning your trip.
            </li>
          </ol>
        </section>

        <footer className="pt-8 border-t border-[#d4c9b5] text-sm text-[#8b7a60] flex gap-4">
          <a href="/" className="underline hover:text-[#3a2e1f]">&larr; Back to Charter</a>
          <a href="/privacy" className="underline hover:text-[#3a2e1f]">Privacy Policy</a>
        </footer>
      </article>
    </main>
  )
}
