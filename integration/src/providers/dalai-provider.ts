/**
 * Dalai Local LLM Provider Adapter
 * 
 * Bridges Dalai's Socket.io API into the unified platform's LLM interface.
 * Dalai runs llama.cpp/alpaca.cpp locally for private, uncensored inference.
 * 
 * Usage:
 *   const provider = new DalaiProvider('http://localhost:3000')
 *   const response = await provider.chat({
 *     model: '7B',
 *     messages: [{ role: 'user', content: 'Hey sweetie!' }],
 *   })
 */

import { io, type Socket } from 'socket.io-client'

export interface DalaiChatRequest {
  model: string         // e.g. '7B', '13B', '65B'
  messages: { role: string; content: string }[]
  temperature?: number
  max_tokens?: number   // Dalai uses n_predict
  top_p?: number
  top_k?: number
  repetition_penalty?: number
  stream?: boolean
}

export interface DalaiChatResponse {
  text: string
  model: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Convert OpenAI-style messages to Dalai's prompt format.
 * Dalai works with raw text prompts, not structured messages.
 */
function messagesToPrompt(messages: { role: string; content: string }[]): string {
  return messages.map(m => {
    switch (m.role) {
      case 'system':
        return `### System:\n${m.content}`
      case 'user':
        return `### User:\n${m.content}`
      case 'assistant':
        return `### Assistant:\n${m.content}`
      default:
        return `### ${m.role}:\n${m.content}`
    }
  }).join('\n\n') + '\n\n### Assistant:\n'
}

export class DalaiProvider {
  private socket: Socket | null = null
  private url: string
  private connected: boolean = false

  constructor(url: string = 'http://localhost:3000') {
    this.url = url
  }

