/**
 * Eros-Engine Relationship Bridge
 * 
 * Integrates eros-engine's six-dimension affinity model and two-layer memory
 * into the unified companion platform. Runs as either:
 *   1. A sidecar HTTP service (if eros-engine Rust binary is running)
 *   2. A local in-process simulation (fallback when eros-engine isn't available)
 * 
 * The relationship state shapes LLM prompts so the companion's tone evolves
 * based on trust, affection, intimacy, passion, commitment, and satisfaction.
 */

import type { RelationshipDimensions } from '../character/card-parser'

// --- Types ---

export interface RelationshipUpdate {
  dimension: keyof RelationshipDimensions
  delta: number      // positive or negative change
  reason: string     // what triggered the change
  timestamp: number
}

export interface MemoryEntry {
  id: string
  type: 'stable_fact' | 'shared_moment' | 'callback'
  content: string
  emotionalValence: number  // -1 (negative) to 1 (positive)
  importance: number        // 0-1
  createdAt: number
  lastRecalled: number
  recallCount: number
}

export interface RelationshipState {
  dimensions: RelationshipDimensions
  memories: MemoryEntry[]
  history: RelationshipUpdate[]
  // Eros-engine persona decision output
  currentMood: string
  innerState: string
  actionDecision: string
}

// --- Relationship Engine ---

/**
 * In-process relationship engine that mirrors eros-engine's model.
 * When eros-engine is running as a sidecar, this delegates to its API.
 * Otherwise it runs locally with the same logic.
 */
export class RelationshipEngine {
  private state: Map<string, RelationshipState> = new Map()
  private erosApiUrl: string | null
  private decayInterval: NodeJS.Timeout | null = null

  constructor(erosApiUrl?: string) {
    this.erosApiUrl = erosApiUrl || null
  }

  /**
   * Get or initialize relationship state for a character-user pair.
   */
  getState(characterId: string, initialDimensions?: RelationshipDimensions): RelationshipState {
    if (!this.state.has(characterId)) {
      this.state.set(characterId, {
        dimensions: initialDimensions || {
          trust: 30, affection: 20, intimacy: 10,
          commitment: 15, passion: 25, satisfaction: 40,
          lastInteraction: Date.now(), totalInteractions: 0,
        },
        memories: [],
        history: [],
        currentMood: 'neutral',
        innerState: 'curious',
        actionDecision: 'respond_warmly',
      })
    }
    return this.state.get(characterId)!
  }

  /**
   * Process a user message and update relationship state.
   * This is the core loop: user message → analyze → update dimensions → decide mood.
   */
  async processInteraction(
    characterId: string,
    userMessage: string,
    companionResponse: string,
  ): Promise<RelationshipState> {
    const state = this.getState(characterId)

    // Analyze the interaction for relationship impact
    const analysis = this.analyzeInteraction(userMessage, companionResponse)

    // Update dimensions based on analysis
    for (const update of analysis.updates) {
      this.applyUpdate(characterId, update)
    }

    // Store memory
    this.addMemory(characterId, {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'shared_moment',
      content: `User: "${userMessage.slice(0, 200)}" → Companion: "${companionResponse.slice(0, 200)}"`,
      emotionalValence: analysis.valence,
      importance: analysis.importance,
      createdAt: Date.now(),
      lastRecalled: Date.now(),
      recallCount: 0,
    })

    // Update mood and inner state
    state.currentMood = this.deriveMood(state.dimensions)
    state.innerState = this.deriveInnerState(state.dimensions, analysis.valence)
    state.actionDecision = this.deriveAction(state.dimensions, analysis.valence)

    // Update interaction metadata
    state.dimensions.lastInteraction = Date.now()
    state.dimensions.totalInteractions++

    // If eros-engine sidecar is available, delegate the heavy lifting
    if (this.erosApiUrl) {
      try {
        await this.syncWithEros(characterId, state)
      } catch (err) {
        console.warn('[RelationshipEngine] Eros sync failed, using local state:', (err as Error).message)
      }
    }

    return state
  }

  /**
   * Apply time-decay to relationship dimensions.
   * Like eros-engine, affection/intimacy/passion decay over time without interaction.
   */
  applyTimeDecay(characterId: string): void {
    const state = this.getState(characterId)
    const now = Date.now()
    const hoursSinceInteraction = (now - state.dimensions.lastInteraction) / (1000 * 60 * 60)

    if (hoursSinceInteraction < 1) return // No decay within 1 hour

    // Decay rates per hour (eros-engine uses similar time-based decay)
    const decayRates = {
      affection: 0.5,    // -0.5/hr
      intimacy: 0.3,     // -0.3/hr
      passion: 0.8,      // -0.8/hr (passion decays fastest)
      satisfaction: 0.2, // -0.2/hr
      trust: 0.1,        // -0.1/hr (trust is most stable)
      commitment: 0.05,  // -0.05/hr (commitment barely decays)
    }

    for (const [dim, rate] of Object.entries(decayRates)) {
      const key = dim as keyof RelationshipDimensions
      if (typeof state.dimensions[key] === 'number') {
        state.dimensions[key] = Math.max(0, (state.dimensions[key] as number) - rate * hoursSinceInteraction)
      }
    }

    state.dimensions.lastInteraction = now
  }

