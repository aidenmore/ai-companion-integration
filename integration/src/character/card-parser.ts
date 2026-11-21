/**
 * SillyTavern Character Card Parser
 * 
 * Parses V2/V3 character cards from PNG files (metadata embedded in tEXt chunks)
 * and JSON files. Converts to a unified character format that can be used
 * across AIRI, AgnAI, and the virtual-girlfriend avatar system.
 * 
 * SillyTavern V2 spec: https://github.com/malfoyslastname/character-card-spec-v2
 * V3 spec adds: character_book, assets, group_only_greetings, extensions
 */

import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'

// --- Type Definitions ---

export interface CharacterCardV2 {
  spec: 'chara_card_v2'
  spec_version: '2.0'
  data: {
    name: string
    description: string
    personality: string
    scenario: string
    first_mes: string
    alternate_greetings: string[]
    creator_notes: string
    system_prompt: string
    post_history_instructions: string
    tags: string[]
    creator: string
    character_version: string
    extensions: {
      fav?: boolean
      world?: string
      depth_prompt?: { depth: number; prompt: string }
      [key: string]: unknown
    }
  }
}

export interface CharacterBookEntry {
  keys: string[]
  secondary_keys?: string[]
  content: string
  comment?: string
  constant: boolean
  selective: boolean
  insertion_order: number
  enabled: boolean
  position: 'before_char' | 'after_char'
  case_sensitive?: boolean
  probability?: number
  [key: string]: unknown
}

export interface CharacterBook {
  name: string
  description?: string
  scan_depth?: number
  token_budget?: number
  recursive_scanning?: boolean
  extensions?: Record<string, unknown>
  entries: CharacterBookEntry[]
}

export interface CharacterCardV3 extends Omit<CharacterCardV2, 'spec' | 'spec_version'> {
  spec: 'chara_card_v3'
  spec_version: '3.0'
  data: CharacterCardV2['data'] & {
    character_book?: CharacterBook
    assets?: { type: string; uri: string; name: string; ext: string }[]
    group_only_greetings?: string[]
    extensions: CharacterCardV2['data']['extensions'] & {
      talkativeness?: string
      fav?: boolean
      world?: string
      [key: string]: unknown
    }
  }
}

export type CharacterCard = CharacterCardV2 | CharacterCardV3

/**
 * Unified character format — the lingua franca across all integrated platforms.
 * This is what AIRI's core-agent, the VGF avatar, and eros-engine all consume.
 */
export interface UnifiedCharacter {
  id: string
  name: string
  description: string
  personality: string
  scenario: string
  firstMessage: string
  alternateGreetings: string[]
  creatorNotes: string
  systemPrompt: string
  postHistoryInstructions: string
  tags: string[]
  creator: string
  version: string
  // VGF avatar mapping: which facial expression/animation to use for different moods
  avatarExpressions: AvatarExpressionMap
  // Eros-engine relationship dimensions (initialized to defaults)
  relationshipDimensions: RelationshipDimensions
  // World info / character book for dynamic context
  characterBook?: CharacterBook
  // Extension data passthrough
  extensions: Record<string, unknown>
  // Source metadata
  source: {
    spec: string
    specVersion: string
    importedAt: string
    originalFormat: 'sillytavern-v2' | 'sillytavern-v3' | 'agnai' | 'custom'
  }
}

export interface AvatarExpressionMap {
  // Map emotional states to VGF facial expressions and animations
  happy: { facialExpression: string; animation: string }
  sad: { facialExpression: string; animation: string }
  angry: { facialExpression: string; animation: string }
  surprised: { facialExpression: string; animation: string }
  flirty: { facialExpression: string; animation: string }
  love: { facialExpression: string; animation: string }
  excited: { facialExpression: string; animation: string }
  default: { facialExpression: string; animation: string }
}

export interface RelationshipDimensions {
  // Eros-engine six-dimension affinity model
  trust: number       // 0-100
  affection: number   // 0-100
  intimacy: number    // 0-100
  commitment: number  // 0-100
  passion: number     // 0-100
  satisfaction: number // 0-100
  // Time-decay metadata
  lastInteraction: number // timestamp
  totalInteractions: number
}

// --- Default Values ---

export const DEFAULT_AVATAR_EXPRESSIONS: AvatarExpressionMap = {
  happy: { facialExpression: 'smile', animation: 'Talking_1' },
  sad: { facialExpression: 'sad', animation: 'Crying' },
  angry: { facialExpression: 'angry', animation: 'Angry' },
  surprised: { facialExpression: 'surprised', animation: 'Talking_2' },
  flirty: { facialExpression: 'funnyFace', animation: 'Laughing' },
  love: { facialExpression: 'smile', animation: 'Rumba Dancing' },
  excited: { facialExpression: 'surprised', animation: 'Laughing' },
  default: { facialExpression: 'default', animation: 'Idle' },
}

