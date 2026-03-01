# Charter — AI Travel Agent

AI-powered travel assistant with visa requirements, flight search, form filling, and trip planning. Features a 3D globe interface, voice interaction, and browser automation.

**Live:** [charter-london.fly.dev](https://charter-london.fly.dev)

## Chrome Extension

The extension lets Charter navigate pages, fill forms, and complete tasks on your behalf.

### Install from Chrome Web Store

Coming soon — pending review.

### Install manually (sideload)

1. Clone this repo or download the `extension/` folder
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the `extension/` folder
5. Done — visit [charter-london.fly.dev](https://charter-london.fly.dev) to start

No account needed. No payment required. All data is automatically deleted when you close the tab.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Privacy

All data (passport info, Google tokens) is tied to an anonymous device cookie and automatically deleted when you close the browser tab. No accounts, no persistent storage. See [Privacy Policy](https://charter-london.fly.dev/privacy).
