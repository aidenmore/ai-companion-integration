# Integration Analysis — Deep Dive Findings from 8 Subagent Analyses

## Executive Summary

8 subagents analyzed 8 repos in parallel. Key finding: **all 8 repos are complementary, not overlapping**. Each fills a distinct layer of the companion stack. The integration is not only feasible — it's the natural assembly of the only open-source stack that covers every layer from personality to gameplay.

## Layer Map (which repo owns which layer)

```
┌─────────────────────────────────────────────────────────┐
│ LAYER                    │ REPO              │ STARS  │
├───────────────────────────┼───────────────────┼────────┤
│ Personality/Character    │ SillyTavern      │ 31.5k  │
│ Relationship/Emotion     │ eros-engine       │ 70     │
│ Avatar (3D GLB)          │ Virtual-Girlfriend │ 13     │
│ Avatar (VRM/Live2D)     │ AIRI              │ 51.6k  │
│ Voice (Live2D+STT+TTS)   │ Open-LLM-VTuber   │ 14.7k  │
│ Local LLM (private)      │ Dalai             │ 12.9k  │
│ Multi-user/Multi-bot      │ AgnAI             │ 768    │
│ UI/Plugin Architecture   │ Lobe Chat         │ —      │
│ Emotional Companionship   │ KouriChat (NEW)   │ 3.3k   │
│ Lorebook Memory Alt      │ RisuAI (NEW)      │ ~1k    │
└───────────────────────────┴───────────────────┴────────┘
```

## SillyTavern (31.5k★) — Character System

### Architecture
- Node.js/Express backend, vanilla JS + jQuery frontend (no framework)
- 40+ Express routers for all endpoints
- AGPL-3.0, version 1.19.1

### Character Card Format
- V1: flat JSON (name, description, personality, scenario, first_mes, mes_example)
- V2 (`chara_card_v2`): wraps V1 in `data.{}`, adds system_prompt, post_history_instructions, alternate_greetings[], tags, creator, character_version, extensions{}, character_book
- V3 (`chara_card_v3`): adds assets[], group_only_greetings[], expanded extensions
- PNG cards: base64 JSON in tEXt chunks (keyword `chara` for V2, `ccv3` for V3)
- Parser: `src/character-card-parser.js` — zero UI coupling, immediately reusable

### LLM Backends (25+ providers)
- Chat Completions API: OpenAI, Claude, OpenRouter, Google AI, Google Vertex, Mistral, Cohere, DeepSeek, xAI, Groq, Azure, MiniMax, Moonshot, Fireworks, Z.AI, SiliconFlow, Cloudflare, NanoGPT + more
- Text Completions API: TextGen WebUI, Mancer, Aphrodite, HuggingFace, InfermaticAI, TogetherAI, Ollama, vLLM, KoboldCpp, LlamaCpp
- KoboldAI native, NovelAI, Horde
- `src/prompt-converters.js` (1452 lines) — all provider message format converters, standalone

### Extension System
- 15 built-in client-side extensions: assets, attachments, caption, connection-manager, expressions, gallery, memory, quick-reply, regex, stable-diffusion, third-party, token-counter, translate, tts, vectors
- Server-side plugins via `src/plugin-loader.js`
- Extensions inject prompts via `setExtensionPrompt()` at positions: IN_PROMPT(0), IN_CHAT(depth), BEFORE_PROMPT(2)
- `generate_interceptor` runs before prompt building

### Memory System (3 layers)
1. Summary/Memory extension: LLM-generated summaries injected at tag `1_memory`
2. Vector storage: vectra LocalIndex, 9 embedding providers (transformers, openai, cohere, google, extras, nomicai, ollama, vllm, llamacpp)
3. World Info/Lorebook: keyword-triggered entries with regex, activation logic, position, insertion order, probability, recursion, group scoring, cooldown/delay/sticky timers

### Integration Recommendation
- Extract `character-card-parser.js` as standalone npm package (zero coupling)
- Extract `prompt-converters.js` as provider-agnostic format library
- Use backend Express routers as headless API (well-separated, can run independently)
- Do NOT extract frontend Generate() pipeline (12600-line jQuery monolith, deeply coupled to DOM)
- Keep SillyTavern running as optional admin/character-management UI alongside new frontend

## AIRI (51.6k★) — Base Platform

### Architecture
- Vue 3 + Vite + TypeScript + Pinia monorepo (pnpm workspaces)
- 30+ packages, multiple apps (stage-web, stage-tamagotchi, stage-pocket)
- Server: Postgres + Drizzle ORM, WebSocket, auth
- MIT licensed, installable via winget/Scoop/Homebrew