  /**
   * Start periodic time-decay (call once at server startup).
   */
  startDecayTimer(intervalMs: number = 3600000): void { // default: 1 hour
    if (this.decayInterval) clearInterval(this.decayInterval)
    this.decayInterval = setInterval(() => {
      for (const characterId of this.state.keys()) {
        this.applyTimeDecay(characterId)
      }
    }, intervalMs)
  }

  stopDecayTimer(): void {
    if (this.decayInterval) {
      clearInterval(this.decayInterval)
      this.decayInterval = null
    }
  }

  // --- Analysis ---

  private analyzeInteraction(userMessage: string, companionResponse: string): {
    updates: RelationshipUpdate[]
    valence: number  // -1 to 1
    importance: number // 0 to 1
  } {
    const text = (userMessage + ' ' + companionResponse).toLowerCase()
    const updates: RelationshipUpdate[] = []
    let valence = 0
    let importance = 0.3

    const now = Date.now()

    // Positive signals
    const positiveWords = ['love', 'care', 'miss you', 'sweet', 'beautiful', 'amazing', 'thank', 'happy', 'proud', 'wonderful', '❤', '💕', '🥰', '💖']
    const negativeWords = ['hate', 'stupid', 'shut up', 'boring', 'leave', 'angry', 'sad', 'lonely', 'hurt', 'ignore']
    const intimateWords = ['kiss', 'hug', 'hold', 'close', 'intimate', 'cuddle', 'embrace', 'tender']
    const trustWords = ['trust', 'honest', 'truth', 'promise', 'always', 'real', 'genuine']
    const passionateWords = ['desire', 'want you', 'need you', 'passion', 'fire', 'burning', 'crave']

    const positiveCount = positiveWords.filter(w => text.includes(w)).length
    const negativeCount = negativeWords.filter(w => text.includes(w)).length
    const intimateCount = intimateWords.filter(w => text.includes(w)).length
    const trustCount = trustWords.filter(w => text.includes(w)).length
    const passionateCount = passionateWords.filter(w => text.includes(w)).length

    if (positiveCount > 0) {
      updates.push({ dimension: 'affection', delta: positiveCount * 3, reason: 'positive language', timestamp: now })
      updates.push({ dimension: 'satisfaction', delta: positiveCount * 2, reason: 'positive interaction', timestamp: now })
      valence += positiveCount * 0.2
      importance = Math.max(importance, 0.5)
    }

    if (negativeCount > 0) {
      updates.push({ dimension: 'affection', delta: -negativeCount * 4, reason: 'negative language', timestamp: now })
      updates.push({ dimension: 'satisfaction', delta: -negativeCount * 3, reason: 'negative interaction', timestamp: now })
      updates.push({ dimension: 'trust', delta: -negativeCount * 2, reason: 'negative interaction', timestamp: now })
      valence -= negativeCount * 0.3
      importance = Math.max(importance, 0.6)
    }

    if (intimateCount > 0) {
      updates.push({ dimension: 'intimacy', delta: intimateCount * 5, reason: 'intimate language', timestamp: now })
      updates.push({ dimension: 'passion', delta: intimateCount * 3, reason: 'intimate language', timestamp: now })
      valence += intimateCount * 0.15
      importance = Math.max(importance, 0.7)
    }

    if (trustCount > 0) {
      updates.push({ dimension: 'trust', delta: trustCount * 4, reason: 'trust-building language', timestamp: now })
      updates.push({ dimension: 'commitment', delta: trustCount * 2, reason: 'trust-building language', timestamp: now })
      importance = Math.max(importance, 0.6)
    }

    if (passionateCount > 0) {
      updates.push({ dimension: 'passion', delta: passionateCount * 6, reason: 'passionate language', timestamp: now })
      valence += passionateCount * 0.2
      importance = Math.max(importance, 0.8)
    }

    // Message length as engagement signal
    if (userMessage.length > 100) {
      updates.push({ dimension: 'satisfaction', delta: 1, reason: 'engaged conversation', timestamp: now })
    }

    // Clamp valence
    valence = Math.max(-1, Math.min(1, valence))

    return { updates, valence, importance }
  }

