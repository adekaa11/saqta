// Движок анализа: общий для фронта (моки) и серверной функции /api. Без браузерных API.
import mocks from './mocks.json'

export const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 8)

// \w и \b в JS не понимают кириллицу — переводим правила на Unicode-классы
const uni = (re) => new RegExp(
  re.source
    .replace(/\\b/g, '(?:(?<![\\p{L}\\p{N}])|(?![\\p{L}\\p{N}]))')
    .replace(/\\w/g, '[\\p{L}\\p{N}_]'),
  'iu'
)

const RULES = [
  { type: 'sms_code', w: 35, re: /(sms|смс)[-\s]?код\w*(\s+айт\w*)?|код\w*\s+(из|с)\s+(sms|смс)|кодты\s+айт\w*/i },
  { type: 'wrong_transfer', w: 50, re: /(ошибочно|по\s+ошибке|случайно)\s+(\S+\s+){0,2}(перев[её]л\w*|отправил\w*|скинул\w*|кинул\w*)|(скинули|перевели|отправили|пришли|поступили)\s+(\S+\s+){0,2}деньги(?=[^.!?]{0,40}верни)|верни\w*\s+(\S+\s+){0,2}(деньги|обратно)|қателесіп\s+(\S+\s+)?аудар\S*|ақшаны\s+қайтар\S*|қайтарып\s+бер\S*/i },
  { type: 'safe_account', w: 35, re: /безопасн\w*\s+сч[её]т\w*|резервн\w*\s+сч[её]т\w*|қауіпсіз\s+шот\w*/i },
  { type: 'remote_access', w: 30, re: /anydesk|rustdesk|демонстрац\w*\s+экран\w*|скачайте\s+приложени\w*/i },
  { type: 'authority', w: 20, re: /(служб\w*\s+безопасност\w*[^.,!?]{0,20}|(позвонил\w*|звонят|звонок)\s+(из|от)\s+\S+|(kaspi|halyk|freedom|jusan|forte)\S*\s+банк\S*\s+\S*(шалды|қызмет\S*)|қауіпсіздік\s+қызмет\S*|1414|egov|цон|аррфр|полици\w*)/i },
  { type: 'payment_request', w: 20, re: /перевед\w*\s+\S+|переведите|аударыңыз|оплатите\s+\S+|получите\s+деньги(\s+по\s+ссылке)?|скинь\w*\s+(\S+\s+){0,2}(деньги|ақша\S*)|отправьте\s+деньги|на\s+(этот|мой|данный)\s+номер|верните|вернуть\s+(\S+\s+)?деньги|қайтарыңыз\S*|қайтарып\s+жіберіңіз/i },
  { type: 'personal_data', w: 20, re: /\bиин\b|\bжсн\b|номер\s+карты|данн\w*\s+(\S+\s+)?карт\w*|введите\s+(\S+\s+)?(данные|номер|пароль|код)|cvv|срок\s+действия|карта\s+деректер\S*/i },
  { type: 'urgency', w: 15, re: /срочно|немедленно|заблокир\w*|пытаются\s+списать\s+\S+|подозрительн\w*\s+\S+|күдікті\s+\S+(\s+\S+)?|бұғатта\w*|шұғыл|иначе\s+[^.,!?]+|әйтпесе\s+[^.,!?]+/i },
  { type: 'link', w: 15, re: /https?:\/\/\S+|bit\.ly\/\S+|за\S{0,2}дите\s+на\s+(этот\s+|наш\s+)?сайт|перейдите\s+по\s+ссылке|(скину|отправлю|пришлю|скинул|отправил)\s+(вам\s+)?ссылк\w*|сілтеме\S*\s+(\S+\s+)?(өтіңіз|басыңыз)/i },
  { type: 'too_good', w: 30, re: /разда\w*\s+(\S+\s+)?деньги|бесплатн\w*\s+деньги|компенсаци\w*|ақша\s+тарат\S*|тегін\s+ақша/i },
  { type: 'too_good', w: 15, re: /выигрыш\w*|доход\s+от|инвестиру\w*|ұтыс\w*|табыс\w*/i },
  // Живая речь: браузер пишет «эсэмэс», «каспи», «код» без «SMS» — ловим разговорные формы
  { type: 'sms_code', w: 35, re: /(назва\w*|назови\w*|сказа\w*|скажи\w*|продикт\w*|сообщ\w*|напиш\w*|написа\w*|скин\w*|отправ\w*|пришл\w*|айт\w*|жаз\w*|жібер\w*)\s+(\S+\s+){0,2}код\w*|код\w*\s+(\S+\s+){0,2}(назва\w*|назови\w*|сказа\w*|скажи\w*|напиш\w*|айт\w*|жаз\w*|жібер\w*)|эсэмэс|смс-?\s*код/i },
  { type: 'authority', w: 20, re: /(позвонил\w*|звонил\w*|қоңырау\s+шалды)\s+(\S+\s+){0,2}(каспи|kaspi|халык|halyk|банк\w*|полици\w*)|из\s+(каспи|халык|банка)|(каспи|халык)\S*\s+банк\S*/i },
  { type: 'authority', w: 20, re: /\S*(банк|bank)\S*\s+(\S+\s+){0,2}(қоңырау\s+шал\S*|хабарлас\S*)|полиция\S*\s+(\S+\s+){0,2}(қоңырау\s+шал\S*|хабарлас\S*)/i },
  { type: 'urgency', w: 15, re: /сейчас\s+же|прямо\s+сейчас|списа\w*|пропад\w*|сгор\w*|украд\w*|жоғал\w*/i }
].map((r) => ({ ...r, re: uni(r.re) }))