### Character System (DUAL)
1. `packages/core-character/` — shared contracts, AvatarModelType = 'live2d'|'vrm'|'mmd'|'spine'|'tachie'
2. Server DB: `character_cards` table (drizzle,orm, Postgres) with field sync, revision tracking

### Agent System
- `packages/core-agent/` — AgentLLMPort interface, ChatOrchestratorRuntime, ContextRegistry
- `GenerationProvider` interface from `@proj-airi/provider-inference`
- Protocol-neutral: 'chat-completions' | 'responses'
- Recipe system for decisions, response categorizer

### Avatar System
- VRMModel.vue with @react-three/drei
- Lip-sync, expressions, animation, interaction modules
- Live2D model driver (`packages/model-driver-magic-live2d/`)
- MediaPipe for face tracking (`packages/model-driver-mediapipe/`)

### Provider System
- `packages/provider-inference/` — cloud + local providers
- Uses @xsai framework
- Providers registry with runtime matrix

### Game Integrations
- Minecraft (✓), Factorio (✓ WIP), KSP (✓), Helldivers 2 (WIP), Chess (✓)
- Discord, Telegram, Twitter integrations
- VSCode extension

### Integration Seams
- Add SillyTavern V2/V3 card import → AIRI's `character_cards` table
- Add Dalai as local provider in `packages/provider-inference/src/providers/local/`
- Add eros-engine relationship state to agent context via `AgentContextPort`
- Add VGF's Three.js GLB avatar as alternative model driver

## eros-engine (70★) — Relationship Model

### Architecture
- Rust, Axum HTTP server, Postgres 16+ with pgvector
- AGPL-3.0, 87 releases, actively maintained
- Deployable as Docker sidecar OR embeddable as library crates (core + llm + store)

### 6-Dimension Affinity Model
- Axes: trust, affection, intimacy, commitment, passion, satisfaction
- Each bounded [0,1], clamped on every update
- Moves only on text-channel, non-product_qa chat turns
- Time-decay: different rates per axis (trust most stable, passion decays fastest)

### Two-Layer Memory
1. **Profile layer**: what the persona learned about the user (shared across personas)
2. **Relationship layer**: what happened between them (per persona instance, per session)

### Persona Decision Engine
- Chooses action and inner state BEFORE generation
- Actions: express_affection, seek_reassurance, be_intimate, build_trust, comfort_user, respond_warmly

### API Surface
- `POST /comp/chat/{session_id}/message/stream` — SSE streaming chat
- `POST /comp/sessions` — create session
- `GET /comp/sessions/{id}/state` — relationship state
- Bearer JWT auth (Supabase)
- OpenAPI spec at `/docs`

### Integration
- Run as Docker sidecar alongside AIRI/companion server
- Our `RelationshipEngine` in `eros-bridge.ts` mirrors this model in-process for when the Rust binary isn't running

## Dalai (12.9k★) — Local LLM

### API
- Socket.io (not REST, not OpenAI-compatible)
- `serve(port)` → Socket.io server, clients emit 'request' with {model, prompt, n_predict, ...}
- Server emits 'result' {response, request} token-by-token
- No OpenAI-compatible endpoint (GGML-era llama.cpp)

### Integration
- Our `DalaiProvider` wraps Socket.io client in `dalai-provider.ts`
- For single-process: `new Dalai().http(httpServer)` mounts on existing Express
- Alternative: swap for Ollama (OpenAI-compatible, one-line baseURL change)

## Virtual-Girlfriend (13★) — 3D Avatar

### Stack
- Frontend: React 18 + Vite + Three.js + @react-three/fiber + @react-three/drei
- Backend: Express + OpenAI SDK + ElevenLabs + ffmpeg + Rhubarb lip-sync

### Avatar
- Ready Player Me GLB model with full morphTargetDictionary (ARKit blendshapes)
- 9 facial expressions: smile, sad, angry, surprised, funnyFace, crazy, default + blink/wink
- 9 animations: Talking_0/1/2, Crying, Laughing, Rumba, Idle, Terrified, Angry
- Lip-sync: ffmpeg (mp3→wav) → Rhubarb → mouthCue visemes → morph targets

### Response Protocol (integration seam)
```json
{
  "messages": [{
    "text": "Hey babe~ 💕",
    "audio": "base64...",
    "lipsync": [{...mouthCues}],
    "facialExpression": "smile",
    "animation": "Talking_1"
  }]
}
```

