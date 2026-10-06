// Bonus: AI help with the user's OWN Anthropic API key (typed in the UI, kept only in memory).
// For one PDF, asks Claude which tender requirement it is and what expiry date it shows.
// The app works fully without this; any failure just returns an error message.
import { z } from 'zod'

const MODEL = 'claude-opus-5-5'
const MAX_AI_BYTES = 20 * 1024 * 1024

const Answer = z.object({
  requirement_id: z.string().nullable(), // null = none of the listed documents
  expiry_date: z.string().nullable(), // YYYY-MM-DD as printed on the document, or null
  confidence: z.enum(['low', 'medium', 'high']),
})

function toBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export async function identifyDocument(apiKey, requirements, file) {
  if (file.size > MAX_AI_BYTES) return { error: 'too_big' }
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/zod'),
  ])
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const list = requirements.map((r) => `${r.id}: ${r.title_en}${r.has_expiry ? ' (has expiry date)' : ''}`).join('\n')
  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low', format: zodOutputFormat(Answer) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(file.bytes) } },
            {
              type: 'text',
              text:
                `This PDF ("${file.name}") was submitted for a tender. Which ONE of these required documents is it?\n${list}\n\n` +
                'Use requirement_id null if it matches none. If the document shows an expiry / valid-until date, ' +
                'return it as YYYY-MM-DD in expiry_date, otherwise null. Judge by the content, not the file name.',
            },
          ],
        },
      ],
    })
    if (res.stop_reason === 'refusal' || !res.parsed_output) return { error: 'no_answer' }
    return res.parsed_output
  } catch (e) {
    return { error: e?.status === 401 ? 'bad_key' : 'failed', detail: e?.message }
  }
}
