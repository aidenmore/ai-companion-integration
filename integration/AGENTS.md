# AI Companion Integration — Agent Handoff

## Project Identity
- **Name:** Unified AI Companion Platform
- **Location:** `C:\OneDrive\Workspace\ai-companion-integration\integration`
- **Purpose:** Merge 8 open-source AI companion/girlfriend repos into one working platform
- **Status:** Integration layer built, demo script ready, server code complete

## Architecture Summary
The integration sits between 8 cloned repos and provides a unified API:
- **Character system:** SillyTavern V2/V3 PNG card parser → UnifiedCharacter format
- **Relationship engine:** eros-engine 6-dimension affinity model with time-decay (local in-process)
- **LLM providers:** Auto-selecting (Dalai local → OpenAI cloud → Mock fallback)
- **Avatar protocol:** VGF-style JSON responses with facialExpression + animation fields
- **Game integrations:** AIRI's Minecraft/Factorio/KSP/Chess endpoints

## Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Package entry point, exports all modules |
| `src/character/card-parser.ts` | SillyTavern V2/V3 PNG/JSON parser → UnifiedCharacter |
| `src/providers/dalai-provider.ts` | Dalai Socket.io + OpenAI + Mock provider adapters |
| `src/relationship/eros-bridge.ts` | 6-dimension relationship engine with memory |
| `src/server/index.ts` | Express + Socket.io unified companion server |
| `examples/demo.ts` | End-to-end demo (character → chat → relationship evolution) |

## Build & Run
```bash
cd integration
npm install
npm run demo     # Run the demo script
npm run dev      # Start the server on port 3000
```

## Environment Variables
See `.env.example`. All optional — mock provider works without any keys.

## Cloned Repos (parent directory)
1. `SillyTavern/` — 31.5k★, character cards, LLM connectors, TTS, memory, world info
2. `airi/` — 51.6k★, VRM/Live2D avatars, voice, games (Minecraft/Factorio/KSP), Discord/Telegram
3. `Open-LLM-VTuber/` — 14.7k★, Live2D + voice interaction
4. `dalai/` — 12.9k★, local llama.cpp via Socket.io
5. `virtual-girlfriend/` — 3D GLB avatar, facial expressions, lip-sync, ElevenLabs TTS
6. `eros-engine/` — Rust, 6-dim relationship model, two-layer memory, persona decision engine
7. `agnai/` — 768★, multi-user multi-character chat
8. `lobe-chat/` — Next.js, plugin marketplace, UI architecture reference

## Next Steps
1. **Run the demo:** `npx tsx examples/demo.ts` — shows character creation, chat, relationship evolution
2. **Start the server:** `npm run dev` — REST API at localhost:3000
3. **Import real character cards:** `POST /api/characters/import` with SillyTavern PNG files
4. **Connect the VGF frontend:** Point virtual-girlfriend's `useChat.jsx` backendUrl to this server
5. **Connect AIRI's frontend:** Wire AIRI's stage-web to use the unified character/provider system
6. **Start Dalai for local LLM:** `npx dalai serve 3001` then set DALAI_URL in .env
7. **Run eros-engine sidecar:** Start the Rust binary and set EROS_API_URL for advanced relationship tracking
8. **Enable game integrations:** Use AIRI's `integrations/minecraft/` module alongside this server

## Integration Seams (where to extend)
- **New LLM provider:** Implement `UnifiedLLMProvider` interface in `src/providers/`
- **New avatar driver:** Add expression mappings to `AvatarExpressionMap` in card-parser
- **New memory backend:** Extend `RelationshipEngine` with Postgres/pgvector for persistence
- **Multi-user:** Add auth layer (reference AgnAI's multi-user architecture)
- **Plugin system:** Reference Lobe Chat's plugin marketplace or AIRI's extension-protocol

## Decisions Made
- Used in-process relationship engine instead of requiring eros-engine Rust binary (graceful fallback)
- Used mock provider as fallback so the platform works without any API keys
- Character cards parsed to a unified format (not locked to SillyTavern's exact JSON)
- Avatar response format matches VGF's schema ({text, facialExpression, animation, audio})
- Game integrations are metadata endpoints (actual game logic lives in AIRI's integration modules)
