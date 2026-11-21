export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'privychka:v1';

export const PRESETS = {
  python: {
    title: 'Освоить Python', reason: 'Создавать свои проекты и автоматизировать рутину',
    trigger: 'утреннего кофе', action: 'изучаю Python 10 минут', minutes: 10,
    steps: ['Запустить первую программу', 'Разобраться с переменными и типами', 'Изучить условия и циклы', 'Написать две функции', 'Создать мини-проект', 'Подвести итоги и выбрать следующий проект'],
  },
  language: {
    title: 'Говорить на иностранном языке', reason: 'Уверенно общаться в поездках и на работе',
    trigger: 'завтрака', action: 'учу 5 новых слов', minutes: 5,
    steps: ['Выбрать тему и 5 полезных фраз', 'Повторить их вслух', 'Составить три предложения', 'Послушать короткое аудио', 'Провести мини-диалог', 'Повторить материал'],
  },
  sport: {
    title: 'Двигаться каждый день', reason: 'Больше энергии и хорошего самочувствия',
    trigger: 'чистки зубов', action: 'делаю зарядку 5 минут', minutes: 5,
    steps: ['Подготовить место для тренировки', 'Сделать лёгкую разминку', 'Добавить упражнения на подвижность', 'Найти приятный комплекс', 'Повторить комплекс', 'Подвести итоги'],
  },
};

export function isValidDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function localDay(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
export function shiftDay(day, delta) {
  if (!isValidDay(day)) throw new Error('Некорректная дата');
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0,10);
}
export function safeText(v, limit=160) { return typeof v === 'string' ? v.trim().slice(0,limit) : ''; }
export function newId() { return globalThis.crypto?.randomUUID?.() ?? `g-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function createGoal(data, now=new Date()) {
  const title=safeText(data.title,100), trigger=safeText(data.trigger,100), action=safeText(data.action,120);
  if (!title || !trigger || !action) throw new Error('Заполните цель, привычку и её триггер');
  const lines=(Array.isArray(data.steps) ? data.steps : String(data.steps??'').split('\n')).map(s=>safeText(s,160)).filter(Boolean).slice(0,30);
  if (!lines.length) throw new Error('Добавьте хотя бы один шаг');
  const minutes=Math.min(240, Math.max(1, Number.parseInt(data.minutes,10) || 5));
  return { id:newId(), title, reason:safeText(data.reason,220), createdAt:localDay(now),
    habit:{trigger,action,minutes}, steps:lines.map(title=>({id:newId(),title,completedOn:null})), log:[] };
}
export const completedSteps=g=>g.steps.filter(s=>s.completedOn).length;
export const progress=g=>g.steps.length ? Math.round(completedSteps(g)*100/g.steps.length) : 0;
export const nextStep=g=>g.steps.find(s=>!s.completedOn) ?? null;
export const doneToday=(g,day)=>g.log.includes(day);
export function markDay(goal,day) {
  if(!isValidDay(day)) throw new Error('Некорректная дата');
  if(doneToday(goal,day)) return {goal,changed:false};
  const next=nextStep(goal);
  return {changed:true,goal:{...goal,log:[...goal.log,day].sort(),steps:goal.steps.map(s=>next && s.id===next.id ? {...s,completedOn:day}:s)}};
}
export function undoDay(goal,day) {
  if(!doneToday(goal,day)) return {goal,changed:false};
  // Only revert the step completed by the current day's action.
  const i=goal.steps.findLastIndex(s=>s.completedOn===day);
  return {changed:true,goal:{...goal,log:goal.log.filter(d=>d!==day),steps:goal.steps.map((s,j)=>j===i?{...s,completedOn:null}:s)}};
}
export function toggleStep(goal,id,day) {
  if(!isValidDay(day)) throw new Error('Некорректная дата');
  return {...goal,steps:goal.steps.map(s=>s.id===id ? {...s,completedOn:s.completedOn?null:day} :s)};
}
export function streak(log,today) {
  const set=new Set(log.filter(isValidDay)); let cursor=set.has(today)?today:shiftDay(today,-1), n=0;
  while(set.has(cursor) && n<100000) { n++;cursor=shiftDay(cursor,-1); }
  return n;
}
export function bestStreak(log) {
  const sorted=[...new Set(log.filter(isValidDay))].sort(); let best=0, run=0, prev=null;
  for(const day of sorted){ run=prev && shiftDay(prev,1)===day ? run+1 : 1; best=Math.max(best,run);prev=day; }
  return best;
}
export const allDays=goals=>[...new Set(goals.flatMap(g=>g.log))].sort();
export const milestones=(days)=>[3,7,30].filter(n=>days>=n);
export const starterState=()=>({version:SCHEMA_VERSION,goals:[]});
export function normalizeState(input) {
  if(!input || typeof input!=='object' || Array.isArray(input) || input.version!==SCHEMA_VERSION || !Array.isArray(input.goals)) throw new Error('Несовместимый формат файла');
  if(input.goals.length>100) throw new Error('В файле слишком много целей');
  const goalIds=new Set();
  const goals=input.goals.map(g=>{
    if(!g || typeof g!=='object'|| !g.habit || !Array.isArray(g.steps) || !Array.isArray(g.log)) throw new Error('Неправильная структура цели');
    const id=safeText(g.id,80),title=safeText(g.title,100),trigger=safeText(g.habit.trigger,100),action=safeText(g.habit.action,120);
    if(!/^[\w-]{1,80}$/.test(id) || goalIds.has(id) || !title || !trigger || !action || !g.steps.length || g.steps.length>30 || g.log.length>20000) throw new Error('Недопустимая цель');
    goalIds.add(id);
    const ids=new Set(); const steps=g.steps.map(s=>{
      const sid=safeText(s?.id,80),stitle=safeText(s?.title,160);
      if(!/^[\w-]{1,80}$/.test(sid)||ids.has(sid)||!stitle||(s.completedOn!=null&&!isValidDay(s.completedOn))) throw new Error('Недопустимый шаг');
      ids.add(sid);return {id:sid,title:stitle,completedOn:s.completedOn||null};
    });
    if(!g.log.every(isValidDay)) throw new Error('Некорректные даты');
    const log=[...new Set(g.log)].sort();
    // Completion dates must not be in the future relative to the log's dates? Manual step completion independent of logs.
    return {id,title,reason:safeText(g.reason,220),createdAt:isValidDay(g.createdAt)?g.createdAt:localDay(),
      habit:{trigger,action,minutes:Math.min(240,Math.max(1,Number.parseInt(g.habit.minutes,10)||5))},steps,log};
  });
  return {version:SCHEMA_VERSION,goals};
}