  private applyUpdate(characterId: string, update: RelationshipUpdate): void {
    const state = this.getState(characterId)
    const current = state.dimensions[update.dimension] as number
    if (typeof current === 'number') {
      state.dimensions[update.dimension] = Math.max(0, Math.min(100, current + update.delta))
    }
    state.history.push(update)
    // Keep history bounded
    if (state.history.length > 100) {
      state.history = state.history.slice(-100)
    }
  }

  private addMemory(characterId: string, memory: MemoryEntry): void {
    const state = this.getState(characterId)
    state.memories.push(memory)
    // Keep memory bounded (eros-engine uses Postgres, we keep in-memory)
    if (state.memories.length > 200) {
      // Remove least important, least recently recalled
      state.memories.sort((a, b) => (b.importance * (b.recallCount + 1)) - (a.importance * (a.recallCount + 1)))
      state.memories = state.memories.slice(0, 200)
    }
  }

  private deriveMood(dim: RelationshipDimensions): string {
    if (dim.affection > 70 && dim.passion > 60) return 'love'
    if (dim.affection > 50 && dim.satisfaction > 60) return 'happy'
    if (dim.satisfaction < 30) return 'sad'
    if (dim.trust < 20) return 'angry'
    if (dim.passion > 70) return 'excited'
    if (dim.affection > 40 && dim.intimacy > 30) return 'flirty'
    return 'neutral'
  }

  private deriveInnerState(dim: RelationshipDimensions, valence: number): string {
    if (valence > 0.5) return 'joyful'
    if (valence > 0.2) return 'warm'
    if (valence < -0.5) return 'hurt'
    if (valence < -0.2) return 'guarded'
    if (dim.trust < 25) return 'cautious'
    if (dim.affection > 60) return 'devoted'
    return 'curious'
  }

  private deriveAction(dim: RelationshipDimensions, valence: number): string {
    if (valence > 0.5) return 'express_affection'
    if (valence < -0.3) return 'seek_reassurance'
    if (dim.affection > 70) return 'be_intimate'
    if (dim.trust < 20) return 'build_trust'
    if (dim.satisfaction < 30) return 'comfort_user'
    return 'respond_warmly'
  }

  /**
   * Get relevant memories for context injection.
   * Mirrors eros-engine's recall: stable facts + high-importance moments.
   */
  getRelevantMemories(characterId: string, query: string, limit: number = 5): MemoryEntry[] {
    const state = this.getState(characterId)
    const queryLower = query.toLowerCase()

    // Score memories by relevance
    const scored = state.memories.map(m => {
      let score = m.importance
      // Keyword overlap
      const contentLower = m.content.toLowerCase()
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3)
      for (const word of queryWords) {
        if (contentLower.includes(word)) score += 0.3
      }
      // Stable facts are always relevant
      if (m.type === 'stable_fact') score += 0.2
      // Penalize frequently recalled (diversity)
      score -= m.recallCount * 0.05
      return { memory: m, score }
    })

    scored.sort((a, b) => b.score - a.score)
    const results = scored.slice(0, limit).map(s => {
      s.memory.recallCount++
      s.memory.lastRecalled = Date.now()
      return s.memory
    })

    return results
  }

  /**
   * Sync with eros-engine sidecar if available.
   */
  private async syncWithEros(characterId: string, state: RelationshipState): Promise<void> {
    if (!this.erosApiUrl) return

    try {
      await fetch(`${this.erosApiUrl}/api/companion/${characterId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
    } catch {
      // Eros not running — silently fall back to local state
    }
  }

  /**
   * Save a stable fact about the user (long-term memory).
   */
  saveStableFact(characterId: string, fact: string): void {
    this.addMemory(characterId, {
      id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'stable_fact',
      content: fact,
      emotionalValence: 0,
      importance: 0.9,
      createdAt: Date.now(),
      lastRecalled: Date.now(),
      recallCount: 0,
    })
  }

  /**
   * Get relationship summary for prompt injection.
   */
  getRelationshipSummary(characterId: string): string {
    const state = this.getState(characterId)
    const dim = state.dimensions

    const lines: string[] = []
    lines.push(`Relationship: Trust ${Math.round(dim.trust)}/100, Affection ${Math.round(dim.affection)}/100, Intimacy ${Math.round(dim.intimacy)}/100`)
    lines.push(`Passion ${Math.round(dim.passion)}/100, Commitment ${Math.round(dim.commitment)}/100, Satisfaction ${Math.round(dim.satisfaction)}/100`)
    lines.push(`Current mood: ${state.currentMood}, Inner state: ${state.innerState}`)
    lines.push(`Total interactions: ${dim.totalInteractions}`)

    // Include relevant stable facts
    const facts = state.memories.filter(m => m.type === 'stable_fact').slice(-5)
    if (facts.length > 0) {
      lines.push('Known facts about user:')
      for (const f of facts) {
        lines.push(`  - ${f.content}`)
      }
    }

    return lines.join('\n')
  }
}
