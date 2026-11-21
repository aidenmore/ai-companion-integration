/**
 * Unified AI Companion Server
 * 
 * Integrates:
 * - SillyTavern character cards (personality, world info, memory)
 * - eros-engine relationship model (affinity, time-decay, mood)
 * - Dalai local LLM / OpenAI cloud (brain)
 * - Virtual-Girlfriend 3D avatar protocol (facial expressions, lip-sync, voice)
 * - AIRI-style architecture (extensible, provider-agnostic)
 * 
 * Endpoints:
 *   GET  /                    — Health check + status
 *   GET  /api/characters      — List loaded characters
 *   POST /api/characters/import — Import a character card (PNG/JSON)
 *   GET  /api/characters/:id  — Get character details + relationship state
 *   POST /api/chat             — Chat with companion (returns text + avatar data)
 *   GET  /api/relationship/:id — Get relationship state
 *   POST /api/relationship/:id/fact — Save a stable fact about the user
 *   GET  /api/providers        — List available LLM providers
 *   GET  /api/games            — List game integrations (Minecraft, Factorio, etc.)
 *   POST /api/games/:game/start — Start a game integration
 */

import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import * as path from 'node:path'
import * as fs from 'node:fs'

import {
  readCharacterCard,
  toUnifiedCharacter,
  buildCharacterPrompt,
  importCharacterDirectory,
  type UnifiedCharacter,
} from '../character/card-parser'

import {
  createProvider,
  type UnifiedLLMProvider,
} from '../providers/dalai-provider'

import { RelationshipEngine } from '../relationship/eros-bridge'

// --- Game Integration Types ---

interface GameIntegration {
  id: string
  name: string
  description: string
  available: boolean
  // AIRI integrations path
  airiPath?: string
}

const GAME_INTEGRATIONS: GameIntegration[] = [
  {
    id: 'minecraft',
    name: 'Minecraft',
    description: 'Play Minecraft with your AI companion. She can mine, build, chat, and explore alongside you.',
    available: true,
    airiPath: 'integrations/minecraft',
  },
  {
    id: 'factorio',
    name: 'Factorio',
    description: 'Co-play Factorio. Your companion helps with factory planning and automation (WIP, PoC available).',
    available: true,
    airiPath: 'integrations/factorio',
  },
  {
    id: 'ksp',
    name: 'Kerbal Space Program',
    description: 'Play KSP with your companion. She helps with rocket design and mission planning.',
    available: false,
    airiPath: 'integrations/ksp',
  },
  {
    id: 'helldivers2',
    name: 'Helldivers 2',
    description: 'Co-play Helldivers 2. Your companion fights alongside you (WIP).',
    available: false,
    airiPath: 'integrations/helldivers2',
  },
  {
    id: 'chess',
    name: 'Chess',
    description: 'Play chess against your AI companion.',
    available: true,
    airiPath: 'plugins/airi-plugin-game-chess',
  },
]

// --- Server Setup ---

export class CompanionServer {
  private app: express.Application
  private httpServer: ReturnType<typeof createServer>
  private io: SocketServer
  private characters: Map<string, UnifiedCharacter> = new Map()
  private provider: UnifiedLLMProvider | null = null
  private relationship: RelationshipEngine
  private port: number

  constructor(port: number = 3000) {
    this.port = port
    this.app = express()
    this.httpServer = createServer(this.app)
    this.io = new SocketServer(this.httpServer, {
      cors: { origin: '*' },
    })
    this.relationship = new RelationshipEngine(process.env.EROS_API_URL)
    this.setupMiddleware()
    this.setupRoutes()
    this.setupSocketHandlers()
  }

