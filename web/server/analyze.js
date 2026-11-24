// Серверный анализ: языковая модель читает текст по смыслу, правила — страховка.
// - Нет ключа / Groq недоступен → ответ только по правилам (engine: 'rules').
// - Модель решает итоговый риск, НО «жёсткие» признаки из правил (код из SMS, безопасный счёт,
//   удалённый доступ, «ошибочный перевод») не дают опустить риск ниже оценки правил.
import { ruleAnalyze, SCHEMES } from '../src/engine.js'
import { llmAnalyze, LLM_FLAG_TYPES } from './llm.js'

const HARD = new Set(['sms_code', 'safe_account', 'remote_access', 'wrong_transfer'])
const verdictOf = (s) => (s >= 70 ? 'scam' : s >= 40 ? 'suspicious' : 'safe')
const strList = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).slice(0, 3) : [])

function locate(text, quote) {
  if (typeof quote !== 'string') return null
  const q = quote.trim().replace(/^[«"']+|[»"'.,!?]+$/g, '')
  if (q.length < 2) return null
  let at = text.indexOf(q)
  if (at < 0) at = text.toLowerCase().indexOf(q.toLowerCase())
  return at < 0 ? null : { at, end: at + q.length, text: text.slice(at, at + q.length) }
}

export async function analyze(text) {
  const rules = ruleAnalyze(text)
  const llm = await llmAnalyze(text)
  if (!llm || typeof llm.risk_score !== 'number') return rules

  // Улики модели: только дословные цитаты, которые реально есть в тексте
  const taken = []
  const flags = []
  for (const f of Array.isArray(llm.red_flags) ? llm.red_flags : []) {
    const loc = locate(text, f?.quote)
    if (!loc || taken.some((t) => loc.at < t.end && loc.end > t.at)) continue
    taken.push(loc)
    flags.push({
      text: loc.text,
      type: LLM_FLAG_TYPES.includes(f.type) ? f.type : 'other',
      explanation_ru: String(f.explanation_ru || ''),
      explanation_kk: String(f.explanation_kk || f.explanation_ru || '')
    })
  }

  let score = Math.max(0, Math.min(97, Math.round(llm.risk_score)))
  const hardRule = rules.red_flags.some((f) => HARD.has(f.type))
  const raisedByRules = hardRule && rules.risk_score > score
  if (raisedByRules) score = rules.risk_score

  // Добавляем улики правил, которых модель не назвала (без наложений)
  if (score >= 40) {
    for (const f of rules.red_flags) {
      const loc = locate(text, f.text)
      if (!loc || taken.some((t) => loc.at < t.end && loc.end > t.at) || flags.some((x) => x.type === f.type)) continue
      taken.push(loc)
      flags.push(f)
    }
  }

  const verdict = verdictOf(score)
  const useRulesText = raisedByRules || verdict !== verdictOf(llm.risk_score)
  const scheme = verdict === 'safe' ? SCHEMES.none
    : SCHEMES[llm.scheme] && llm.scheme !== 'none' ? SCHEMES[llm.scheme]
      : rules.scheme.code !== 'none' ? rules.scheme : SCHEMES.other
  const pick = (k) => (useRulesText ? rules[k] : String(llm[k] || rules[k]))
  const pickList = (k) => (useRulesText ? rules[k] : strList(llm[k]).length ? strList(llm[k]) : rules[k])

  return {
    ...rules,
    risk_score: score,
    verdict,
    scheme,
    red_flags: verdict === 'safe' ? [] : flags.slice(0, 5),
    summary_ru: pick('summary_ru'),
    summary_kk: pick('summary_kk'),
    advice_ru: pickList('advice_ru'),
    advice_kk: pickList('advice_kk'),
    engine: raisedByRules ? 'llm+rules' : 'llm'
  }
}