### Integration
- Keep frontend avatar stack unchanged
- Replace backend LLM call with unified provider (Dalai/OpenAI/Mock)
- TTS+lipsync pipeline is voice-agnostic (swap ElevenLabs for Piper/Coqui, keep Rhubarb)

## Open-LLM-VTuber (14.7k★) — Voice + Live2D

### Stack
- Python/FastAPI backend, React frontend (git submodule)
- WebSocket-based, Live2D with emotionMap
- VAD (Silero), multi-backend STT (Whisper, Azure), multi-backend TTS
- Desktop-pet mode (companion floats on screen)
- Explicitly designed for girlfriend/boyfriend/pet use cases

### Complementary to AIRI
- Provides Python voice pipeline (AIRI is TypeScript)
- Desktop-pet persistent companion surface
- Pluggable LLM backend (can front Dalai)

## AgnAI (768★) — Multi-User

### Architecture
- Node.js + TypeScript + Express + SolidJS frontend
- MongoDB + Redis (optional), raw `ws` WebSocket (not Socket.io)
- JWT auth + bcrypt, multi-tenant by design
- AGPL-3.0

### Character Format
- SillyTavern-compatible: exports `chara_card_v2` with V1 backfill + V2 data block
- 5 persona formats: wpp, sbf, boostyle, attributes, text
- AgnAI-specific extras in `extensions.agnai` (voice, persona, appearance, json schema, sprite)

### Multi-Bot Chat
- Chat.characters: Record<characterId, boolean> for multiple AI in one chat
- All bots' personalities injected into prompt for contextual awareness
- ChatMember + ChatInvite for human users joining

### Reusable
- `common/` directory is framework-agnostic TypeScript (prompt building, character formatting, memory matching)
- `srv/adapter/` — 17 LLM adapters, self-contained
- WebSocket layer — clean realtime broadcast abstraction

## Lobe Chat — UI Reference

### Architecture
- Next.js 16 + React 19 + TypeScript, pnpm monorepo
- Zustand (50+ stores), Drizzle ORM + PostgreSQL, better-auth
- 91 LLM providers, MCP support, plugin marketplace
- Agent/Persona system with AgentProfile (gender, MBTI, traits, artwork)

### SillyTavern Compatibility
- No native support, but mapping is clean:
  - description → systemRole, first_mes → openingMessage, personality → profile.personaTraits
  - character_book → knowledgeBases (RAG system with embeddings)
- AgentProfile is MORE expressive than V2 (artwork generation, MBTI, TTS config per character)
- Missing: world info, scenarios, regex scripting, author's notes

### Integration
- Use as UI shell + agent management layer
- Add SillyTavern card import plugin (MCP server or builtin-tool)
- Leverage 91-provider model runtime (no abstraction work needed)

## Additional Finds (from subagent search)

### KouriChat (3.3k★) — Emotional Companionship
- Python, OneBot protocol, visual WebUI
- Immersive roleplay with group-chat, emotion-driven emoji, persistent memory
- Chinese-primary but extensible

### RisuAI (~1k★) — SillyTavern Alternative
- Svelte + TypeScript + Tauri, GPL-3.0
- Lorebook memory system, regex functions, in-chat assets
- Cross-platform (web, desktop, self-host)
- Different memory architecture worth A/B comparing

## Final Integration Architecture

```
USER
  │
  ▼
┌──────────────────────────────────────────────────────┐
│ FRONTEND (choose one or run multiple)                │
│  AIRI stage-web (Vue, VRM/Live2D) ── primary        │
│  VGF frontend (React, Three.js GLB) ── alternative    │
│  Lobe Chat (Next.js, plugin marketplace) ── admin UI  │
│  Open-LLM-VTuber (desktop pet mode) ── floating      │
└──────────────────┬───────────────────────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │  UNIFIED COMPANION SERVER       │
  │  (integration/src/server)      │
  │  Express + Socket.io            │
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
  │  25+ providers (via SillyTavern) │
  │  91 providers (via Lobe Chat)    │
  │  17 adapters (via AgnAI)         │
  ├────────────────────────────────┤
  │ AVATAR LAYER                    │
  │  VGF: 3D GLB + facial expr       │
  │  AIRI: VRM/Live2D + lip-sync     │
  │  Open-LLM-VTuber: Live2D + voice │
  │  Response: {text, expression,     │
  │   animation, audio, lipsync}     │
  └────────────────────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │ GAME INTEGRATIONS (AIRI)        │
  │  Minecraft │ Factorio │ KSP      │
  │  Chess │ Helldivers 2 (WIP)      │
  │  Discord │ Telegram │ Twitter     │
  └────────────────────────────────┘
```
