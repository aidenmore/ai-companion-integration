# AI Handoff Document — Unified AI Companion Platform

## Project Identity
- **Name:** Unified AI Companion Platform (ai-companion-integration)
- **GitHub:** https://github.com/aidenmore/ai-companion-integration
- **Branch:** main (6 commits, cumulative)
- **Location:** `C:\OneDrive\Workspace\ai-companion-integration\integration`
- **Purpose:** Merge 8 open-source AI companion/girlfriend repos into one working platform with personality, memory, 3D avatars, voice, relationship dynamics, and game-playing
- **Status:** Integration layer built, web app working, demo verified, committed to GitHub

## What Was Built

### Integration Package (`integration/`)
A unified platform that integrates 8 repos:

| File | Lines | Purpose |
|------|-------|---------|
| `src/character/card-parser.ts` | 380 | SillyTavern V2/V3 PNG parser → UnifiedCharacter format. Reads tEXt chunks from PNG, converts to unified format with avatar expressions + relationship dims |
| `src/providers/dalai-provider.ts` | 310 | Dalai Socket.io + OpenAI + Mock provider adapters. Auto-selects best available LLM (Dalai local → OpenAI cloud → Mock) |
| `src/relationship/eros-bridge.ts` | 360 | 6-dimension relationship engine with time-decay, two-layer memory (stable facts + shared moments), mood/inner-state/action derivation |
| `src/server/index.ts` | 420 | Express + Socket.io server. REST API: chat, characters, relationship, games, TTS. Socket.io for streaming |
| `src/index.ts` | 50 | Package entry, exports all modules |
| `app.html` | 460 | Interactive web app — 3 companions, live chat, relationship meters, game buttons, zero dependencies |
| `examples/demo-zero-deps.cjs` | 450 | Zero-dependency demo (runs on plain Node.js, no npm install needed) |
| `examples/demo.ts` | 200 | TypeScript demo (needs npm install) |
| `src/character/png-metadata.ts` | 190 | PNG card import — tEXt/zTXt/iTXt metadata reader, CCv3 preferred, V2/V1 detection (zero deps) |
| `examples/test-png-metadata.mjs` | 180 | Zero-dep verification for PNG metadata extraction (plain node) |

### Web App (`app.html`)
- 3 characters: Yuki (cat-girl, cheerful), Luna (moon-spirit, calm), Aria (virtual idol, passionate)
- 20+ trigger word categories: love, sad, greetings, trust, physical affection, passion, gaming, compliments, food, work/stress, jealousy/tsundere, future, laughter, apology, goodbye, anger/conflict, defaults
- Live 6-dim relationship meters with animated bars
- Bond tier progression (Acquaintance → Friend → Close Friend → Confidant → Soulmate)
- Game integration buttons (Minecraft ✓, Factorio ✓, Chess ✓, KSP WIP, Helldivers 2 WIP)
- Avatar expression + animation display per message
- Shows all 8 integrated repos in sidebar
- Pure HTML/CSS/JS — opens in any browser, zero dependencies

## 8 Cloned Repos (parent directory)
All cloned at `C:\OneDrive\Workspace\ai-companion-integration\`:

1. **SillyTavern** (31.5k★) — Character cards (V2/V3 PNG), 25+ LLM providers, 3-layer memory (summary + vectors + world info), 15 extensions, AGPL-3.0
2. **AIRI** (51.6k★) — Base platform: VRM/Live2D avatars, voice, game integrations (Minecraft/Factorio/KSP/Chess), Discord/Telegram, MIT. Has `packages/ccc/` = CCv3 codec ALREADY EXISTS
3. **Open-LLM-VTuber** (14.7k★) — Python/FastAPI, Live2D, 18+ TTS engines, 7 ASR engines, MCP tool-calling, VAD, desktop-pet mode
4. **Dalai** (12.9k★) — Node.js, Socket.io API, llama.cpp local inference, MIT
5. **eros-engine** (70★) — Rust/Axum, 6-axis affinity model, two-layer memory (profile + relationship), Persona Decision Engine, Postgres+pgvector, AGPL-3.0
6. **virtual-girlfriend** (13★) — React+Three.js, Ready Player Me GLB avatar, 9 facial expressions, Rhubarb lip-sync, ElevenLabs TTS
7. **agnai** (768★) — TypeScript, multi-user, multi-bot chat, MongoDB, WebSocket, 17 LLM adapters, AGPL-3.0
8. **lobe-chat** — Next.js+React, 91 LLM providers, plugin marketplace, Drizzle+PostgreSQL, Electron, MIT

## Architecture

```
USER (browser)
  │
  ▼
