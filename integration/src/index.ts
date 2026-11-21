/**
 * Unified AI Companion Platform — Integration Layer
 * 
 * This package integrates 8 GitHub repos into a single AI girlfriend platform:
 * 
 * 1. SillyTavern (31.5k★) → Character card parsing, personality, world info, prompt building
 * 2. AIRI (51.6k★) → Base platform: VRM/Live2D avatars, voice, memory, game integrations
 * 3. eros-engine (70★) → 6-dimension relationship model with time-decay, two-layer memory
 * 4. Dalai (12.9k★) → Local LLM backend via Socket.io (llama.cpp)
 * 5. Virtual-Girlfriend (13★) → 3D avatar with facial expressions + lip-sync protocol
 * 6. Open-LLM-VTuber (14.7k★) → Live2D + voice interaction pipeline
 * 7. AgnAI (768★) → Multi-user, multi-character chat architecture
 * 8. Lobe Chat → Modern UI plugin architecture reference
 * 
 * Integration Architecture:
 * 
 *   ┌──────────────────────────────────────────┐
 *   │         VGF 3D Avatar / AIRI Live2D       │
 *   │    (facial expressions, lip-sync, voice)   │
 *   └──────────────┬───────────────────────────┘
 *                  │
 *   ┌──────────────▼───────────────────────────┐
 *   │         Unified Companion Server           │
 *   │  (Express + Socket.io, REST API)           │
 *   ├──────────────────────────────────────────┤
 *   │  SillyTavern Character Cards (V2/V3 PNG)   │
 *   │  eros-engine Relationship Model (6-dim)    │
 *   │  Two-layer Memory (facts + moments)        │
 *   ├──────────────────────────────────────────┤
 *   │         LLM Provider Layer                 │
 *   │  ┌────────┐ ┌────────┐ ┌───────────────┐  │
 *   │  │ OpenAI │ │ Claude │ │ Dalai Local   │  │
 *   │  │(cloud) │ │(cloud) │ │ (llama.cpp)   │  │
 *   │  └────────┘ └────────┘ └───────────────┘  │
 *   └──────────────────────────────────────────┘
 *                  │
 *   ┌──────────────▼───────────────────────────┐
 *   │      AIRI Game Integrations                │
 *   │  Minecraft | Factorio | KSP | Chess        │
 *   └──────────────────────────────────────────┘
 */

export { readCharacterCard, toUnifiedCharacter, buildCharacterPrompt, importCharacterDirectory } from './character/card-parser'
export type { UnifiedCharacter, CharacterCard, CharacterCardV2, CharacterCardV3, CharacterBook, AvatarExpressionMap, RelationshipDimensions } from './character/card-parser'

export { DalaiProvider, DalaiLLMProvider, OpenAIProvider, MockProvider, createProvider } from './providers/dalai-provider'
export type { UnifiedLLMProvider, DalaiChatRequest, DalaiChatResponse } from './providers/dalai-provider'

export { RelationshipEngine } from './relationship/eros-bridge'
export type { RelationshipState, RelationshipUpdate, MemoryEntry } from './relationship/eros-bridge'

export { CompanionServer } from './server/index'
