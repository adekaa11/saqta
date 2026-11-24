import { createContext, useContext } from 'react'

export const STR = {
  kk: {
    tabCheck: 'Тексеру', tabFamily: 'Отбасы',
    hello: 'Сәлем, Гүлнар апа',
    lead: 'Біреу қоңырау шалып, ақша немесе код сұрады ма? Saqta 3 секундта тексереді.',
    micIdle: 'Айтып беру', micSub: 'Телефонда не айтқанын айтып беріңіз',
    micListening: 'Тыңдап тұрмын…', micStop: 'Аяқтау',
    or: 'немесе хабарламаны осында қойыңыз',
    placeholder: 'SMS немесе WhatsApp хабарламасының мәтіні…',
    examples: 'Мысалдар:',
    exampleLabels: { scam_kk: 'Жалған банк', scam_ru: 'Қауіпсіз шот', suspicious: 'OLX төлемі', safe: 'Ұлынан хабар' },
    liveNote: 'Тікелей: әр 3 секунд сайын жаңарады',
    micErr: {
      unsupported: 'Бұл браузер дауысты тани алмайды. Chrome-да ашыңыз немесе мәтінді төменге жазыңыз.',
      denied: 'Микрофонға рұқсат жоқ. Браузерде микрофонға рұқсат беріп, қайта басыңыз.',
      nospeech: 'Дауыс естілмеді. Батырманы басып, телефонға жақынырақ сөйлеңіз.',
      network: 'Дауысты тану үшін интернет керек. Байланысты тексеріп, қайталаңыз.',
      failed: 'Дауысты тану сәтсіз болды. Қайталаңыз немесе мәтінді төменге жазыңыз.'
    },
    themeDark: 'Қараңғы режим', themeLight: 'Жарық режим',
    micHint: 'Сөйлеп болған соң «Аяқтау» батырмасын басыңыз',
    guardianLine: 'Қауіп болса, Ержанға (Алматы) бірден хабар барады',
    famHello: 'Сәлем, Ержан',
    famMomLine: 'Анаңыз Гүлнар апа (Шымкент) Saqta қорғауында',
    soundOffBtn: 'Дыбысты өшіру',
    check: 'Тексеру', checking: 'Saqta тексеріп жатыр…',
    sos: 'SOS — Ержанға хабар беру', sosSub: 'Қазір қоңырау шалып, код не ақша сұраса — басыңыз',
    sosSent: 'Ержанға SOS жіберілді. Ол сізге қазір хабарласады.',
    risk: 'Қауіп деңгейі',
    verdict: { scam: 'АЛАЯҚТАР', suspicious: 'КҮДІКТІ', safe: 'ҚАУІПСІЗ' },
    alertSent: 'Ержанға хабар жіберілді',
    said: 'Не айтылды', why: 'Неге алаяқтық', whatToDo: 'Не істеу керек',
    callSon: 'Балама қоңырау шалу', again: 'Жаңа тексеру',
    error: 'Қате шықты', retry: 'Қайталау', empty: 'Алдымен мәтінді жазыңыз немесе айтып беріңіз',
    voiceDemo: 'демо-режим',
    // family
    famTitle: 'Отбасы қалқаны', famLead: 'Анаңыз алаяқтық хабарламаны тексерсе немесе SOS басса, осында бірден көресіз.',
    protected: 'қорғалған', guardian: 'қамқоршы',
    alerts: 'Хабарландырулар', noAlerts: 'Әзірге бәрі тыныш', noAlertsSub: 'Жаңа хабарландырулар осында бірден шығады.',
    seenBtn: 'Көрдім', seen: 'Қаралды', newBadge: 'Жаңа',
    sosAlert: 'SOS басты', checkAlert: 'алаяқтық хабарламаны тексерді',
    soundOn: 'Дыбыс қосулы', soundOff: 'Дыбысты қосу',
    callMom: 'Анама қоңырау шалу', live: 'Тікелей',
    ago: { now: 'жаңа ғана', m: 'мин бұрын', h: 'сағ бұрын', d: 'күн бұрын' }
  },
  ru: {
    tabCheck: 'Проверка', tabFamily: 'Семья',
    hello: 'Здравствуйте, Гульнар апа',
    lead: 'Вам позвонили и просят деньги или код? Saqta проверит за 3 секунды.',
    micIdle: 'Рассказать', micSub: 'Перескажите, что вам сказали по телефону',
    micListening: 'Слушаю…', micStop: 'Готово',
    or: 'или вставьте сообщение сюда',
    placeholder: 'Текст SMS или сообщения в WhatsApp…',
    examples: 'Примеры:',
    exampleLabels: { scam_kk: 'Лжебанк', scam_ru: 'Безопасный счёт', suspicious: 'Оплата OLX', safe: 'Сообщение от сына' },
    liveNote: 'Онлайн: обновляется каждые 3 секунды',
    micErr: {
      unsupported: 'Этот браузер не распознаёт голос. Откройте в Chrome или напишите текст ниже.',
      denied: 'Нет доступа к микрофону. Разрешите микрофон в браузере и нажмите снова.',
      nospeech: 'Голос не услышан. Нажмите кнопку и говорите ближе к телефону.',
      network: 'Для распознавания голоса нужен интернет. Проверьте связь и повторите.',
      failed: 'Не удалось распознать голос. Повторите или напишите текст ниже.'
    },
    themeDark: 'Тёмная тема', themeLight: 'Светлая тема',
    micHint: 'Когда договорите, нажмите «Готово»',
    guardianLine: 'Если опасно, Ержан (Алматы) сразу получит тревогу',
    famHello: 'Здравствуйте, Ержан',
    famMomLine: 'Ваша мама Гульнар апа (Шымкент) под защитой Saqta',
    soundOffBtn: 'Выключить звук',
    check: 'Проверить', checking: 'Saqta проверяет…',
    sos: 'SOS — позвать Ержана', sosSub: 'Звонят прямо сейчас и просят код или деньги — нажмите',
    sosSent: 'SOS отправлен Ержану. Он сейчас с вами свяжется.',
    risk: 'Уровень риска',
    verdict: { scam: 'МОШЕННИКИ', suspicious: 'ПОДОЗРИТЕЛЬНО', safe: 'БЕЗОПАСНО' },
    alertSent: 'Ержан получил уведомление',
    said: 'Что вам сказали', why: 'Почему это обман', whatToDo: 'Что делать',
    callSon: 'Позвонить сыну', again: 'Новая проверка',
    error: 'Произошла ошибка', retry: 'Повторить', empty: 'Сначала напишите текст или расскажите голосом',
    voiceDemo: 'демо-режим',
    famTitle: 'Семейный щит', famLead: 'Если мама проверит мошенническое сообщение или нажмёт SOS, вы сразу увидите это здесь.',
    protected: 'под защитой', guardian: 'опекун',
    alerts: 'Уведомления', noAlerts: 'Пока всё спокойно', noAlertsSub: 'Новые уведомления появятся здесь сразу.',
    seenBtn: 'Увидел', seen: 'Просмотрено', newBadge: 'Новое',
    sosAlert: 'нажала SOS', checkAlert: 'проверила мошенническое сообщение',
    soundOn: 'Звук включён', soundOff: 'Включить звук',
    callMom: 'Позвонить маме', live: 'Онлайн',
    ago: { now: 'только что', m: 'мин назад', h: 'ч назад', d: 'дн назад' }
  }
}

