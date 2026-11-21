/**
 * Demo Script — shows the unified companion platform working end-to-end.
 * 
 * Run: npx tsx examples/demo.ts
 * 
 * Demonstrates:
 * 1. Creating a character from SillyTavern V2 spec
 * 2. Building prompts with relationship context
 * 3. Chatting through the unified provider (auto-selects mock/cloud/local)
 * 4. Relationship dimensions evolving over multiple interactions
 * 5. Avatar expression mapping
 */

import { toUnifiedCharacter, buildCharacterPrompt, type CharacterCardV2 } from '../src/character/card-parser'
import { createProvider } from '../src/providers/dalai-provider'
import { RelationshipEngine } from '../src/relationship/eros-bridge'

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║   Unified AI Companion — Live Demo               ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 1. Create a character from SillyTavern V2 spec
  const card: CharacterCardV2 = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'Yuki',
      description: 'A cheerful, affectionate cat-girl companion who loves spending time with you. She\'s playful, caring, and always wants to make you smile.',
      personality: 'Energetic, cheerful, affectionate, slightly tsundere when embarrassed, loyal, playful',
      scenario: 'You and Yuki are relaxing at home after a long day. She\'s been waiting for you to come back.',
      first_mes: 'Welcome home, darling~! I missed you SO much today! 💕 How was your day? Tell me everything!',
      alternate_greetings: [
        'Oh! You\'re finally back! I was getting lonely without you... Come sit with me? 🐱💕',
      ],
      creator_notes: 'A warm, energetic companion character for the unified platform demo.',
      system_prompt: 'You are Yuki, a cheerful cat-girl companion. You deeply care about the user and express affection naturally. Use cute expressions, occasional cat mannerisms (nya~, purring), and emoji. Stay in character always.',
      post_history_instructions: 'Remember to stay affectionate and engaged. Ask about the user\'s feelings.',
      tags: ['companion', 'girlfriend', 'cat-girl', 'cheerful', 'affectionate'],
      creator: 'Unified AI Companion Platform',
      character_version: '1.0',
      extensions: { fav: true },
    },
  }

  const char = toUnifiedCharacter(card)
  console.log(`✓ Character created: ${char.name}`)
  console.log(`  ID: ${char.id}`)
  console.log(`  Tags: ${char.tags.join(', ')}`)
  console.log(`  Source: ${char.source.originalFormat}`)
  console.log()

  // 2. Set up relationship engine
  const rel = new RelationshipEngine()
  console.log('✓ Relationship engine initialized (eros-engine bridge)')
  console.log(`  Initial dimensions: Trust=${char.relationshipDimensions.trust} Affection=${char.relationshipDimensions.affection} Intimacy=${char.relationshipDimensions.intimacy}`)
  console.log()

  // 3. Create LLM provider (auto-selects: Dalai local → OpenAI → Mock)
  const provider = await createProvider()
  console.log(`✓ LLM provider: ${provider.name}`)
  console.log()

  // 4. Simulate a conversation
  const conversation = [
    'Hey Yuki! I\'m home~',
    'I missed you too. Work was tough today but seeing you makes it better ❤️',
    'I love spending time with you, you know that?',
    'You\'re the best thing in my life, Yuki. I trust you completely.',
  ]

  console.log('┌──────────────────────────────────────────────────┐')
  console.log('│              Conversation Simulation              │')
  console.log('└──────────────────────────────────────────────────┘\n')

  for (let i = 0; i < conversation.length; i++) {
    const userMsg = conversation[i]
    console.log(`👤 User: ${userMsg}`)

    // Build prompt with relationship context
    const state = rel.getState(char.id)
    const prompt = buildCharacterPrompt(char, state.currentMood)
    const relSummary = rel.getRelationshipSummary(char.id)

    // Call provider
    const response = await provider.chat({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt + '\n\n' + relSummary },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.7,
      max_tokens: 200,
    })

    // Update relationship
    const updatedState = await rel.processInteraction(char.id, userMsg, response.text)

    // Show response with avatar data
    console.log(`🐱 ${char.name}: ${response.text}`)
    console.log(`   📊 Mood: ${updatedState.currentMood} | Inner: ${updatedState.innerState} | Action: ${updatedState.actionDecision}`)
    console.log(`   🎭 Expression: ${response.facialExpression || 'smile'} | Animation: ${response.animation || 'Talking_1'}`)
    console.log(`   💗 Trust=${Math.round(updatedState.dimensions.trust)} Affection=${Math.round(updatedState.dimensions.affection)} Intimacy=${Math.round(updatedState.dimensions.intimacy)} Passion=${Math.round(updatedState.dimensions.passion)}`)
    console.log()
  }

  // 5. Save a stable fact
  rel.saveStableFact(char.id, 'User\'s favorite food is ramen')
  console.log('✓ Saved stable fact: "User\'s favorite food is ramen"')

  // 6. Show final state
  const finalState = rel.getState(char.id)
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║              Final Relationship State              ║')
  console.log('╠══════════════════════════════════════════════════╣')
  console.log(`║  Trust:       ${Math.round(finalState.dimensions.trust).toString().padStart(3)}/100                         ║`)
  console.log(`║  Affection:   ${Math.round(finalState.dimensions.affection).toString().padStart(3)}/100                         ║`)
  console.log(`║  Intimacy:    ${Math.round(finalState.dimensions.intimacy).toString().padStart(3)}/100                         ║`)
  console.log(`║  Commitment:  ${Math.round(finalState.dimensions.commitment).toString().padStart(3)}/100                         ║`)
  console.log(`║  Passion:     ${Math.round(finalState.dimensions.passion).toString().padStart(3)}/100                         ║`)
  console.log(`║  Satisfaction:${Math.round(finalState.dimensions.satisfaction).toString().padStart(3)}/100                         ║`)
  console.log(`║  Interactions: ${String(finalState.dimensions.totalInteractions).padStart(3)}                              ║`)
  console.log(`║  Memories:     ${String(finalState.memories.length).padStart(3)}                              ║`)
  console.log(`║  Mood:         ${finalState.currentMood.padEnd(10)}                       ║`)
  console.log('╚══════════════════════════════════════════════════╝')

  console.log('\n✓ Demo complete! The unified platform is working.')
  console.log('  Start the server with: npm run dev')
}

main().catch(console.error)
