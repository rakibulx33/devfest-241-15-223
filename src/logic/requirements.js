// Parse + validate requirements.json. Returns { tender, requirements } or { errors: [{ code, ...vars }] }.
// Each error code has an English and Bangla message in i18n.js (key 'rq_<code>').

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
    return { errors: [{ code: 'bad_json' }] }
  }
  const errors = []
  const tender = data?.tender
  if (!tender || typeof tender !== 'object') errors.push({ code: 'no_tender' })
  else {
    for (const f of TENDER_FIELDS) {
      if (typeof tender[f] !== 'string' || !tender[f].trim()) errors.push({ code: 'tender_field', field: `tender.${f}` })
    }
    if (typeof tender.submission_deadline === 'string' && tender.submission_deadline && !isIsoDate(tender.submission_deadline))
      errors.push({ code: 'bad_deadline', field: 'tender.submission_deadline' })
  }
  const reqs = data?.requirements
  if (!Array.isArray(reqs) || reqs.length === 0) errors.push({ code: 'no_reqs', field: 'requirements' })
  else {
    const ids = new Set()
    reqs.forEach((r, i) => {
      const at = `requirements[${i}]`
      if (!r || typeof r !== 'object') return errors.push({ code: 'not_object', field: at })
      if (typeof r.id !== 'string' || !r.id) errors.push({ code: 'missing', field: `${at}.id` })
      else if (ids.has(r.id)) errors.push({ code: 'dup_id', field: `${at}.id`, id: r.id })
      else ids.add(r.id)
      if (typeof r.order !== 'number' || !isFinite(r.order)) errors.push({ code: 'not_number', field: `${at}.order` })
      if (typeof r.title_en !== 'string' || !r.title_en.trim()) errors.push({ code: 'missing', field: `${at}.title_en` })
      if (typeof r.title_bn !== 'string' || !r.title_bn.trim()) errors.push({ code: 'missing', field: `${at}.title_bn` })
      if (typeof r.mandatory !== 'boolean') errors.push({ code: 'not_bool', field: `${at}.mandatory` })
      if (typeof r.has_expiry !== 'boolean') errors.push({ code: 'not_bool', field: `${at}.has_expiry` })
    })
  }
  if (errors.length) return { errors }
  // Sort by order; ties broken by id so the result is deterministic.
  const requirements = [...reqs].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return { tender: { ...tender }, requirements }
}