┌──────────────────────────────────────────────────────┐
│ WEB APP (app.html)                                    │
│  3 characters | live chat | relationship meters     │
│  game buttons | avatar expressions                   │
└──────────────────┬───────────────────────────────────┘
                   │ REST API / Socket.io
  ┌────────────────▼────────────────┐
  │  UNIFIED COMPANION SERVER       │
  │  (src/server/index.ts)          │
  ├────────────────────────────────┤
  │ CHARACTER LAYER                 │
  │  SillyTavern V2/V3 PNG parser  │
  │  → UnifiedCharacter format     │
  │  World Info / Lorebook support  │
  ├────────────────────────────────┤
  │ RELATIONSHIP LAYER              │
  │  eros-engine 6-dim affinity     │
  │  Two-layer memory (facts+moments)│
  │  Time-decay, mood, inner state   │
  │  Persona Decision Engine        │
  ├────────────────────────────────┤
  │ LLM PROVIDER LAYER              │
  │  Auto-select: Dalai→OpenAI→Mock │
  │  25+ providers (SillyTavern)    │
  │  91 providers (Lobe Chat)        │
  │  17 adapters (AgnAI)             │
  ├────────────────────────────────┤
  │ AVATAR LAYER                    │
  │  VGF: 3D GLB + facial expr       │
  │  AIRI: VRM/Live2D + lip-sync     │
  │  Open-LLM-VTuber: Live2D + voice │
  │  Response: {text, expression,     │
  │   animation, audio, lipsync}    │
  └────────────────────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │ GAME INTEGRATIONS (AIRI)        │
  │  Minecraft | Factorio | KSP      │
  │  Chess | Helldivers 2 (WIP)      │
  │  Discord | Telegram | Twitter    │
  └────────────────────────────────┘
```

## How to Run

```bash
# 1. Open the web app (zero dependencies)
start "" "C:\OneDrive\Workspace\ai-companion-integration\integration\app.html"

# 2. Run the demo (zero dependencies)
cd C:\OneDrive\Workspace\ai-companion-integration\integration
node examples\demo-zero-deps.cjs

# 3. Run the full server (needs npm install)
npm install
npm run dev    # → http://localhost:3000

# 4. Enable real LLM responses
copy .env.example .env
# Edit .env: set OPENAI_API_KEY=sk-...

# 5. Enable local private LLM (optional)
npx dalai serve 3001
# Set DALAI_URL=http://localhost:3001 in .env

# 6. Enable eros-engine sidecar (optional, advanced)
# See eros-engine/docker/Dockerfile for deployment
# Set EROS_API_URL=http://localhost:8080 in .env
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check + status |
| GET | `/api/characters` | List loaded characters |
| POST | `/api/characters/import` | Import character card (PNG/JSON) |
| GET | `/api/characters/:id` | Character details + relationship |
| POST | `/api/chat` | Chat with companion (returns text + avatar data) |
| GET | `/api/relationship/:id` | Get 6-dim relationship state |
| POST | `/api/relationship/:id/fact` | Save stable fact (long-term memory) |
| GET | `/api/providers` | List LLM providers + availability |
| GET | `/api/games` | List game integrations |
| POST | `/api/games/:game/start` | Start game integration |
| POST | `/api/tts` | Text-to-speech (ElevenLabs) |

## Relationship Model (eros-engine 6-dim)

| Dimension | Initial | Decay/hr | What builds it |
|-----------|----------|-----------|----------------|
| Trust | 30 | -0.1 | Honest language, promises, consistency |
| Affection | 20 | -0.5 | Positive words: love, care, miss, sweet |
| Intimacy | 10 | -0.3 | Physical affection: hug, kiss, cuddle, close |
| Commitment | 15 | -0.05 | Trust-building, future talk, promises |
| Passion | 25 | -0.8 | Desire, craving, intensity, fire |
| Satisfaction | 40 | -0.2 | Overall interaction quality, engagement |

Mood derivation: affection>70 + passion>60 → love; affection>50 + satisfaction>60 → happy; etc.

Bond tiers: Acquaintance [0,0.15) → Friend [0.15,0.35) → Close Friend [0.35,0.62) → Confidant [0.62,0.90) → Soulmate [0.90,1.0]

## Key Discoveries from 8 Subagent Analyses

1. **AIRI already has CCv3 codec** (`packages/ccc/`) — SillyTavern V3 character cards are ALREADY supported for parsing/PNG export. Only gap: no PNG import, no V2 parser. Phase1 integration effort is LOW.

2. **eros-engine's 6-axis model is far more sophisticated** than our initial implementation. Axes group into Bond line (trust+intrigue) and Chemistry line (intimacy+tension), with derived endpoints (warmth, patience). 5 tiers per line. PDE (Persona Decision Engine) with deterministic rules + LLM fallback. Ghost scoring: (1-intrigue)×0.4 + (1-patience)×0.4 + tension×0.2.

