# Integration Analysis — Phase 2: Deep Architecture Findings

Findings from 3 additional subagents analyzing AIRI, Open-LLM-VTuber, and eros-engine at source level.

## CRITICAL DISCOVERY: AIRI Already Has SillyTavern V3 Support

**`packages/ccc/`** is a full Character Card V3 codec that ALREADY EXISTS in AIRI:
- `ccc/src/codec/characterCardV3.ts` — full CCv3 spec parser/validator via valibot
- `ccc/src/export/png.ts` — embeds card data as PNG metadata key 'ccv3' (meta-png)
- `ccc/src/define/card.ts` — AIRI-native Card type extending CCv3
- `ccc/src/export/json.ts` and `md.ts` exporters

**The gap is small:**
1. No PNG import/extract path (only export exists)
2. No V2 card parser (only V3)
3. AiriCard requires `extensions.airi` populated for runtime use

**Integration path:** Add PNG metadata reader using meta-png's `extractMetadata`, add V2→V3 upgrader, write card importer mapping CCv3 → AiriCard with default extensions.airi.

## AIRI Architecture Details

### Agent System
- `AgentLLMPort` interface: `stream(model, provider: GenerationProvider, conversation, options)`
- `ChatOrchestratorRuntime` orchestrates: message → LLM streaming → tools → response → speech
- Protocol-neutral: 'chat-completions' | 'responses'
- Hook system: `ChatHookRegistry` with onBeforeSend/onAfterSend/onTokenLiteral etc.
- Memory tools: builtIn_readMemory, builtIn_writeMemory, builtIn_forgetMemory

### Provider System
- `packages/provider-inference/` — 40+ cloud providers, local providers (ollama, lm-studio)
- `defineProvider()` + zod schema pattern
- **Dalai integration:** Add `providers/local/dalai/index.ts` following ollama pattern, OR just use existing 'openai-compatible' with Dalai URL

### Avatar System (5 types)
- live2d, vrm, mmd, spine, tachie
- `stage-ui-three/` — Three.js VRM renderer (VRMModel.vue, lip-sync, expressions)
- `stage-ui-live2d/` — Live2D Cubism renderer
- `model-driver-lipsync/` — Audio-driven lip sync (wlipsync AudioWorklet)
- `model-driver-magic-live2d/` — MAGIC motion generation
- `model-driver-mediapipe/` — MediaPipe pose/hand/face tracking → VRM bones

**VGF GLB integration:** Add 'glb' to AvatarModelType, create GLBModel.vue using THREE.GLTFLoader, map mediapipe poses to GLB skeleton, map wlipsync vowels to GLB morph targets.

### Memory System
- Client-side: Pinia store + IndexedDB (unstorage), MemoryEntry {id, description, body, persona, updatedAt}
- Server-side: `memory-pgvector/` is a STUB (not implemented yet)
- **eros-engine integration:** Extend MemoryEntry with `layer` field, create RelationshipEntry type, implement memory-pgvector stub, add builtIn_readRelationship tool

### Server
- Hono web framework + Drizzle ORM + PostgreSQL + Redis + S3
- `server/apps/api/` — resource API with field-sync character cards
- `server/apps/auth/` — Better Auth + OIDC
- WebSocket chat v1+v2

## eros-Engine: Full 6-Axis Model Details

### The 6 Axes (grouped into 2 lines)

**BOND LINE** = (trust + intrigue) / 2
- **trust**: topic depth, self-disclosure
- **intrigue**: curiosity, anti-ghost driver

**CHEMISTRY LINE** = (intimacy + tension) / 2  
- **intimacy**: inside jokes, callbacks
- **tension**: push-pull, playful friction

