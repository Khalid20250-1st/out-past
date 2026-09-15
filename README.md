# Out Past

Out Past is a calm, white, Claude-style macOS focus and mission app. It pulls
your Google Calendars together, shows how much of your day you actually used
versus wasted, helps you set a north star, a mission, and a daily kill list, and
gives you a built-in AI mentor called **KAI**.

Built with Electron + React + Vite.

## KAI runs entirely on your device

KAI is a fully local AI mentor. It needs no API key, no account, and no internet:

- **Apple Intelligence** through a small bundled Swift helper (`build/afm`) on
  Apple silicon Macs running macOS 26+. Answers are instant and nothing leaves
  the machine.
- **A ~1GB local model via [Ollama](https://ollama.com)** as an offline fallback
  when Apple Intelligence is not available.
- **A local knowledge base** the app builds and reasons over itself, so KAI still
  answers usefully even when neither engine above is ready.

Everything KAI does happens on your Mac.

## What is not included

The blocking / "Lock In" enforcement engine (system-level focus locks and site
blocking) is **intentionally not part of this open source build**. The "Lock In"
tab is present as a placeholder so the rest of the app builds and runs unchanged.

## Requirements

- macOS (Apple silicon recommended for the on-device Apple Intelligence engine).
- Node 18+.
- A Google Cloud OAuth **Desktop** client (free) if you want calendar sync — you
  paste your own Client ID / Secret into the app on first run; they are stored
  locally and never bundled.

## Build and run

```bash
npm install

# Dev: Vite dev server + Electron with hot reload
npm run dev

# Build the renderer, then package the Mac app with electron-builder
npm run build

# Or just the unpacked .app (no dmg)
npm run pack
```

### Compiling the Apple Intelligence helper

The bundled binary (`build/afm`) is not committed. On Apple silicon running
macOS 26+, compile it from source before packaging:

```bash
swiftc build/afm.swift -O -target arm64-apple-macos26 -o build/afm
```

If it is missing or you are on an unsupported Mac, KAI simply skips this engine
and falls back to Ollama or the local knowledge base.

### Optional Ollama fallback

```bash
ollama pull qwen2.5:1.5b
```

With Ollama installed and running, KAI uses this ~1GB local model when Apple
Intelligence is unavailable.

## Optional cloud features

The core app and KAI are fully local. A couple of features (cross-device sync and
an optional cloud AI/scheduling worker) can be switched on by bringing your own
endpoints. Copy `.env.example` to `.env` and fill them in:

```bash
cp .env.example .env
```

Left blank, those features quietly disable themselves and everything else keeps
working. See `.env.example` for details.

## License

MIT. See [LICENSE](LICENSE).