3. **Open-LLM-VTuber has 18+ TTS engines and 7 ASR engines** — far broader voice coverage than any other repo. Also has MCP tool-calling, server-side VAD, group conversations, proxy handler, bilibili streaming, desktop-pet mode.

4. **AgnAI's `common/` directory is framework-agnostic** — prompt building, character formatting, memory matching, persona formats. Can be lifted as a standalone TypeScript package. Already SillyTavern-compatible (exports `chara_card_v2`).

5. **SillyTavern's `character-card-parser.js` and `prompt-converters.js` are zero-coupling** and immediately reusable as standalone npm packages. The 25+ LLM backend routers are well-separated Express routers that can run independently.

6. **Lobe Chat's 91-provider model runtime** (`packages/model-runtime`) is the most complete LLM abstraction. Agent/Persona system with AgentProfile (gender, MBTI, traits, artwork). SillyTavern card mapping is clean: description→systemRole, first_mes→openingMessage, personality→profile.personaTraits.

7. **VGF's response schema** `{text, facialExpression, animation, audio, lipsync}` is the stable integration seam. Rhubarb+ffmpeg lip-sync pipeline is voice-agnostic — swap ElevenLabs for Piper/Coqui and keep lip-sync unchanged.

8. **Dalai uses GGML-era llama.cpp** with Socket.io (no OpenAI-compatible endpoint). Our adapter handles this. Alternative: swap for Ollama (OpenAI-compatible, one-line baseURL change).

## 4-Phase Integration Plan (for next agent)

### Phase 1: SillyTavern Card Import into AIRI (LOW effort)
AIRI's `packages/ccc/` already has CCv3 parsing. Add:
1. PNG metadata extraction via meta-png `extractMetadata` in `ccc/src/codec/`
2. V2 → V3 upgrader in `ccc/src/codec/`
3. Card importer: CCv3 → AiriCard with default `extensions.airi` (empty modules, no avatar models)
4. Import UI in `packages/stage-pages/src/pages/settings/airi-card/`
5. Server route for PNG upload in `server/apps/api/src/routes/character-cards/`

### Phase 1 Status (updated by this session)