**ENDPOINTS (derived, not accumulated):**
- **warmth** = clamp(max(base(w_level) × B(chemistry), φ × chemistry) × decay
- **patience** = derived from bond + chemistry

### 5 Tiers per Line
Bond: acquaintance → friend → close_friend → confidant → soulmate
Chemistry: spark → flirtation → crush → lover → beloved
Thresholds: [0, 0.15), [0.15, 0.35), [0.35, 0.62), [0.62, 0.90), [0.90, 1.0]

### Time Decay
- intrigue: -0.01/day, tension: -0.005/day (trust and intimacy NEVER decay)
- Endpoints: multiplicative absence decay, rate=0.02/day, floor=0.5
- 7 days = ×0.86, 25+ days = ×0.5

### Persona Decision Engine (PDE)
- Deterministic rules first, LLM fallback only when rules can't decide
- Ghost scoring: (1-intrigue)×0.4 + (1-patience)×0.4 + tension×0.2, threshold 0.65
- Hard vetoes: first 10 messages protected, streak ≥2 blocks ghost, 1h cooldown
- Action types: ReplyText, Ghost, ReplyImage, Proactive, ProductQa
- Energy model: reply costs 0.05, proactive 0.10, ghost 0.00

### API Surface
- `POST /comp/chat/start` — open/resume session
- `POST /comp/chat/{session_id}/message/stream` — SSE streaming chat
- `GET /bff/v1/comp/affinity/{session_id}` — 6-axis state + tiers + labels
- `GET /bff/v1/comp/affinity/{session_id}/event` — per-turn delta
- `GET /comp/user/{user_id}/profile` — human insights profile
- OpenAPI at `/docs`

### Integration as Sidecar
1. Docker compose: pgvector + eros-engine + AIRI
2. AIRI calls `POST /comp/chat/start` per user×persona
3. Before LLM response, AIRI reads affinity state and injects into prompt
4. User message → eros-engine stream → SSE reply + meta frames
5. After turn, read delta for UI updates (relationship meters, tier-up notifications)

## Open-LLM-VTuber: Voice Pipeline Details

### 18+ TTS Engines
azure, bark, edge, pyttsx3, cosyvoice, cosyvoice2, melo, x_tts, gpt_sovits, siliconflow, coqui, fish_api, minimax, sherpa_onnx, openai (kokoro), spark, elevenlabs, cartesia, piper

### 7 ASR Engines
faster_whisper, whisper_cpp, openai_whisper, fun_asr, azure_asr, groq_whisper_asr, sherpa_onnx_asr

### Streaming Pipeline
Audio capture → VAD (Silero) → STT → LLM streaming → 4 decorator stages:
1. sentence_divider (pysbd/regex, tag support)
2. actions_extractor (emotion from [emotion] tags)
3. display_processor (think-tag rendering)
4. tts_filter (remove special chars for TTS)

### Lip Sync (server-side)
Backend computes per-chunk RMS volumes at 20ms slices → sends audio_base64 + volumes[] + slice_length_ms → frontend drives Live2D mouth from volumes array.

### Complementary to AIRI
- MCP tool-calling framework (provider-agnostic)
- Server-side VAD (hands-free)
- Group conversation system (multi-AI, multi-user)
- Proxy handler (multiple clients share one session)
- Bilibili live streaming
- Cross-language TTS translation
- Think-tag system (AI inner thoughts without voice)
- Proactive AI speaking
- Desktop-pet mode (companion floats on screen)

## Refined 4-Phase Integration Plan

### Phase 1 — SillyTavern Card Import (LOW effort)
AIRI's `packages/ccc/` already has CCv3 parsing. Add:
1. PNG metadata extraction via meta-png `extractMetadata`
2. V2 → V3 upgrader  
3. Card importer: CCv3 → AiriCard with default `extensions.airi`
4. Import UI in `settings/airi-card/` page

### Phase 2 — Dalai Local LLM (LOW effort)
1. Create `providers/local/dalai/index.ts` following ollama pattern
2. Register in `providers/index.ts`
3. OR use existing 'openai-compatible' with Dalai URL

### Phase 3 — eros-engine Two-Layer Memory (MEDIUM effort)
1. Relationship layer: Add RelationshipState type + Pinia store + builtIn_readRelationship tool
2. Vector layer: Implement memory-pgvector stub
3. Deploy eros-engine as Docker sidecar
4. Inject relationship state into LLM prompt via hooks

### Phase 4 — VGF 3D GLB Avatar (MEDIUM effort)
1. Add 'glb' to AvatarModelType
2. Create GLBModel.vue using THREE.GLTFLoader
3. Map mediapipe poses → GLB skeleton
4. Map wlipsync vowels → GLB morph targets
5. Register in Model/index.ts