export const DEFAULT_RELATIONSHIP: RelationshipDimensions = {
  trust: 30,
  affection: 20,
  intimacy: 10,
  commitment: 15,
  passion: 25,
  satisfaction: 40,
  lastInteraction: Date.now(),
  totalInteractions: 0,
}

// --- PNG Metadata Reading ---

/**
 * Read character card metadata from a PNG file's tEXt chunks.
 * Supports both V2 (chara keyword) and V3 (ccv3 keyword).
 */
export function readCardFromPNG(filePath: string): CharacterCard {
  const buffer = fs.readFileSync(filePath)
  return parsePNGBuffer(buffer)
}

/**
 * Parse PNG buffer and extract character card data.
 * This mirrors SillyTavern's character-card-parser.js logic.
 */
export function parsePNGBuffer(buffer: Buffer): CharacterCard {
  // PNG signature check
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('Not a valid PNG file')
  }

  const textChunks = extractTextChunks(buffer)

  // V3 takes precedence
  const ccv3 = textChunks.find(c => c.keyword.toLowerCase() === 'ccv3')
  if (ccv3) {
    const json = Buffer.from(ccv3.text, 'base64').toString('utf8')
    return JSON.parse(json) as CharacterCardV3
  }

  // V2 fallback
  const chara = textChunks.find(c => c.keyword.toLowerCase() === 'chara')
  if (chara) {
    const json = Buffer.from(chara.text, 'base64').toString('utf8')
    return JSON.parse(json) as CharacterCardV2
  }

  throw new Error('No character card data found in PNG metadata')
}

interface PNGTextChunk {
  keyword: string
  text: string
}

function extractTextChunks(buffer: Buffer): PNGTextChunk[] {
  const chunks: PNGTextChunk[] = []
  let offset = 8 // Skip PNG signature

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)

    if (type === 'tEXt') {
      const nullIdx = data.indexOf(0)
      if (nullIdx > 0) {
        const keyword = data.subarray(0, nullIdx).toString('latin1')
        const text = data.subarray(nullIdx + 1).toString('latin1')
        chunks.push({ keyword, text })
      }
    }

    // tEXt chunk is followed by CRC (4 bytes)
    offset += 8 + length + 4

    if (type === 'IEND') break
  }

  return chunks
}

// --- JSON Card Reading ---

export function readCardFromJSON(filePath: string): CharacterCard {
  const content = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(content) as CharacterCard
}

/**
 * Auto-detect format and read a character card from any supported file.
 */
export function readCharacterCard(filePath: string): CharacterCard {
  const ext = path.extname(filePath).toLowerCase()
  
  if (ext === '.png' || ext === '.webp') {
    return readCardFromPNG(filePath)
  }
  
  if (ext === '.json') {
    return readCardFromJSON(filePath)
  }

  // Try PNG first, then JSON
  try {
    return readCardFromPNG(filePath)
  } catch {
    return readCardFromJSON(filePath)
  }
}

// --- Conversion to Unified Format ---

/**
 * Convert a SillyTavern character card (V2 or V3) to the UnifiedCharacter format.
 * This is the key integration function — it bridges SillyTavern's character system
 * into AIRI's agent system, the VGF avatar, and eros-engine's relationship model.
 */
export function toUnifiedCharacter(card: CharacterCard): UnifiedCharacter {
  const data = card.data
  const isV3 = card.spec === 'chara_card_v3'

  // Derive avatar expressions from character tags/personality
  const avatarExpressions = deriveAvatarExpressions(data.personality, data.tags)

  return {
    id: generateId(data.name),
    name: data.name,
    description: data.description,
    personality: data.personality,
    scenario: data.scenario,
    firstMessage: data.first_mes,
    alternateGreetings: data.alternate_greetings || [],
    creatorNotes: data.creator_notes,
    systemPrompt: data.system_prompt,
    postHistoryInstructions: data.post_history_instructions,
    tags: data.tags || [],
    creator: data.creator,
    version: data.character_version,
    avatarExpressions,
    relationshipDimensions: { ...DEFAULT_RELATIONSHIP },
    characterBook: isV3 && (card as CharacterCardV3).data.character_book
      ? (card as CharacterCardV3).data.character_book
      : undefined,
    extensions: data.extensions || {},
    source: {
      spec: card.spec,
      specVersion: card.spec_version,
      importedAt: new Date().toISOString(),
      originalFormat: card.spec === 'chara_card_v3' ? 'sillytavern-v3' : 'sillytavern-v2',
    },
  }
}

/**
 * Derive avatar facial expression mappings from character personality traits.
 * Maps personality keywords to VGF's facial expressions and animations.
 */