const FLAG_TEXT = {
  wrong_transfer: ['«Ошибочный перевод» — известная схема: деньги могли прийти с украденной карты или не прийти вовсе. Ничего не возвращайте на номер — проверьте баланс в приложении банка и позвоните в банк.', '«Қате аударым» — белгілі схема: ақша ұрланған картадан келуі не мүлде келмеуі мүмкін. Нөмірге ештеңе қайтармаңыз — банк қосымшасынан балансты тексеріп, банкке қоңырау шалыңыз.'],
  sms_code: ['Код из SMS никогда и никому нельзя называть, даже «банку».', 'SMS-кодты ешкімге, тіпті «банкке» де айтуға болмайды.'],
  safe_account: ['«Безопасных счетов» не существует. Это счёт мошенника.', '«Қауіпсіз шот» деген болмайды. Бұл алаяқтың шоты.'],
  remote_access: ['Программа удалённого доступа отдаёт мошеннику ваш телефон.', 'Қашықтан басқару бағдарламасы телефоныңызды алаяққа береді.'],
  authority: ['Мошенники представляются банком или госорганом. Настоящий банк не просит коды и переводы.', 'Алаяқтар банк немесе мемлекеттік орган болып таныстырады. Нақты банк код пен аударым сұрамайды.'],
  payment_request: ['Просят перевести деньги — остановитесь.', 'Ақша аударуды сұрайды — тоқтаңыз.'],
  personal_data: ['Просят личные данные — никому их не сообщайте.', 'Жеке деректерді сұрайды — ешкімге айтпаңыз.'],
  urgency: ['Создают панику, чтобы вы не успели подумать.', 'Ойлануға уақыт бермеу үшін үрей тудырады.'],
  link: ['Неизвестная ссылка может украсть данные карты.', 'Белгісіз сілтеме карта деректерін ұрлауы мүмкін.'],
  too_good: ['Слишком выгодное предложение — типичная приманка.', 'Тым тиімді ұсыныс — әдеттегі алдау.']
}

export const SCHEMES = {
  fake_gov: { code: 'fake_gov', title_ru: 'Лжегосорган (1414, eGov, полиция)', title_kk: 'Жалған мемлекеттік орган' },
  relative: { code: 'relative', title_ru: '«Родственник в беде»', title_kk: '«Туысың қиналып жатыр»' },
  prize: { code: 'prize', title_ru: 'Выигрыш или «раздача денег»', title_kk: 'Ұтыс не «тегін ақша»' },
  other: { code: 'other', title_ru: 'Другая схема обмана', title_kk: 'Басқа алдау схемасы' },
  safe_account: { code: 'safe_account', title_ru: '«Безопасный счёт»', title_kk: '«Қауіпсіз шот»' },
  wrong_transfer: { code: 'wrong_transfer', title_ru: '«Ошибочный перевод»', title_kk: '«Қате аударым»' },
  fake_bank: { code: 'fake_bank', title_ru: 'Лжесотрудник банка', title_kk: 'Жалған банк қызметкері' },
  marketplace: { code: 'marketplace', title_ru: 'Фишинговая ссылка', title_kk: 'Фишинг сілтеме' },
  investment: { code: 'investment', title_ru: 'Фейковые инвестиции', title_kk: 'Жалған инвестиция' },
  none: { code: 'none', title_ru: 'Признаков мошенничества нет', title_kk: 'Алаяқтық белгілері жоқ' }
}

