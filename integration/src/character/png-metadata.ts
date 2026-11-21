/**
 * PNG character-card metadata extraction — the import direction of Phase 1.
 *
 * Zero-dependency counterpart of the meta-png path used by AIRI's
 * packages/ccc codec. Reads tEXt, zTXt (deflate-compressed), and iTXt
 * (UTF-8, optional deflate) chunks, prefers the CCv3 keyword, and decodes
 * the Base64 JSON that SillyTavern-compatible writers embed.
 */

import { Buffer } from 'node:buffer'
import { inflateSync } from 'node:zlib'

export interface PNGTextMetadata {
  /** Chunk keyword, for example `ccv3` or `chara`. */
  keyword: string
  /** Chunk text value, Base64 encoded for character card chunks. */
  text: string
  /** Which PNG chunk kind supplied this entry. */
  chunk: 'tEXt' | 'zTXt' | 'iTXt'
}

export interface ExtractedCharacterCard {
  /** Keyword that carried the card data. */
  keyword: 'ccv3' | 'chara'
  /** Envelope detected inside the decoded JSON. */
  spec: 'chara_card_v1' | 'chara_card_v2' | 'chara_card_v3' | 'unknown'
  /** Parsed envelope object. Validate and convert upstream (card-parser). */
  data: unknown
  /** Decoded JSON text. */
  raw: string
}

const PNG_SIGNATURE = '89504e470d0a1a0a'
const CARD_KEYWORDS = ['ccv3', 'chara'] as const

/**
 * Reads every text metadata chunk from a PNG buffer.
 *
 * Handles tEXt (Latin-1), zTXt (deflate), and iTXt (UTF-8, optional
 * deflate). Throws on a non-PNG buffer or a truncated chunk list.
 */
export function extractPNGMetadata(png: Uint8Array): PNGTextMetadata[] {
  const buffer = Buffer.from(png.buffer, png.byteOffset, png.byteLength)
  if (buffer.subarray(0, 8).toString('hex') !== PNG_SIGNATURE)
    throw new Error('Not a valid PNG file')

  const entries: PNGTextMetadata[] = []
  let offset = 8
  let lastType = ''

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    lastType = buffer.subarray(offset + 4, offset + 8).toString('latin1')
    if (offset + 12 + length > buffer.length)
      throw new Error(`PNG chunk ${lastType} overruns the file`)

    const data = buffer.subarray(offset + 8, offset + 8 + length)
    const entry = readChunk(lastType, data)
    if (entry)
      entries.push(entry)

    offset += 12 + length
    if (lastType === 'IEND')
      break
  }

  if (offset !== buffer.length && lastType !== 'IEND')
    throw new Error('PNG chunk list ends mid-header')

  return entries
}

/**
 * Extracts a character card from PNG metadata.
 *
 * The CCv3 keyword takes precedence over the V2 keyword. Throws when the
 * PNG holds no card chunk, the value is not valid Base64, or it is not
 * valid JSON.
 */
export function readCharacterCardFromPNG(png: Uint8Array): ExtractedCharacterCard {
  const metadata = extractPNGMetadata(png)

  for (const keyword of CARD_KEYWORDS) {
    const entry = metadata.find(m => m.keyword.toLowerCase() === keyword)
    if (!entry)
      continue

    const raw = decodeBase64ToText(entry.text)
    const data = parseCardJSON(raw)
    return { keyword, spec: detectSpec(data), data, raw }
  }

  throw new Error('No character card data found in PNG metadata')
}

function readChunk(type: string, data: Buffer): PNGTextMetadata | undefined {
  if (type === 'tEXt')
    return readLatin1Chunk(data, 'tEXt')

  if (type === 'zTXt')
    return readCompressedChunk(data)

  if (type === 'iTXt')
    return readInternationalChunk(data)

  return undefined
}

function readLatin1Chunk(data: Buffer, chunk: PNGTextMetadata['chunk']): PNGTextMetadata | undefined {
  const separator = data.indexOf(0)
  if (separator <= 0)
    return undefined

  return {
    keyword: data.subarray(0, separator).toString('latin1'),
    text: data.subarray(separator + 1).toString('latin1'),
    chunk,
  }
}

function readCompressedChunk(data: Buffer): PNGTextMetadata | undefined {
  const separator = data.indexOf(0)
  if (separator <= 0)
    return undefined

  const method = data[separator + 1]
  if (method !== 0)
    throw new Error(`Unsupported zTXt compression method ${method}`)

  const text = inflateSync(data.subarray(separator + 2)).toString('latin1')
  return { keyword: data.subarray(0, separator).toString('latin1'), text, chunk: 'zTXt' }
}

function readInternationalChunk(data: Buffer): PNGTextMetadata | undefined {
  const separator = data.indexOf(0)
  if (separator <= 0)
    return undefined

  const keyword = data.subarray(0, separator).toString('latin1')
  let offset = separator + 1
  const compressionFlag = data[offset]
  const compressionMethod = data[offset + 1]
  offset += 2
  for (let i = 0; i < 2; i++) {
    const end = data.indexOf(0, offset)
    if (end < 0)
      return undefined
    offset = end + 1
  }

  const textSource = data.subarray(offset)
  let text: string
  if (compressionFlag === 1) {
    if (compressionMethod !== 0)
      throw new Error(`Unsupported iTXt compression method ${compressionMethod}`)
    text = inflateSync(textSource).toString('utf8')
  }
  else {
    text = textSource.toString('utf8')
  }

  return { keyword, text, chunk: 'iTXt' }
}

function decodeBase64ToText(value: string): string {
  const decoded = Buffer.from(value, 'base64').toString('utf8')
  if (!decoded)
    throw new Error('Card metadata holds no decodable Base64 data')
  return decoded
}

function parseCardJSON(raw: string): unknown {
  try {
    return JSON.parse(raw)
  }
  catch (cause) {
    throw new Error(`Card metadata holds invalid JSON: ${String(cause)}`)
  }
}

function detectSpec(data: unknown): ExtractedCharacterCard['spec'] {
  if (typeof data !== 'object' || data === null)
    return 'unknown'
  const spec = (data as { spec?: unknown }).spec
  if (spec === 'chara_card_v2')
    return 'chara_card_v2'
  if (spec === 'chara_card_v3')
    return 'chara_card_v3'
  if (spec === undefined)
    return 'chara_card_v1'
  return 'unknown'
}
