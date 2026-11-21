# 🌸 Unified AI Companion Platform

> Integrating 8 open-source GitHub repos into a single AI girlfriend/companion platform with personality, memory, 3D avatars, voice, relationship dynamics, and game-playing capabilities.

## What This Is

This project merges the best open-source AI companion repos into one unified, working platform:

| Repo | Stars | Role in Integration |
|------|-------|-------------------|
| [AIRI](https://github.com/moeru-ai/airi) | 51.6k | Base platform: VRM/Live2D avatars, voice, memory, game integrations (Minecraft, Factorio, KSP, Chess) |
| [SillyTavern](https://github.com/SillyTavern/SillyTavern) | 31.5k | Character card parsing (V2/V3 PNG), personality system, world info, prompt building |
| [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | 14.7k | Live2D + hands-free voice interaction pipeline |
| [Dalai](https://github.com/cocktailpeanut/dalai) | 12.9k | Local LLM backend (llama.cpp via Socket.io) for private, uncensored inference |
| [AgnAI](https://github.com/agnaistic/agnai) | 768 | Multi-user, multi-character chat architecture reference |
| [Lobe Chat](https://github.com/lobehub/lobe-chat) | — | Modern UI plugin architecture reference |
| [Virtual-Girlfriend](https://github.com/satyamshorrf/virtual-girlfriend) | 13 | 3D avatar with facial expressions, lip-sync protocol, ElevenLabs TTS |
| [eros-engine](https://github.com/etherfunlab/eros-engine) | 70 | 6-dimension relationship model with time-decay, two-layer memory, persona decision engine |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Avatar Layer (VGF 3D / AIRI Live2D)          │
│         facial expressions, lip-sync, voice, animations    │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│            Unified Companion Server (Express)              │
│              REST API + Socket.io streaming                │
├───────────────────────────────────────────────────────────┤
│  SillyTavern Character Cards (V2/V3 PNG → Unified)        │
│  eros-engine Relationship Model (6-dim affinity + decay)  │
│  Two-layer Memory (stable facts + shared moments)         │
├───────────────────────────────────────────────────────────┤
│                LLM Provider Layer                          │
│   ┌────────┐  ┌────────┐  ┌────────────────────────┐     │
│   │ OpenAI │  │ Claude │  │ Dalai Local (llama.cpp)│     │
│   │(cloud) │  │(cloud) │  │   Socket.io, private   │     │
│   └────────┘  └────────┘  └────────────────────────┘     │
│                Auto-selects best available                 │
└───────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│           AIRI Game Integrations                           │
│   Minecraft │ Factorio │ KSP │ Helldivers 2 │ Chess       │
│   (your companion plays games WITH you)                    │
└───────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install
cd integration
npm install

# Set up API keys (optional — mock provider works without them)
cp .env.example .env
# Edit .env with your OPENAI_API_KEY and/or ELEVEN_LABS_API_KEY

# Start the server
npm run dev
# → Server runs at http://localhost:3000
```

## API Reference

### Characters
```bash
# Import a SillyTavern character card (PNG with embedded metadata)
curl -X POST http://localhost:3000/api/characters/import \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/character.png"}'

# List all loaded characters
curl http://localhost:3000/api/characters

# Get character details + relationship state
curl http://localhost:3000/api/characters/:id
```

### Chat
```bash
# Chat with your companion
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "characterId": "my-girlfriend",
    "message": "Hey sweetie, how was your day?"
  }'

# Response includes text + avatar control data:
# {
#   "text": "Hey babe! I missed you so much today~ 💕",
#   "mood": "happy",
#   "facialExpression": "smile",
#   "animation": "Talking_1",
#   "relationship": {
#     "dimensions": { "trust": 33, "affection": 23, ... },
#     "mood": "happy",
#     "innerState": "warm"
#   },
#   "provider": "openai"
# }
```

### Relationship
```bash
# View relationship state
curl http://localhost:3000/api/relationship/:characterId

# Save a fact about the user (long-term memory)
curl -X POST http://localhost:3000/api/relationship/:characterId/fact \
  -H "Content-Type: application/json" \
  -d '{"fact": "User loves strawberry ice cream"}'
```

### Games
```bash
# List available game integrations
curl http://localhost:3000/api/games

# Start a game
curl -X POST http://localhost:3000/api/games/minecraft/start
```

### Voice (TTS)
```bash
# Text-to-speech via ElevenLabs
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "I love you!", "voice": "kgG7dCoKCfLehAPWkJOE"}' \
  --output response.mp3
```

## Relationship Model (eros-engine integration)

The platform tracks 6 relationship dimensions that evolve over time:

| Dimension | Initial | Decay/hr | Description |
|-----------|---------|----------|-------------|
| Trust | 30 | -0.1 | Most stable, builds slowly through honest interactions |
| Affection | 20 | -0.5 | Grows with positive language, decays moderately |
| Intimacy | 10 | -0.3 | Builds through intimate/caring language |
| Commitment | 15 | -0.05 | Nearly permanent once established |
| Passion | 25 | -0.8 | Decays fastest, needs constant rekindling |
| Satisfaction | 40 | -0.2 | General happiness with the relationship |

The companion's mood and response tone adapt based on these dimensions:
- **Affection > 70**: Deeply affectionate, expressive warmth
- **Affection 40-70**: Warming up, growing fondness
- **Affection < 40**: Friendly but not overly familiar
- **Trust < 20**: Cautious, guarded
- **Passion > 70**: Excited, intense

## Character Card Format

Supports SillyTavern V2 and V3 character cards:
- PNG files with embedded JSON metadata (tEXt chunks: `chara` for V2, `ccv3` for V3)
- Plain JSON files
- Character fields: name, description, personality, scenario, first_mes, alternate_greetings, system_prompt, world info (character_book)

The parser converts cards to a `UnifiedCharacter` format that includes:
- Avatar expression mappings (personality → facial expression + animation)
- Relationship dimension initialization
- Memory storage
- Source format tracking

## Cloned Repos

All 8 repos are cloned in the parent directory for reference and integration:

```
ai-companion-integration/
├── integration/          ← This package (the unified platform)
├── SillyTavern/          ← Character card system
├── airi/                 ← Base platform (avatars, voice, games)
├ eros-engine/          ← Relationship model
├── dalai/                ← Local LLM backend
├── Open-LLM-VTuber/      ← Live2D + voice
├── virtual-girlfriend/   ← 3D avatar + lip-sync
├── agnai/                ← Multi-user chat
└── lobe-chat/            ← UI architecture reference
```

## License

MIT — Each integrated repo retains its own license. See individual repos for details.