function deriveAvatarExpressions(personality: string, tags: string[]): AvatarExpressionMap {
  const text = (personality + ' ' + tags.join(' ')).toLowerCase()
  const expressions = { ...DEFAULT_AVATAR_EXPRESSIONS }

  // Customize based on personality traits
  if (text.includes('shy') || text.includes('timid')) {
    expressions.default = { facialExpression: 'default', animation: 'Idle' }
    expressions.flirty = { facialExpression: 'smile', animation: 'Talking_0' }
  }
  if (text.includes('energetic') || text.includes('cheerful') || text.includes('bubbly')) {
    expressions.happy = { facialExpression: 'smile', animation: 'Laughing' }
    expressions.excited = { facialExpression: 'surprised', animation: 'Rumba Dancing' }
  }
  if (text.includes('tsundere') || text.includes('stubborn')) {
    expressions.angry = { facialExpression: 'angry', animation: 'Angry' }
    expressions.flirty = { facialExpression: 'angry', animation: 'Talking_1' }
  }
  if (text.includes('yandere') || text.includes('obsessive')) {
    expressions.love = { facialExpression: 'funnyFace', animation: 'Talking_2' }
    expressions.angry = { facialExpression: 'angry', animation: 'Terrified' }
  }
  if (text.includes('calm') || text.includes('gentle') || text.includes('mature')) {
    expressions.default = { facialExpression: 'smile', animation: 'Idle' }
    expressions.sad = { facialExpression: 'sad', animation: 'Idle' }
  }

  return expressions
}

function generateId(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) + '-' + Math.random().toString(36).slice(2, 8)
}

// --- Batch Import ---

/**
 * Import all character cards from a directory.
 * Supports .png (with embedded metadata) and .json files.
 */
export function importCharacterDirectory(dirPath: string): UnifiedCharacter[] {
  const files = fs.readdirSync(dirPath)
  const characters: UnifiedCharacter[] = []

  for (const file of files) {
    const filePath = path.join(dirPath, file)
    const ext = path.extname(file).toLowerCase()

    if (!['.png', '.json', '.webp'].includes(ext)) continue

    try {
      const card = readCharacterCard(filePath)
      const unified = toUnifiedCharacter(card)
      characters.push(unified)
      console.log(`  ✓ Imported: ${unified.name} (${unified.source.originalFormat})`)
    } catch (err) {
      console.error(`  ✗ Failed to import ${file}: ${(err as Error).message}`)
    }
  }

  return characters
}

// --- Prompt Building ---

/**
 * Build the system prompt for the LLM from a unified character.
 * This integrates SillyTavern's character fields with eros-engine's relationship state.
 */
export function buildCharacterPrompt(char: UnifiedCharacter, mood?: string): string {
  const parts: string[] = []

  // Base system prompt (from character card or default)
  if (char.systemPrompt) {
    parts.push(char.systemPrompt)
  } else {
    parts.push('You are a virtual companion engaging in a natural conversation. Stay in character at all times.')
  }

  // Character identity
  parts.push(`\n## Your Identity`)
  parts.push(`Name: ${char.name}`)
  if (char.description) parts.push(`Description: ${char.description}`)
  if (char.personality) parts.push(`Personality: ${char.personality}`)

  // Scenario
  if (char.scenario) {
    parts.push(`\n## Current Scenario`)
    parts.push(char.scenario)
  }

  // Relationship context from eros-engine
  const rel = char.relationshipDimensions
  parts.push(`\n## Relationship State`)
  parts.push(`Trust: ${rel.trust}/100, Affection: ${rel.affection}/100, Intimacy: ${rel.intimacy}/100`)
  parts.push(`Passion: ${rel.passion}/100, Commitment: ${rel.commitment}/100, Satisfaction: ${rel.satisfaction}/100`)
  parts.push(`Total interactions: ${rel.totalInteractions}`)
  
  // Adjust tone based on relationship levels
  if (rel.affection > 70) {
    parts.push('You feel deeply affectionate toward the user. Express warmth and closeness naturally.')
  } else if (rel.affection > 40) {
    parts.push('You are warming up to the user. Show growing fondness.')
  } else {
    parts.push('You are still getting to know the user. Be friendly but not overly familiar.')
  }

  // Mood → avatar expression hint (for VGF integration)
  if (mood) {
    const expr = char.avatarExpressions[mood as keyof AvatarExpressionMap] || char.avatarExpressions.default
    parts.push(`\n## Response Format`)
    parts.push(`Respond with a JSON object: {"text": "your response", "facialExpression": "${expr.facialExpression}", "animation": "${expr.animation}", "mood": "${mood}"}`)
  }

  // Post-history instructions
  if (char.postHistoryInstructions) {
    parts.push(`\n## Additional Instructions`)
    parts.push(char.postHistoryInstructions)
  }

  // Character book entries (world info)
  if (char.characterBook?.entries) {
    const activeEntries = char.characterBook.entries.filter(e => e.enabled)
    if (activeEntries.length > 0) {
      parts.push(`\n## World Context`)
      for (const entry of activeEntries) {
        if (entry.constant) {
          parts.push(entry.content)
        }
      }
    }
  }

  return parts.join('\n')
}
