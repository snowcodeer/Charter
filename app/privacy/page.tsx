export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#faf6ef] text-[#3a2e1f] px-6 py-16 flex justify-center">
      <article className="max-w-2xl w-full space-y-8">
        <h1 className="text-3xl font-bold font-serif">Privacy Policy</h1>
        <p className="text-sm text-[#8b7a60]">Last updated: March 1, 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">Overview</h2>
          <p>
            Charter is an AI travel agent that helps with visa requirements, flight search, and
            trip planning. This policy covers both the Charter website (<strong>charter.fly.dev</strong>)
            and the Charter Chrome extension.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">What data we collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Passport information</strong> — nationality, passport number, and expiry date
              that you voluntarily provide during your session.
            </li>
            <li>
              <strong>Google OAuth tokens</strong> — for Calendar, Gmail, and Drive access, granted
              through standard Google OAuth consent.
            </li>
            <li>
              <strong>Device cookie</strong> — an anonymous identifier to tie your session data
              together. No account or login is required.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">Where data is sent</h2>
          <p>
            All data is transmitted to and processed on our server at <strong>charter.fly.dev</strong>.
            The Chrome extension communicates exclusively with this server to provide its
            functionality.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">Data retention &amp; deletion</h2>
          <p>
            All stored data — including passport details and OAuth tokens — is automatically
            deleted when you close the browser tab. There is no persistent storage beyond your
            active session.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">Third-party sharing</h2>
          <p>
            Your data is <strong>not shared with any third parties</strong>. It exists only on our
            server for the duration of your session and is never sold, rented, or disclosed to
            external services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">Chrome extension permissions</h2>
          <p>
            The Charter extension requests browser permissions (active tab, storage, scripting) to
            provide in-page assistance such as form filling and page scanning. These permissions
            are used solely for the travel agent functionality and no browsing data is collected or
            stored beyond the active session.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold font-serif">Contact</h2>
          <p>
            If you have questions about this privacy policy, please open an issue on our GitHub
            repository or reach out through the Charter website.
          </p>
        </section>

        <footer className="pt-8 border-t border-[#d4c9b5] text-sm text-[#8b7a60]">
          <a href="/" className="underline hover:text-[#3a2e1f]">&larr; Back to Charter</a>
        </footer>
      </article>
    </main>
  )
}
