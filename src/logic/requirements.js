// Parse + validate requirements.json. Returns { tender, requirements } or { errors: [string] }.
// Errors are short English/technical details; the UI wraps them in a translated heading.

const TENDER_FIELDS = ['tender_id', 'title', 'procuring_entity', 'bidder', 'submission_deadline']

export function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !isNaN(d) && d.toISOString().slice(0, 10) === s
}

export function parseRequirements(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { errors: ['Invalid JSON: ' + e.message] }
  }
  const errors = []
  const tender = data?.tender
  if (!tender || typeof tender !== 'object') errors.push('"tender" object is missing')
  else {
    for (const f of TENDER_FIELDS) {
      if (typeof tender[f] !== 'string' || !tender[f].trim()) errors.push(`tender.${f} is missing or empty`)
    }
    if (typeof tender.submission_deadline === 'string' && tender.submission_deadline && !isIsoDate(tender.submission_deadline))
      errors.push('tender.submission_deadline must be a real date in YYYY-MM-DD format')
  }
  const reqs = data?.requirements
  if (!Array.isArray(reqs) || reqs.length === 0) errors.push('"requirements" must be a non-empty list')
  else {
    const ids = new Set()
    reqs.forEach((r, i) => {
      const at = `requirements[${i}]`
      if (!r || typeof r !== 'object') return errors.push(`${at} is not an object`)
      if (typeof r.id !== 'string' || !r.id) errors.push(`${at}.id is missing`)
      else if (ids.has(r.id)) errors.push(`${at}.id "${r.id}" is duplicated`)
      else ids.add(r.id)
      if (typeof r.order !== 'number' || !isFinite(r.order)) errors.push(`${at}.order must be a number`)
      if (typeof r.title_en !== 'string' || !r.title_en.trim()) errors.push(`${at}.title_en is missing`)
      if (typeof r.title_bn !== 'string' || !r.title_bn.trim()) errors.push(`${at}.title_bn is missing`)
      if (typeof r.mandatory !== 'boolean') errors.push(`${at}.mandatory must be true or false`)
      if (typeof r.has_expiry !== 'boolean') errors.push(`${at}.has_expiry must be true or false`)
    })
  }
  if (errors.length) return { errors }
  // Sort by order; ties broken by id so the result is deterministic.
  const requirements = [...reqs].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return { tender: { ...tender }, requirements }
}