export function ruleAnalyze(text) {
  const flags = []
  let score = 0
  for (const r of RULES) {
    if (flags.some((f) => f.type === r.type)) continue // один тип — одна улика
    const m = text.match(r.re)
    const hit = m ? m[0].trim().replace(/[.,!?;:]+$/, '') : ''
    if (hit.length > 1) {
      score += r.w
      const [ru, kk] = FLAG_TEXT[r.type]
      flags.push({ text: hit, type: r.type, explanation_ru: ru, explanation_kk: kk })
    }
  }
  // Классическая связка: представились банком/госорганом или торопят — И просят код, перевод или данные
  const asks = ['sms_code', 'safe_account', 'remote_access', 'payment_request', 'personal_data']
  if (flags.some((f) => f.type === 'authority' || f.type === 'urgency') &&flags.some((f) => asks.includes(f.type))) score += 20
  // Приманка + ссылка («раздают деньги, зайдите на сайт») — классический фишинг
  if (flags.some((f) => f.type === 'link') && flags.some((f) => f.type === 'too_good')) score += 25
  score = Math.min(97, score) // 100% уверенности правила не дают
  if (!flags.length) score = 6
  else if (score < 40) score = 40 + Math.min(19, score / 2) // есть улика — минимум «күдікті»
  score = Math.round(score)
  const verdict = score >= 70 ? 'scam' : score >= 40 ? 'suspicious' : 'safe'
  const types = new Set(flags.map((f) => f.type))
  const scheme = types.has('safe_account') ? SCHEMES.safe_account
    : types.has('wrong_transfer') ? SCHEMES.wrong_transfer
    : types.has('sms_code') || types.has('authority') ? SCHEMES.fake_bank
      : types.has('link') ? SCHEMES.marketplace
        : types.has('too_good') ? SCHEMES.investment
          : SCHEMES.none
  const kk = /[әғқңөұүһі]/i.test(text)
  return {
    id: uid('chk'), risk_score: score, verdict, detected_lang: kk ? 'kk' : 'ru', scheme, red_flags: flags,
    summary_ru: verdict === 'safe' ? 'Явных признаков мошенничества не найдено.' : verdict === 'scam' ? 'Это почти наверняка мошенники.' : 'Есть подозрительные признаки. Будьте осторожны.',
    summary_kk: verdict === 'safe' ? 'Алаяқтықтың анық белгілері табылмады.' : verdict === 'scam' ? 'Бұл алаяқтар болуы әбден мүмкін.' : 'Күдікті белгілер бар. Абай болыңыз.',
    advice_ru: verdict === 'safe' ? ['Если всё же просят код, перевод или личные данные — ничего не делайте и позвоните близким'] : ['Ничего не переводите и не называйте коды', 'Позвоните в банк сами по номеру с карты', 'Расскажите близким'],
    advice_kk: verdict === 'safe' ? ['Бәрібір код, ақша не жеке дерек сұраса — ештеңе істемей, жақындарыңызға хабарласыңыз'] : ['Ештеңе аудармаңыз, код айтпаңыз', 'Банкке картадағы нөмір арқылы өзіңіз қоңырау шалыңыз', 'Жақындарыңызға айтыңыз'],
    family_alert_sent: false, engine: 'rules', created_at: new Date().toISOString()
  }
}

// Любой текст, включая примеры на сайте, проходит через одни и те же правила — без заготовленных ответов
export function analyzeText(text) {
  return ruleAnalyze(text.trim())
}

export function makeCheckAlert(res, text, member_name) {
  return {
    id: uid('alr'), type: 'check', check_id: res.id, member_name,
    risk_score: res.risk_score, verdict: res.verdict, scheme: res.scheme,
    text_preview: text.length > 60 ? text.slice(0, 60) + '…' : text, status: 'new', created_at: new Date().toISOString()
  }
}

export function makeSosAlert(member_name, note) {
  return {
    id: uid('alr'), type: 'sos', check_id: null, member_name, risk_score: null, verdict: null, scheme: null,
    text_preview: note ? 'SOS: ' + note : 'SOS', status: 'new', created_at: new Date().toISOString()
  }
}

export const seedAlerts = () => structuredClone(mocks.family_alerts.alerts)
export const familyInfo = () => ({ family_id: mocks.family_alerts.family_id, members: mocks.family_alerts.members })
export { mocks }