  private setupMiddleware(): void {
    this.app.use(cors())
    this.app.use(express.json({ limit: '50mb' })) // Large limit for PNG card uploads
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/', (_req, res) => {
      res.json({
        status: 'ok',
        service: 'Unified AI Companion Platform',
        version: '0.1.0',
        integrations: {
          sillytavern: 'Character card parsing (V2/V3)',
          airi: 'Avatar system (VRM/Live2D/3D)',
          eros_engine: 'Relationship model (6-dimension affinity)',
          dalai: 'Local LLM backend (llama.cpp)',
          virtual_girlfriend: '3D avatar with facial expressions',
          open_llm_vtuber: 'Live2D + voice interaction',
        },
        characters: this.characters.size,
        provider: this.provider?.name || 'not initialized',
        games: GAME_INTEGRATIONS.filter(g => g.available).length,
      })
    })

    // Characters
    this.app.get('/api/characters', (_req, res) => {
      const list = Array.from(this.characters.values()).map(c => ({
        id: c.id,
        name: c.name,
        personality: c.personality.slice(0, 100),
        tags: c.tags,
        creator: c.creator,
        source: c.source.originalFormat,
        relationship: this.relationship.getState(c.id).dimensions,
      }))
      res.json(list)
    })

    this.app.post('/api/characters/import', async (req, res) => {
      try {
        const { filePath, directory, base64Data, fileName } = req.body

        if (directory) {
          const chars = importCharacterDirectory(directory)
          for (const char of chars) {
            this.characters.set(char.id, char)
          }
          res.json({ imported: chars.length, characters: chars.map(c => ({ id: c.id, name: c.name })) })
          return
        }

        if (base64Data && fileName) {
          const buffer = Buffer.from(base64Data, 'base64')
          const tmpPath = path.join(require('os').tmpdir(), fileName)
          fs.writeFileSync(tmpPath, buffer)
          const card = readCharacterCard(tmpPath)
          const char = toUnifiedCharacter(card)
          this.characters.set(char.id, char)
          fs.unlinkSync(tmpPath)
          res.json({ imported: 1, character: { id: char.id, name: char.name } })
          return
        }

        if (filePath) {
          const card = readCharacterCard(filePath)
          const char = toUnifiedCharacter(card)
          this.characters.set(char.id, char)
          res.json({ imported: 1, character: { id: char.id, name: char.name } })
          return
        }

        res.status(400).json({ error: 'Provide filePath, directory, or base64Data+fileName' })
      } catch (err) {
        res.status(500).json({ error: (err as Error).message })
      }
    })

    this.app.get('/api/characters/:id', (req, res) => {
      const char = this.characters.get(req.params.id)
      if (!char) {
        res.status(404).json({ error: 'Character not found' })
        return
      }
      const relState = this.relationship.getState(char.id)
      res.json({
        ...char,
        relationship: relState,
      })
    })

    // Chat — the main endpoint
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { characterId, message, stream } = req.body

        if (!characterId || !message) {
          res.status(400).json({ error: 'characterId and message are required' })
          return
        }

        const char = this.characters.get(characterId)
        if (!char) {
          res.status(404).json({ error: 'Character not found' })
          return
        }

        if (!this.provider) {
          this.provider = await createProvider()
        }

        // Get relationship state and relevant memories
        const relState = this.relationship.getState(characterId)
        const memories = this.relationship.getRelevantMemories(characterId, message)

        // Build system prompt with character + relationship context
        const systemPrompt = buildCharacterPrompt(char, relState.currentMood)
        const relSummary = this.relationship.getRelationshipSummary(characterId)
        const memoryContext = memories.length > 0
          ? `\n## Memories\n${memories.map(m => `- ${m.content}`).join('\n')}`
          : ''

        const messages = [
          { role: 'system', content: systemPrompt + '\n\n' + relSummary + memoryContext },
          ...(char.firstMessage ? [{ role: 'assistant', content: char.firstMessage }] : []),
          { role: 'user', content: message },
        ]

        // Call LLM
        const response = await this.provider.chat({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.7,
          max_tokens: 500,
        })

        // Process interaction through relationship engine
        const updatedState = await this.relationship.processInteraction(
          characterId,
          message,
          response.text,
        )

        // Determine avatar expression
        const mood = response.mood || updatedState.currentMood
        const avatarExpr = char.avatarExpressions[mood as keyof typeof char.avatarExpressions] || char.avatarExpressions.default

        // Return unified response (compatible with VGF frontend)
        res.json({
          text: response.text,
          mood,
          facialExpression: response.facialExpression || avatarExpr.facialExpression,
          animation: response.animation || avatarExpr.animation,
          relationship: {
            dimensions: updatedState.dimensions,
            mood: updatedState.currentMood,
            innerState: updatedState.innerState,
          },
          provider: this.provider.name,
          timestamp: Date.now(),
        })
      } catch (err) {
        console.error('[Chat] Error:', err)
        res.status(500).json({ error: (err as Error).message })
      }
    })

    // Relationship
    this.app.get('/api/relationship/:characterId', (req, res) => {
      const state = this.relationship.getState(req.params.characterId)
      res.json(state)
    })

    this.app.post('/api/relationship/:characterId/fact', (req, res) => {
      const { fact } = req.body
      if (!fact) {
        res.status(400).json({ error: 'fact is required' })
        return
      }
      this.relationship.saveStableFact(req.params.characterId, fact)
      res.json({ saved: true })
    })

    // Providers
    this.app.get('/api/providers', async (_req, res) => {
      const providers: any[] = []

      // Check Dalai
      const { DalaiLLMProvider } = await import('../providers/dalai-provider')
      const dalai = new DalaiLLMProvider()
      const dalaiAvailable = await dalai.isAvailable()
      providers.push({ name: 'dalai-local', available: dalaiAvailable, type: 'local' })

      // Check OpenAI
      providers.push({
        name: 'openai',
        available: !!process.env.OPENAI_API_KEY,
        type: 'cloud',
      })

      // Check current provider
      providers.push({
        name: this.provider?.name || 'none',
        available: true,
        type: 'active',
      })

      res.json(providers)
    })

    // Game integrations
    this.app.get('/api/games', (_req, res) => {
      res.json(GAME_INTEGRATIONS)
    })

    this.app.post('/api/games/:game/start', (req, res) => {
      const game = GAME_INTEGRATIONS.find(g => g.id === req.params.game)
      if (!game) {
        res.status(404).json({ error: 'Game not found' })
        return
      }
      if (!game.available) {
        res.status(503).json({ error: `${game.name} integration is not yet available` })
        return
      }
      res.json({
        game: game.id,
        name: game.name,
        status: 'starting',
        message: `${game.name} integration starting. In AIRI, this launches the integration module at ${game.airiPath}.`,
        airiPath: game.airiPath,
      })
    })

    // Voice proxy (for VGF compatibility — ElevenLabs TTS)
    this.app.post('/api/tts', async (req, res) => {
      const { text, voice } = req.body
      const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY

      if (!elevenLabsKey) {
        res.status(503).json({ error: 'ElevenLabs API key not configured' })
        return
      }

      try {
        const voiceId = voice || 'kgG7dCoKCfLehAPWkJOE' // Default VGF voice
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenLabsKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        })

        if (!response.ok) {
          throw new Error(`ElevenLabs error: ${response.status}`)
        }

        const audioBuffer = Buffer.from(await response.arrayBuffer())
        res.set('Content-Type', 'audio/mpeg')
        res.send(audioBuffer)
      } catch (err) {
        res.status(500).json({ error: (err as Error).message })
      }
    })
  }

  private setupSocketHandlers(): void {
    // Socket.io for streaming responses and real-time avatar updates
    this.io.on('connection', (socket) => {
      console.log('[Socket.io] Client connected:', socket.id)

      socket.on('chat', async (data: { characterId: string; message: string }) => {
        try {
          if (!this.provider) {
            this.provider = await createProvider()
          }

          const char = this.characters.get(data.characterId)
          if (!char) {
            socket.emit('error', { message: 'Character not found' })
            return
          }

          const relState = this.relationship.getState(data.characterId)
          const systemPrompt = buildCharacterPrompt(char, relState.currentMood)
          const relSummary = this.relationship.getRelationshipSummary(data.characterId)

          const messages = [
            { role: 'system', content: systemPrompt + '\n\n' + relSummary },
            { role: 'user', content: data.message },
          ]

          const response = await this.provider.chat({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 500,
          })

          const updatedState = await this.relationship.processInteraction(
            data.characterId, data.message, response.text,
          )

          const mood = response.mood || updatedState.currentMood
          const avatarExpr = char.avatarExpressions[mood as keyof typeof char.avatarExpressions] || char.avatarExpressions.default

          socket.emit('chat:response', {
            text: response.text,
            mood,
            facialExpression: response.facialExpression || avatarExpr.facialExpression,
            animation: response.animation || avatarExpr.animation,
            relationship: updatedState.dimensions,
          })
        } catch (err) {
          socket.emit('error', { message: (err as Error).message })
        }
      })

      socket.on('disconnect', () => {
        console.log('[Socket.io] Client disconnected:', socket.id)
      })
    })
  }

  /**
   * Load default characters from a directory.
   */
  loadCharacters(dir: string): void {
    if (!fs.existsSync(dir)) {
      console.warn(`[Server] Character directory not found: ${dir}`)
      return
    }
    const chars = importCharacterDirectory(dir)
    for (const char of chars) {
      this.characters.set(char.id, char)
    }
    console.log(`[Server] Loaded ${chars.length} characters from ${dir}`)
  }

  /**
   * Start the server.
   */
  async start(): Promise<void> {
    // Initialize provider
    this.provider = await createProvider()

    // Start relationship decay timer
    this.relationship.startDecayTimer()

    this.httpServer.listen(this.port, () => {
      console.log(`
╔══════════════════════════════════════════════════════╗
║     Unified AI Companion Platform v0.1.0             ║
║     Integrating 8 repos into one companion           ║
╠══════════════════════════════════════════════════════╣
║  REST API:     http://localhost:${this.port}              ║
║  Socket.io:    ws://localhost:${this.port}              ║
║  Provider:     ${this.provider.name.padEnd(37)}║
║  Characters:   ${String(this.characters.size).padEnd(37)}║
║  Games:        ${String(GAME_INTEGRATIONS.filter(g => g.available).length).padEnd(37)}║
╠══════════════════════════════════════════════════════╣
║  Endpoints:                                           ║
║  GET  /api/characters   — List characters             ║
║  POST /api/chat          — Chat with companion         ║
║  GET  /api/games         — Game integrations           ║
║  POST /api/tts           — Text-to-speech (ElevenLabs) ║
║  GET  /api/providers     — LLM provider status         ║
╚══════════════════════════════════════════════════════╝
`)
    })
  }

  stop(): void {
    this.relationship.stopDecayTimer()
    this.io.close()
    this.httpServer.close()
  }
}

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CompanionServer(parseInt(process.env.PORT || '3000'))
  
  // Load characters from SillyTavern's default directory if available
  const stCharsDir = path.resolve('../../SillyTavern/data/default-user/characters')
  if (fs.existsSync(stCharsDir)) {
    server.loadCharacters(stCharsDir)
  }

  server.start().catch(console.error)
}