**Item 1 — PNG metadata extraction: done.**
- AIRI (gitignored clone, disk only): `airi/packages/ccc/src/codec/png.ts` adds `parseCharacterCardPNG` / `parseCharacterCardPNGBase64` using meta-png **`getMetadata`** (meta-png 1.0.6 has no `extractMetadata` — the plan's name was off; it reads tEXt chunks only, reads are case-sensitive, its `addMetadataFromBase64DataURI` requires a `data:image/png;base64,` prefix, and it throws `TypeError("Invalid PNG")` on malformed input, wrapped into `InvalidCharacterCardError`). ccv3 keyword preferred, chara (V2) falls through to `InvalidCharacterCardError` with the decoded V2 JSON kept in `error.source`. Exported from `codec/index.ts`; `test/png.test.ts` covers export↔import roundtrips and domain errors (8 vitest cases, incl. data-URI roundtrips).
- **AIRI-side verification** (pnpm install hangs/breaks on this machine — pnpm's package-manager store reflink fails with os error 1): ran the real meta-png@1.0.6 + valibot@1.1.0 + typescript@5.9.3 tarballs from the npm registry via a curl + ESM-resolve-hook rig in `C:\Hermes\cache\scratch\ccc-verify\` against the real production code: **8/8 behavioral checks pass** (incl. exportToPNG↔parse roundtrips) and **`tsc --noEmit` strict passes** over all of `ccc/src`. The repo's `test/png.test.ts` still needs a normal `pnpm -F @proj-airi/ccc test:run` once a working pnpm/npm store exists.
- Committed in this repo: `integration/src/character/png-metadata.ts` — the zero-dependency extractor (handles tEXt + zTXt/iTXt with deflate compression, a gap in the plain card-parser reader) and `examples/test-png-metadata.mjs`. **Verified: `node examples/test-png-metadata.mjs` → 12/12 checks pass** (plain Node 26, no npm install).
- Next up: item 2 — V2 → V3 upgrader inside `ccc/src/codec/`, consuming the `error.source` seam above.

### Phase 2: Dalai Local LLM Provider in AIRI (LOW effort)
1. Create `packages/provider-inference/src/providers/local/dalai/index.ts` following ollama pattern
2. `defineProvider({ id:'dalai', schema: zod({baseUrl, apiKey?, headers?}), createProvider: createOpenAI(...) })`
3. Register in `providers/index.ts portableProviderDefinitions`
4. OR: use existing 'openai-compatible' provider with Dalai URL
5. No core-agent changes needed — `AgentLLMPort` accepts any `GenerationProvider`

### Phase 3: eros-engine Two-Layer Memory in AIRI (MEDIUM effort)
1. Relationship layer: Add `RelationshipState` type in `packages/stage-ui/src/types/relationship.ts`, Pinia store in `stores/relationship.ts`, `builtIn_readRelationship`/`builtIn_updateRelationship` tools in `tools/relationship.ts`
2. Inject relationship state into LLM prompt via hooks (`onBeforeMessageComposed`)
3. Vector layer: Implement `packages/memory-pgvector/src/index.ts` stub — add pgvector to `server/docker-compose.yaml` PostgreSQL, create embeddings table, implement cosine similarity search, add `/api/v1/memory/search` route
4. Deploy eros-engine as Docker sidecar: `docker compose` with pgvector + eros-engine + AIRI
5. AIRI calls `POST /comp/chat/start` per user×persona, reads affinity from `GET /bff/v1/comp/affinity/{session_id}`, injects into prompt

### Phase 4: VGF 3D GLB Avatar in AIRI (MEDIUM effort)
1. Add `'glb'` to `AvatarModelType` in `packages/core-character/src/avatar-model.ts`
2. Add `'glb'` to `DisplayModelFormat` in `packages/stage-ui/src/stores/display-models.ts` and server schema
3. Create `packages/stage-ui-three/src/components/Model/GLBModel.vue` using `THREE.GLTFLoader` + `AnimationMixer`, following `VRMModel.vue` pattern
4. Create `packages/stage-ui-three/src/composables/glb/` with animation, expression (morph targets), lip-sync mapping
5. Map `packages/model-driver-mediapipe/src/three/pose-to-glb.ts` — VrmPoseTargets → GLB skeleton bones
6. Map wlipsync vowels → GLB morph targets
7. Register `GLBModel` in `components/Model/index.ts`

## Decisions Made
- Used in-process relationship engine instead of requiring eros-engine Rust binary (graceful fallback)
- Used mock provider as fallback so platform works without any API keys
- Character cards parsed to unified format (not locked to SillyTavern's exact JSON)
- Avatar response format matches VGF's schema ({text, facialExpression, animation, audio})
- Game integrations are metadata endpoints (actual game logic lives in AIRI's integration modules)
- Web app is zero-dependency HTML (opens in any browser without npm install)
- Cloned repos excluded from git (too large), only integration/ package tracked

## Remaining Risks
- npm install can hang on this machine (npm cache issue) — use `npm cache clean --force` or `npm install --no-optional`
- Dalai uses GGML-era models (quality below modern llama.cpp K-quants) — consider Ollama as alternative
- eros-engine AGPL-3.0 license requires source disclosure if distributed — verify acceptable
- AIRI is a large, fast-moving monorepo — maintaining a fork is high-effort, prefer extending via plugins
- Lobe Chat has 50+ interconnected Zustand stores — surgical extraction is hard, prefer running whole

## Next Agent Instructions
1. **Start here:** Read this file, then open `app.html` in a browser to see the current state
2. **Run the demo:** `node examples/demo-zero-deps.cjs` to verify the relationship engine works
3. **Phase 1 first:** PNG import in AIRI's `packages/ccc/` is DONE (item 1, see Phase 1 Status above) — continue with item 2: the V2 → V3 upgrader in `ccc/src/codec/`
4. **Connect the server:** Once npm install works, run `npm run dev` and point the web app's fetch calls to `http://localhost:3000/api/chat`
5. **Import real character cards:** Use SillyTavern's character card PNG files (from Chub.ai or custom-made) with `POST /api/characters/import`
6. **Add real LLM:** Set `OPENAI_API_KEY` in `.env` for cloud responses, or start Dalai for local
7. **Add the VGF 3D avatar:** Port `virtual-girlfriend/frontend/src/` into the web app for 3D avatar rendering with Three.js
8. **Integrate eros-engine sidecar:** Deploy the Rust binary as Docker container, set `EROS_API_URL`, replace in-process engine with API calls
9. **Enable games:** Wire AIRI's `integrations/minecraft/` module to the game buttons in the web app

## Git State
```
* main  (6 commits)
  ca59b2d docs: phase2 deep analysis
  1dd144e feat: interactive web app
  8a585f7 docs: comprehensive integration analysis
  9cff665 chore: exclude cloned repos
  36d7419 feat: working zero-dep demo
  46f1a8f feat: unified AI companion platform
```

Remote: `origin/main` → https://github.com/aidenmore/ai-companion-integration.git