export const FLAG_META = {
  authority: { kk: 'Жалған банк / мекеме', ru: 'Притворяются банком', color: 'violet' },
  urgency: { kk: 'Асықтыру, үрей', ru: 'Спешка и паника', color: 'amber' },
  sms_code: { kk: 'SMS-код сұрау', ru: 'Просят код из SMS', color: 'red' },
  safe_account: { kk: '«Қауіпсіз шот»', ru: '«Безопасный счёт»', color: 'red' },
  remote_access: { kk: 'Қашықтан басқару', ru: 'Удалённый доступ', color: 'red' },
  link: { kk: 'Күдікті сілтеме', ru: 'Подозрительная ссылка', color: 'blue' },
  too_good: { kk: 'Тым тиімді', ru: 'Слишком выгодно', color: 'amber' },
  personal_data: { kk: 'Жеке деректер', ru: 'Личные данные', color: 'violet' },
  payment_request: { kk: 'Ақша сұрау', ru: 'Просят деньги', color: 'red' }
}

export const FLAG_COLORS = {
  red: { mark: 'rgba(224,53,43,.18)', line: '#E0352B', dot: 'bg-risk-scam', text: 'text-risk-scam' },
  amber: { mark: 'rgba(224,138,0,.20)', line: '#E08A00', dot: 'bg-risk-warn', text: 'text-risk-warn' },
  violet: { mark: 'rgba(111,76,255,.16)', line: '#6F4CFF', dot: 'bg-[#6F4CFF]', text: 'text-[#6F4CFF]' },
  blue: { mark: 'rgba(11,127,160,.16)', line: '#0B7FA0', dot: 'bg-sky-brand', text: 'text-sky-brand' }
}

export const LangCtx = createContext({ lang: 'kk', t: STR.kk, setLang: () => {} })
export const useLang = () => useContext(LangCtx)

export function timeAgo(iso, t) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return t.ago.now
  if (s < 3600) return `${Math.floor(s / 60)} ${t.ago.m}`
  if (s < 86400) return `${Math.floor(s / 3600)} ${t.ago.h}`
  return `${Math.floor(s / 86400)} ${t.ago.d}`
}
