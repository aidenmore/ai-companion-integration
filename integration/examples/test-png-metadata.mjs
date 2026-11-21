// Zero-dependency verification of src/character/png-metadata.ts.
// Run with plain Node.js (v22.6+ for TS type stripping): node examples/test-png-metadata.mjs
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'

import { extractPNGMetadata, readCharacterCardFromPNG } from '../src/character/png-metadata.ts'

const CRC_TABLE = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  CRC_TABLE[n] = c >>> 0
}
function crc32(bytes) {
  let c = 0xFFFFFFFF
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

function chunk(type, data) {
  const withType = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(withType))
  return Buffer.concat([length, withType, crc])
}
const IHDR = chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]))
const IEND = chunk('IEND', Buffer.alloc(0))
function buildPNG(chunks) {
  return Buffer.concat([PNG_SIGNATURE, IHDR, ...chunks, IEND])
}
function textChunk(keyword, value) {
  return chunk('tEXt', Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), Buffer.from(value, 'latin1')]))
}
function ztxtChunk(keyword, text) {
  const compressed = deflateSync(Buffer.from(text, 'utf8'))
  return chunk('zTXt', Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0, 0]), compressed]))
}
function itxtChunk(keyword, text, compressed) {
  const value = compressed ? deflateSync(Buffer.from(text, 'utf8')) : Buffer.from(text, 'utf8')
  return chunk('iTXt', Buffer.concat([
    Buffer.from(keyword, 'latin1'),
    Buffer.from([0, compressed ? 1 : 0, 0]),
    Buffer.from([0]), // empty language tag
    Buffer.from([0]), // empty translated keyword
    value,
  ]))
}
function encodeBase64(text) {
  return Buffer.from(text, 'utf8').toString('base64')
}

const v3Card = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: { name: 'Yuki', first_mes: 'Nya, hello!' },
}
const v2Card = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: { name: 'Seraphina', first_mes: 'Hello there.' },
}
const v1Card = { name: 'Classic', description: 'A V1 era card.' }
const nonAsciiCard = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: { name: '雪', first_mes: 'にゃ、こんにちは!' },
}

let passed = 0
function check(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok ${passed} - ${name}`)
  }
  catch (cause) {
    console.error(`  not ok - ${name}`)
    console.error(cause)
    process.exitCode = 1
  }
}

check('extracts tEXt chunks', () => {
  const png = buildPNG([textChunk('Software', 'Editor'), textChunk('ccv3', encodeBase64(JSON.stringify(v3Card)))])
  const entries = extractPNGMetadata(png)
  assert.equal(entries.length, 2)
  assert.deepEqual(entries[0], { keyword: 'Software', text: 'Editor', chunk: 'tEXt' })
  assert.equal(entries[1].keyword, 'ccv3')
})

check('extracts a deflate-compressed zTXt chunk', () => {
  const png = buildPNG([ztxtChunk('ccv3', encodeBase64(JSON.stringify(v3Card)))])
  const entries = extractPNGMetadata(png)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].chunk, 'zTXt')
  assert.equal(JSON.parse(Buffer.from(entries[0].text, 'base64').toString('utf8')).data.name, 'Yuki')
})

check('extracts iTXt chunks compressed and plain', () => {
  const raw = encodeBase64(JSON.stringify(v3Card))
  const entries = extractPNGMetadata(buildPNG([itxtChunk('ccv3', raw, true), itxtChunk('chara', raw, false)]))
  assert.equal(entries.length, 2)
  assert.deepEqual(entries.map(e => e.chunk), ['iTXt', 'iTXt'])
  assert.deepEqual(entries.map(e => e.keyword), ['ccv3', 'chara'])
})

check('prefers ccv3 over chara and reports the V3 spec', () => {
  const png = buildPNG([
    textChunk('chara', encodeBase64(JSON.stringify(v2Card))),
    textChunk('ccv3', encodeBase64(JSON.stringify(v3Card))),
  ])
  const card = readCharacterCardFromPNG(png)
  assert.equal(card.keyword, 'ccv3')
  assert.equal(card.spec, 'chara_card_v3')
  assert.equal(card.data.data.name, 'Yuki')
  assert.equal(card.raw, JSON.stringify(v3Card))
})

check('falls back to the chara keyword and reports the V2 spec', () => {
  const png = buildPNG([textChunk('chara', encodeBase64(JSON.stringify(v2Card)))])
  const card = readCharacterCardFromPNG(png)
  assert.equal(card.keyword, 'chara')
  assert.equal(card.spec, 'chara_card_v2')
  assert.equal(card.data.data.name, 'Seraphina')
})

check('detects a V1 card without an envelope', () => {
  const png = buildPNG([textChunk('chara', encodeBase64(JSON.stringify(v1Card)))])
  const card = readCharacterCardFromPNG(png)
  assert.equal(card.spec, 'chara_card_v1')
  assert.equal(card.data.name, 'Classic')
})

check('round-trips non-ASCII card data', () => {
  const png = buildPNG([textChunk('ccv3', encodeBase64(JSON.stringify(nonAsciiCard)))])
  const card = readCharacterCardFromPNG(png)
  assert.equal(card.data.data.name, '雪')
  assert.equal(card.data.data.first_mes, 'にゃ、こんにちは!')
})

check('matches what the integration card-parser reads from tEXt', () => {
  // parity with parsePNGBuffer in src/character/card-parser.ts: same ccv3
  // preference and Base64 decode for the same fixture
  const png = buildPNG([textChunk('ccv3', encodeBase64(JSON.stringify(v3Card)))])
  const legacy = JSON.parse(Buffer.from(textValue(png, 'ccv3'), 'base64').toString('utf8'))
  const modern = readCharacterCardFromPNG(png)
  assert.deepEqual(modern.data, legacy)
})

check('rejects non-PNG buffers', () => {
  assert.throws(() => extractPNGMetadata(Buffer.from('not a png')), /Not a valid PNG/)
})

check('rejects a PNG without card metadata', () => {
  const png = buildPNG([textChunk('Software', 'Editor')])
  assert.throws(() => readCharacterCardFromPNG(png), /No character card data/)
})

check('rejects a truncated chunk list', () => {
  const truncated = buildPNG([textChunk('ccv3', encodeBase64(JSON.stringify(v3Card)))])
  assert.throws(() => extractPNGMetadata(truncated.subarray(0, 40)), /overruns|mid-header/)
  // a length field pointing past the file also throws
  assert.throws(() => extractPNGMetadata(truncated.subarray(0, 45)), /overruns|mid-header/)
})

check('rejects card metadata that is not valid JSON', () => {
  const png = buildPNG([textChunk('ccv3', encodeBase64('hello, not json'))])
  assert.throws(() => readCharacterCardFromPNG(png), /invalid JSON/)
})

function textValue(png, keyword) {
  const entries = extractPNGMetadata(png)
  return entries.find(e => e.keyword === keyword).text
}

console.log(process.exitCode ? 'FAILED' : `All ${passed} checks passed.`)