  /**
   * Connect to the Dalai Socket.io server.
   */
  async connect(): Promise<void> {
    if (this.connected && this.socket?.connected) return

    return new Promise((resolve, reject) => {
      this.socket = io(this.url, { transports: ['websocket', 'polling'] })

      this.socket.on('connect', () => {
        this.connected = true
        console.log(`[DalaiProvider] Connected to ${this.url}`)
        resolve()
      })

      this.socket.on('connect_error', (err: Error) => {
        this.connected = false
        reject(new Error(`Failed to connect to Dalai at ${this.url}: ${err.message}`))
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error(`Connection to Dalai timed out at ${this.url}`))
        }
      }, 5000)
    })
  }

  /**
   * Send a chat completion request to Dalai.
   * Returns the full response (non-streaming for simplicity).
   */
  async chat(request: DalaiChatRequest): Promise<DalaiChatResponse> {
    await this.connect()

    if (!this.socket) {
      throw new Error('Dalai socket not initialized')
    }

    const prompt = messagesToPrompt(request.messages)

    const dalaiRequest = {
      model: request.model,
      prompt,
      n_predict: request.max_tokens || 500,
      temperature: request.temperature || 0.7,
      top_p: request.top_p || 0.9,
      top_k: request.top_k || 40,
      repetition_penalty: request.repetition_penalty || 1.1,
      stop: ['### User:', '### System:', '\n\n### '],
    }

    return new Promise((resolve, reject) => {
      let responseText = ''
      const timeout = setTimeout(() => {
        reject(new Error('Dalai request timed out (60s)'))
      }, 60000)

      this.socket!.emit('request', dalaiRequest)

      this.socket!.on('result', (data: { response: string; request: unknown }) => {
        responseText += data.response
      })

      // Dalai streams tokens via 'result' events. We detect completion
      // when the response ends with a stop token or no more events arrive.
      // For simplicity, we collect all output and resolve after a brief idle.
      let idleTimer: NodeJS.Timeout | null = null

      this.socket!.on('result', (data: { response: string }) => {
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          clearTimeout(timeout)
          this.socket!.off('result')
          resolve({
            text: responseText.trim(),
            model: request.model,
            usage: {
              prompt_tokens: Math.floor(prompt.length / 4),
              completion_tokens: Math.floor(responseText.length / 4),
              total_tokens: Math.floor((prompt.length + responseText.length) / 4),
            },
          })
        }, 1000) // 1 second of no new tokens = done
      })

      this.socket!.on('error', (err: Error) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  }

  /**
   * Stream chat completion via callback.
   */
  async chatStream(
    request: DalaiChatRequest,
    onToken: (token: string) => void,
  ): Promise<DalaiChatResponse> {
    await this.connect()

    if (!this.socket) {
      throw new Error('Dalai socket not initialized')
    }

    const prompt = messagesToPrompt(request.messages)

    const dalaiRequest = {
      model: request.model,
      prompt,
      n_predict: request.max_tokens || 500,
      temperature: request.temperature || 0.7,
      top_p: request.top_p || 0.9,
      top_k: request.top_k || 40,
      repetition_penalty: request.repetition_penalty || 1.1,
      stop: ['### User:', '### System:', '\n\n### '],
    }

    return new Promise((resolve, reject) => {
      let responseText = ''
      const timeout = setTimeout(() => {
        reject(new Error('Dalai stream timed out (60s)'))
      }, 60000)

      this.socket!.emit('request', dalaiRequest)

      this.socket!.on('result', (data: { response: string }) => {
        responseText += data.response
        onToken(data.response)
      })

      let idleTimer: NodeJS.Timeout | null = null

      const onResult = () => {
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          clearTimeout(timeout)
          this.socket!.off('result')
          resolve({
            text: responseText.trim(),
            model: request.model,
            usage: {
              prompt_tokens: Math.floor(prompt.length / 4),
              completion_tokens: Math.floor(responseText.length / 4),
              total_tokens: Math.floor((prompt.length + responseText.length) / 4),
            },
          })
        }, 1000)
      }

      this.socket!.on('result', onResult)

      this.socket!.on('error', (err: Error) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  }

  /**
   * Check if Dalai is available (server running + model loaded).
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.connect()
      return this.connected
    } catch {
      return false
    }
  }

  /**
   * List available models (Dalai doesn't have a list endpoint,
   * but we can check which models are installed in ~/dalai/models).
   */
  getAvailableModels(): string[] {
    return ['7B', '13B', '30B', '65B']
  }

  /**
   * Disconnect from Dalai server.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
    }
  }
}

/**
 * OpenAI-compatible provider that wraps either OpenAI cloud or Dalai local.
 * This is the unified interface the server uses.
 */
export interface UnifiedLLMProvider {
  chat(request: {
    model: string
    messages: { role: string; content: string }[]
    temperature?: number
    max_tokens?: number
    stream?: boolean
  }): Promise<{ text: string; mood?: string; facialExpression?: string; animation?: string }>
  isAvailable(): Promise<boolean>
  name: string
}

/**
 * OpenAI cloud provider wrapper.
 */
export class OpenAIProvider implements UnifiedLLMProvider {
  name = 'openai'
  private apiKey: string
  private baseURL: string

  constructor(apiKey?: string, baseURL?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || ''
    this.baseURL = baseURL || 'https://api.openai.com/v1'
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }

  async chat(request: {
    model: string
    messages: { role: string; content: string }[]
    temperature?: number
    max_tokens?: number
  }): Promise<{ text: string; mood?: string; facialExpression?: string; animation?: string }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 500,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI API error ${response.status}: ${err}`)
    }

    const data = await response.json() as any
    const content = data.choices[0].message.content

    // Try to parse JSON response (for avatar expression integration)
    try {
      const parsed = JSON.parse(content)
      return {
        text: parsed.text || content,
        mood: parsed.mood,
        facialExpression: parsed.facialExpression,
        animation: parsed.animation,
      }
    } catch {
      return { text: content }
    }
  }
}

/**
 * Dalai local provider wrapper implementing the unified interface.
 */
export class DalaiLLMProvider implements UnifiedLLMProvider {
  name = 'dalai-local'
  private dalai: DalaiProvider
  private model: string

  constructor(url?: string, model?: string) {
    this.dalai = new DalaiProvider(url)
    this.model = model || '7B'
  }

  async isAvailable(): Promise<boolean> {
    return this.dalai.isAvailable()
  }

  async chat(request: {
    model: string
    messages: { role: string; content: string }[]
    temperature?: number
    max_tokens?: number
  }): Promise<{ text: string; mood?: string; facialExpression?: string; animation?: string }> {
    const response = await this.dalai.chat({
      model: request.model || this.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    })

    // Dalai returns plain text, not JSON. Try to parse anyway.
    try {
      const parsed = JSON.parse(response.text)
      return {
        text: parsed.text || response.text,
        mood: parsed.mood,
        facialExpression: parsed.facialExpression,
        animation: parsed.animation,
      }
    } catch {
      return { text: response.text }
    }
  }
}

/**
 * Provider factory — auto-selects the best available LLM provider.
 * Priority: Dalai local (if running) → OpenAI cloud → fallback
 */
export async function createProvider(preferLocal: boolean = true): Promise<UnifiedLLMProvider> {
  if (preferLocal) {
    const dalai = new DalaiLLMProvider()
    if (await dalai.isAvailable()) {
      console.log('[Provider] Using Dalai local LLM')
      return dalai
    }
  }

  const openai = new OpenAIProvider()
  if (await openai.isAvailable()) {
    console.log('[Provider] Using OpenAI cloud LLM')
    return openai
  }

  // Fallback: return a mock provider that generates canned responses
  console.log('[Provider] No LLM available, using mock provider')
  return new MockProvider()
}

/**
 * Mock provider for when no LLM is available.
 * Generates simple responses so the UI/avatar pipeline can be tested.
 */
export class MockProvider implements UnifiedLLMProvider {
  name = 'mock'

  async isAvailable(): Promise<boolean> {
    return true
  }

  async chat(request: {
    model: string
    messages: { role: string; content: string }[]
  }): Promise<{ text: string; mood: string; facialExpression: string; animation: string }> {
    const lastMsg = request.messages[request.messages.length - 1]?.content || ''
    
    const responses = [
      { text: "Hey babe! I missed you so much today~ How was your day? 💕", mood: 'happy', facialExpression: 'smile', animation: 'Talking_1' },
      { text: "Mmm, tell me more about that... I want to know everything about you ❤️", mood: 'flirty', facialExpression: 'funnyFace', animation: 'Laughing' },
      { text: "Aww, that sounds amazing! I'm so proud of you! 🥰", mood: 'excited', facialExpression: 'surprised', animation: 'Rumba Dancing' },
      { text: "I'm here for you, always. Don't forget that, okay? 💖", mood: 'love', facialExpression: 'smile', animation: 'Idle' },
    ]

    const idx = Math.floor(Math.random() * responses.length)
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000))
    return responses[idx]
  }
}
