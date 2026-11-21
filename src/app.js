import {STORAGE_KEY,PRESETS,starterState,normalizeState,createGoal,localDay,shiftDay,progress,nextStep,completedSteps,markDay,undoDay,toggleStep,doneToday,streak,bestStreak,allDays,milestones,newId,dailySummary,COMPANIONS} from './core.mjs';
import {activitySeries,activityValues,activitySummary} from './activity.mjs';

const content=document.querySelector('#content');
const dialog=document.querySelector('#goal-dialog');
const companionDialog=document.querySelector('#companion-dialog');
const form=document.querySelector('#goal-form');
const inputSteps=document.querySelector('#step-inputs');
const fileInput=document.querySelector('#import-file');
const toastBox=document.querySelector('#toast');
let currentTab='today', editingId=null, lastDay=localDay(), toastTimer, celebratedId=null;
let activityPeriod=14,activityMode='daily';
let state=loadState();

function loadState(){
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : starterState();
  }catch(err){
    // Keep the unparseable original in recovery storage instead of silently discarding it.
    try{const raw=localStorage.getItem(STORAGE_KEY); if(raw)localStorage.setItem(`${STORAGE_KEY}:recovery:${Date.now()}`,raw);}catch{}
    setTimeout(()=>toast('Не удалось прочитать сохранённые данные. Копия сохранена для восстановления.'),100);
    return starterState();
  }
}
function save(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}
  catch{toast('Не удалось сохранить изменения. Проверьте доступность памяти браузера.');return false;}
}
function change(updater){const previous=state;state=normalizeState(updater(state));if(!save()){state=previous;return false;}render();return true;}
function toast(message){clearTimeout(toastTimer);toastBox.textContent=message;toastBox.classList.add('visible');toastTimer=setTimeout(()=>toastBox.classList.remove('visible'),3300);}
const h=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeId=h;
const dayLabels=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const dayName=(day)=>dayLabels[new Date(day+'T12:00:00Z').getUTCDay()];
const today=()=>localDay();
const myGoals=()=>state.goals;
const goalById=id=>myGoals().find(g=>g.id===id);
const completedToday=()=>state.goals.filter(g=>doneToday(g,today())).length;
const activeGoals=()=>state.goals.filter(g=>progress(g)<100);
const totalDays=()=>allDays(myGoals()).length;
const currentCompanion=()=>COMPANIONS.find(c=>c.id===state.companionId)??null;
const companionArt=id=>`assets/companions/${id}.webp`;
const companionPhrase=(kind)=>{
  const phrases={
    pushi:{hello:'Погнали? Даже пара минут — уже большой шаг!',success:'Вау! Ты справился. Дай пять!',all:'Все шаги на сегодня сделаны. Отдыхай!'},
    bubo:{hello:'Не торопись. Один маленький шаг — это уже здорово.',success:'Как приятно! Я рад твоему маленькому успеху.',all:'Сегодня всё готово. Спасибо, что заботишься о себе!'},
  };
  return phrases[state.companionId]?.[kind]??'';
};
function companionGreeting(kind='hello'){
  const c=currentCompanion();if(!c)return '';
  return `<aside class="companion-greeting ${kind==='success'?'companion-celebrate':''}" aria-label="Сообщение героя ${c.name}"><img src="${companionArt(c.id)}" alt="" width="88" height="88"><div class="companion-speech"><strong>${c.name} говорит:</strong><p>${companionPhrase(kind)}</p></div></aside>`;
}
function renderCompanionHeader(){
  const c=currentCompanion(),b=document.querySelector('#companion-shortcut');
  if(!b)return;
  b.innerHTML=c?`<img src="${companionArt(c.id)}" alt="" width="34" height="34"><span>${c.name}</span>`:'<span>Мой герой</span>';
  b.setAttribute('aria-label',c?`Сменить героя. Сейчас выбран ${c.name}`:'Выбрать героя');
}
function openCompanions(){
  const current=state.companionId;
  companionDialog.querySelectorAll('[data-companion]').forEach(b=>{
    const selected=b.dataset.companion===current;
    b.setAttribute('aria-pressed',String(selected));b.classList.toggle('selected',selected);
  });
  companionDialog.showModal();
}

function head(text,subtitle='') {return `<div class="section-head"><div><h2>${h(text)}</h2>${subtitle?`<p class="section-caption">${h(subtitle)}</p>`:''}</div></div>`;}
function hero(){
  return `<section class="hero onboarding-hero">
    <div class="hero-copy">
      <p class="eyebrow">БОЛЬШАЯ ЦЕЛЬ НАЧИНАЕТСЯ С МАЛОГО</p>
      <h1>Один шаг.<br>Каждый день.</h1>
      <p class="lead">Выберите то, что важно. Превратим цель в действие на несколько минут — без гонки и чувства вины.</p>
      <button class="button button-dark" data-action="new">Создать свою цель <span aria-hidden="true">↗</span></button>
      <div class="starter-choices">
        <span>Или начните с готового плана:</span>
        <div class="starter-buttons">
          <button type="button" class="chip" data-preset="python">Изучать Python</button>
          <button type="button" class="chip" data-preset="language">Учить язык</button>
          <button type="button" class="chip" data-preset="sport">Двигаться больше</button>
        </div>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      ${currentCompanion()?`<img class="hero-mascot" src="${companionArt(state.companionId)}" alt="">`:'<div class="hero-orbit"></div><div class="hero-circle">✓</div>'}
      <div class="hero-spark">✳</div><div class="hero-small">Начните с пяти минут</div>
    </div>
  </section>`;
}
function todayIntro(summary){
  const complete=summary.total>0 && summary.done===summary.total;
  return `${companionGreeting(complete?'all':'hello')}<section class="today-intro">
    <div><p class="eyebrow">ВАШ ДЕНЬ · ${h(today().split('-').reverse().join('.'))}</p>
      <h1>${complete?'На сегодня — сделано!':'Сегодня достаточно одного шага.'}</h1>
      <p class="lead">${complete?'Все привычки отмечены. Прогресс сохраняется — возвращайтесь завтра.':'Выберите действие, выполните его и возвращайтесь к своему дню.'}</p>
    </div>
    <div class="today-counter" role="status" aria-label="Выполнено ${summary.done} из ${summary.total} привычек">
      <strong>${summary.done}<span> / ${summary.total}</span></strong><small>привычек сегодня</small>
    </div>
  </section>`;
}
function startGuide(){
  return `<div class="start-guide" aria-label="Три шага для старта">
    <div><b>01</b><span>Выберите цель</span></div>
    <div><b>02</b><span>Найдите маленькое действие</span></div>
    <div><b>03</b><span>Повторите завтра</span></div>
  </div>`;
}
function empty(title,body){return `<div class="empty"><div class="empty-icon" aria-hidden="true">↗</div><h2>${h(title)}</h2><p>${h(body)}</p><button class="button button-primary" data-action="new">+ Создать первую цель</button></div>`;}
function smallProgress(goal){return `<div class="progress-top"><span>${completedSteps(goal)} из ${goal.steps.length} шагов</span><span>${progress(goal)}%</span></div><div class="progress-bar" role="progressbar" aria-label="Прогресс цели ${h(goal.title)}" aria-valuenow="${progress(goal)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${progress(goal)}%"></div></div>`;}
function todayCard(g,featured=false){
  const day=today(),done=doneToday(g,day),next=nextStep(g),finished=progress(g)===100;
  const label=finished?'ПРИВЫЧКА НА СЕГОДНЯ':done?'СЛЕДУЮЩИЙ ШАГ — ЗАВТРА':'ШАГ НА СЕГОДНЯ';
  const stepTitle=finished
    ? 'Повторите выбранное маленькое действие — цель уже достигнута.'
    : (next?.title??'Все шаги пройдены');
  const button=done
    ? `<span class="done-pill">✓ Сегодня сделано</span>
       <button class="button button-ghost small" data-action="undo" data-id="${escapeId(g.id)}">Отменить</button>
       <button class="button button-outline small" data-tab="goals">В работе ↗</button>`
    : `<button class="button button-primary" data-action="mark" data-id="${escapeId(g.id)}">✓ Сделал шаг</button>`;
  const celebration=done && celebratedId===g.id
    ? `${companionGreeting('success')}<div class="success-inline" role="status"><strong>Шаг засчитан!</strong><span>Прогресс сохранён. Вы вернётесь к следующему шагу завтра.</span></div>`:'';
  return `<article class="card daily-card ${featured?'daily-card-featured':''} ${done?'daily-card-done':''}">
    <div class="goal-heading"><div><p class="habit-label">${featured?'ГЛАВНЫЙ ШАГ СЕГОДНЯ':'МОЯ ПРИВЫЧКА'}</p>
      <h3 class="card-title">${h(g.title)}</h3></div>
      ${finished?'<span class="badge">Цель достигнута</span>':''}</div>
    <p class="ritual">После <strong>${h(g.habit.trigger)}</strong> я <strong>${h(g.habit.action)}</strong>.</p>
    ${smallProgress(g)}
    <div class="next-step"><small>${label}</small><strong>${h(stepTitle)}</strong></div>
    ${!done?'<p class="tiny-hint">Трудно начать? Попробуйте хотя бы одну минуту — и решите, продолжать ли.</p>':''}
    ${celebration}
    <div class="card-actions">${button}</div>
    <div class="mini-meta">${g.habit.minutes} мин/день · серия ${streak(g.log,day)} дн. · выполнено дней ${g.log.length}</div>
  </article>`;
}
function todayPage(){
  const goals=myGoals();
  if(!goals.length)return `${companionGreeting()}${hero()}${startGuide()}`;
  const summary=dailySummary(goals,today());
  const featured=goals.find(g=>g.id===summary.nextGoalId)??goals[0];
  const others=goals.filter(g=>g.id!==featured.id);
  const allDone=summary.done===summary.total;
  return `${todayIntro(summary)}
    ${allDone?`<div class="all-done"><strong>Все привычки отмечены.</strong><span>Сегодня достаточно. Отдохните — завтра будет новый день.</span><button class="button button-outline small" data-tab="progress">Посмотреть прогресс ↗</button></div>`:''}
    ${head(allDone?'Сегодня вы справились':'Начните с этого',`${summary.done} из ${summary.total} привычек выполнено`)}
    ${todayCard(featured,true)}
    ${others.length?`${head('Остальные привычки','Можно вернуться к ним в течение дня.')}<div class="grid">${others.map(g=>todayCard(g)).join('')}</div>`:''}`;
}
function goalCard(g){
  const finished=progress(g)===100;
  return `<article class="card goal-card"><div class="goal-heading"><div><p class="habit-label">${finished?'ЦЕЛЬ ДОСТИГНУТА':'В РАБОТЕ'}</p><h3 class="card-title">${h(g.title)}</h3>${g.reason?`<p class="muted subhead">${h(g.reason)}</p>`:''}</div><div class="goal-menu"><button class="icon-button" title="Редактировать цель" aria-label="Редактировать ${h(g.title)}" data-action="edit" data-id="${escapeId(g.id)}">✎</button><button class="icon-button danger" title="Удалить цель" aria-label="Удалить ${h(g.title)}" data-action="delete" data-id="${escapeId(g.id)}">✕</button></div></div><p class="ritual"><strong>Привычка:</strong> после ${h(g.habit.trigger)} я ${h(g.habit.action)}</p>${smallProgress(g)}<ol class="step-list">${g.steps.map((s,i)=>`<li class="step-row ${s.completedOn?'complete':''}"><button class="step-check" aria-pressed="${!!s.completedOn}" aria-label="${s.completedOn?'Отменить выполнение':'Выполнить'}: ${h(s.title)}" data-action="toggle-step" data-id="${escapeId(g.id)}" data-step-id="${escapeId(s.id)}">${s.completedOn?'✓':''}</button><span class="step-title">${h(s.title)}</span></li>`).join('')}</ol><div class="mini-meta">Начато ${h(g.createdAt)} · отмечено дней ${g.log.length}</div></article>`;
}
function goalsPage(){return `${head('Мои большие цели','Каждую цель можно изменять, а шаги — отмечать отдельно от привычки.')} ${myGoals().length?`<div>${myGoals().map(goalCard).join('')}</div><button class="button button-primary" data-action="new">+ Добавить ещё одну цель</button>`:empty('Здесь появятся ваши цели','Начните с одного направления и разбейте его на простые шаги.')}`;}
function calendar(log,end,count=14){const set=new Set(log);return `<div class="days" aria-label="Выполнение по дням">${Array.from({length:count},(_,i)=>{const day=shiftDay(end,i-count+1);const done=set.has(day);return `<div title="${h(day)} — ${done?'сделано':'нет отметки'}" class="day ${done?'done':'missed'} ${day===end?'today':''}" aria-label="${h(day)}: ${done?'отмечено':'нет отметки'}"><span>${dayName(day)}</span><b>${Number(day.slice(8))}${done?' ✓':''}</b></div>`;}).join('')}</div>`;}

/** Accessible native SVG time series without analytics SDKs or external scripts. */
function activityChart(goals){
  const end=today(),series=activitySeries(goals,end,activityPeriod);
  const values=activityValues(series,activityMode),info=activitySummary(series);
  const left=52,right=725,top=32,bottom=242;
  const maxValue=Math.max(0,...values.map(v=>v.value));
  const yCeiling=Math.max(4,Math.ceil(maxValue/4)*4);
  const xx=i=>Math.round((left+(right-left)*i/(values.length-1))*10)/10;
  const yy=value=>Math.round((bottom-(bottom-top)*value/yCeiling)*10)/10;
  const coords=values.map((p,i)=>({x:xx(i),y:yy(p.value),...p}));
  const points=coords.map(p=>p.x+','+p.y).join(' ');
  const area='M '+left+' '+bottom+' L '+coords.map(p=>p.x+' '+p.y).join(' L ')+' L '+right+' '+bottom+' Z';
  const ticks=activityPeriod===7?[0,1,2,3,4,5,6]:activityPeriod===14?[0,3,6,9,13]:[0,7,14,21,29];
  const label=day=>day.slice(8)+'.'+day.slice(5,7);
  const periodButtons=[7,14,30].map(n=>`<button type="button" class="activity-filter ${activityPeriod===n?'active':''}" data-chart-period="${n}" aria-pressed="${activityPeriod===n}">${n} дней</button>`).join('');
  const modeButtons=[['daily','За день'],['cumulative','Накопительно']].map(([mode,name])=>`<button type="button" class="activity-filter ${activityMode===mode?'active':''}" data-chart-mode="${mode}" aria-pressed="${activityMode===mode}">${name}</button>`).join('');
  const numbers=Array.from({length:5},(_,i)=>{
    const value=(4-i)*yCeiling/4,y=yy(value);
    return `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" class="activity-grid-line"/><text class="activity-tick" x="${left-10}" y="${y+4}" text-anchor="end">${value}</text>`;
  }).join('');
  const pointsHtml=coords.map(p=>{
    const description=`${p.day}: ${p.count} выполненных привычек`+(activityMode==='cumulative'?`, ${p.value} накопительно за период`:'');
    return `<g class="activity-dot ${p.count===0?'activity-dot-zero':''}" role="button" tabindex="0" data-activity-day="${p.day}" data-activity-count="${p.count}" data-activity-value="${p.value}" aria-label="${description}">
      <title>${description}</title><circle class="activity-hit" cx="${p.x}" cy="${p.y}" r="${activityPeriod===30?11:17}"/>
      <circle class="activity-visible-dot" cx="${p.x}" cy="${p.y}" r="${p.count===0?4:6}" aria-hidden="true"/>
    </g>`;
  }).join('');
  const hasData=info.total>0;
  const tableRows=values.map(p=>`<tr><th scope="row">${p.day}</th><td>${p.count}</td><td>${activityValuesLabel(p,activityMode)}</td></tr>`).join('');
  return `<section class="card activity-surface" aria-labelledby="activity-heading">
    <div class="activity-head"><div><p class="eyebrow">КАРТА ТВОИХ ДЕЙСТВИЙ</p><h3 id="activity-heading">Моя активность · X/Y</h3>
    <p class="section-caption">Каждая точка — день. По горизонтали — дата, по вертикали — число выполненных привычек.</p></div>
    <div class="activity-summary"><span><strong>${info.total}</strong><small>выполнений</small></span><span><strong>${info.activeDays}</strong><small>активных дней</small></span><span><strong>${info.peak}</strong><small>пик за день</small></span></div></div>
    <div class="activity-controls"><div class="activity-control" role="group" aria-label="Период графика"><span>Период</span>${periodButtons}</div>
    <div class="activity-control" role="group" aria-label="Режим графика"><span>Показать</span>${modeButtons}</div></div>
    <div class="activity-scroll" tabindex="0" role="region" aria-label="График активности с прокруткой по горизонтали">
    <svg class="activity-svg" data-activity-period="${activityPeriod}" viewBox="0 0 760 300" role="group" aria-label="Активность за ${activityPeriod} дней: ${activityMode==='daily'?'выполнений в день':'накопленных выполнений'}">
      <defs><linearGradient id="activity-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7cc65b" stop-opacity=".30"/><stop offset="1" stop-color="#7cc65b" stop-opacity=".015"/></linearGradient></defs>
      ${numbers}
      <path d="${area}" fill="url(#activity-gradient)"/>
      <polyline points="${points}" fill="none" stroke="#3b8149" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
      ${ticks.map(i=>`<text x="${xx(i)}" y="${bottom+32}" class="activity-tick" text-anchor="middle">${label(values[i].day)}</text>`).join('')}
      ${pointsHtml}
      <text class="activity-axis-name" x="${left}" y="16">${activityMode==='daily'?'Выполнений в день':'Выполнений с начала периода'}</text>
      <text class="activity-axis-name" x="${right}" y="297" text-anchor="end">Дата →</text>
    </svg></div>
    <p class="activity-insight" id="activity-insight" role="status" aria-live="polite">${hasData?'Нажмите на любую точку — увидите результат за выбранный день.':'Пока нет отметок. Отметьте первый шаг — его точка появится на графике.'}</p>
    <p class="habit-legend">Учитываются отметки «Сделал шаг» по привычкам. Ручные галочки этапов не включены. ${activityMode==='cumulative'?'Накопительный итог начинается с первого дня выбранного периода.':''}</p>
    <details class="activity-details"><summary>Посмотреть данные по дням</summary><div class="activity-table-wrap"><table><thead><tr><th scope="col">Дата</th><th scope="col">За день</th><th scope="col">${activityMode==='daily'?'Значение':'Итого за период'}</th></tr></thead><tbody>${tableRows}</tbody></table></div></details>
  </section>`;
}
function activityValuesLabel(p,mode){return mode==='cumulative'?p.value:p.count;}
function selectActivityPoint(point){
  const wrap=point.closest('.activity-surface'),insight=wrap?.querySelector('#activity-insight');
  if(!insight)return;
  wrap.querySelectorAll('.activity-dot').forEach(dot=>dot.classList.toggle('is-selected',dot===point));
  const label=point.dataset.activityDay.split('-').reverse().join('.');
  const count=Number(point.dataset.activityCount),value=Number(point.dataset.activityValue);
  insight.textContent=activityMode==='daily'
    ? `${label}: выполнено привычек — ${count}.`
    : `${label}: выполнено за день — ${count}, накоплено за период — ${value}.`;
}

function progressPage(){const goals=myGoals(),days=allDays(goals),completed=goals.filter(g=>progress(g)===100).length,current=streak(days,today()),best=bestStreak(days);return `${head('Ваш прогресс','Каждый шаг остаётся в истории — даже если был пропуск.')}<div class="stat-grid"><div class="stat"><strong>${days.length}</strong><span>дней с действиями</span></div><div class="stat"><strong>${current}</strong><span>дней текущей серии</span></div><div class="stat"><strong>${completed}</strong><span>целей достигнуто</span></div></div>${activityChart(goals)}<div class="card" style="margin-top:18px"><h3>Последние 14 дней</h3>${calendar(days,today(),14)}<p class="habit-legend">Выделены дни с хотя бы одной выполненной привычкой. Лучшая серия — ${best} дней.</p><h3 style="margin:26px 0 10px">Ваши достижения</h3><div class="achievements">${[3,7,30].map(n=>`<div class="achievement ${milestones(days.length).includes(n)?'':'locked'}">${milestones(days.length).includes(n)?'★':'◇'} ${n} дней действий</div>`).join('')}</div></div>${goals.length?`${head('По каждой привычке')}${goals.map(g=>`<div class="card goal-progress"><h3>${h(g.title)}</h3>${smallProgress(g)}<p class="mini-meta">Отмечено дней: ${g.log.length} · текущая серия: ${streak(g.log,today())}</p>${calendar(g.log,today(),7)}</div>`).join('')}`:''}`;}
function aboutPage(){return `<div class="hero"><div><p class="eyebrow">ПРОСТАЯ СИСТЕМА</p><h1>Не жди вдохновения. Начни с малого.</h1><p class="lead">Привычка помогает связать большую цель с действием, которое можно повторить завтра.</p><button class="button button-dark" data-action="new">Начать с одной цели</button></div><div class="hero-art" aria-hidden="true"><div class="hero-orbit"></div><div class="hero-circle">↗</div></div></div><div class="about-grid"><div class="card"><div class="about-number">1</div><h3>Определите цель</h3><p>Куда хотите прийти и зачем. Разбейте путь на небольшие понятные шаги.</p></div><div class="card"><div class="about-number">2</div><h3>Привяжите действие</h3><p>«После утреннего кофе я занимаюсь пять минут». Чем конкретнее, тем проще начать.</p></div><div class="card"><div class="about-number">3</div><h3>Отмечайте каждый день</h3><p>Получайте следующий шаг и наблюдайте за прогрессом. Пропуск дня не стирает успехов.</p></div></div><div class="card" style="margin-top:20px"><h3>О ваших данных</h3><p class="muted subhead">Регистрация не нужна. Всё хранится в браузере на этом устройстве. Если очистить данные браузера, записи могут исчезнуть — периодически сохраняйте резервную копию через кнопку «Экспорт». Импорт позволяет восстановить их из файла.</p></div>`;}
function render(){renderCompanionHeader();document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===currentTab;b.classList.toggle('active',on);on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current');});content.innerHTML=({today:todayPage,goals:goalsPage,progress:progressPage,about:aboutPage}[currentTab])();}
function addStepRow(step={}){
  if(inputSteps.children.length>=30){toast('Не более 30 шагов для одной цели');return;}
  const row=document.createElement('div'); row.className='step-entry';
  row.dataset.stepId=step.id||newId();row.dataset.completedOn=step.completedOn||'';
  const input=document.createElement('input');input.type='text';input.className='step-field';input.maxLength=160;input.required=true;input.placeholder=`Шаг ${inputSteps.children.length+1}`;input.value=step.title||'';input.setAttribute('aria-label',`Шаг ${inputSteps.children.length+1}`);
  const remove=document.createElement('button');remove.type='button';remove.className='icon-button danger';remove.dataset.action='remove-step';remove.textContent='−';remove.setAttribute('aria-label','Удалить шаг');
  row.append(input,remove);inputSteps.append(row);
}
function openGoal(id=null){
  editingId=id;form.reset();inputSteps.replaceChildren();const g=id?goalById(id):null;
  document.querySelector('#dialog-title').textContent=g?'Редактировать цель':'Новая большая цель';
  document.querySelector('#form-error').hidden=true;
  if(g){form.elements.title.value=g.title;form.elements.reason.value=g.reason;form.elements.trigger.value=g.habit.trigger;form.elements.action.value=g.habit.action;form.elements.minutes.value=g.habit.minutes;g.steps.forEach(addStepRow);}
  else{addStepRow();}
  dialog.showModal();form.elements.title.focus();
}
function fillPreset(key){const p=PRESETS[key];if(!p)return;for(const field of ['title','reason','trigger','action','minutes'])form.elements[field].value=p[field];inputSteps.replaceChildren();p.steps.forEach(title=>addStepRow({title}));form.elements.title.focus();}
function submitGoal(ev){
  ev.preventDefault();const data=Object.fromEntries(new FormData(form));
  const rows=[...inputSteps.children];data.steps=rows.map(row=>row.querySelector('input').value.trim()).filter(Boolean);
  try {
    if(!data.steps.length)throw new Error('Добавьте хотя бы один шаг');
    if(rows.some(r=>!r.querySelector('input').value.trim()))throw new Error('Заполните все шаги или удалите пустые');
    if(!Number.isInteger(Number(data.minutes))||+data.minutes<1||+data.minutes>240)throw new Error('Продолжительность — от 1 до 240 минут');
    const created=createGoal(data);
    const old=editingId?goalById(editingId):null;
    const goal=old?{...created,id:old.id,createdAt:old.createdAt,log:old.log,steps:rows.map(row=>({id:row.dataset.stepId,title:row.querySelector('input').value.trim(),completedOn:row.dataset.completedOn||null}))}:created;
    if(change(s=>({...s,goals:old?s.goals.map(g=>g.id===old.id?goal:g):[...s.goals,goal]}))){dialog.close();currentTab=old?'goals':'today';celebratedId=null;render();toast(old?'Цель обновлена':'Цель создана. Первый маленький шаг — на экране «Сегодня».');}
  }catch(err){const msg=document.querySelector('#form-error');msg.textContent=err.message||'Не удалось сохранить цель';msg.hidden=false;msg.scrollIntoView({block:'nearest'});}
}
function editAction(action,id,stepId){const g=goalById(id);if(!g)return;
  if(action==='delete'){
    if(confirm(`Удалить цель «${g.title}» и все отметки? Это действие нельзя отменить.`) && change(s=>({...s,goals:s.goals.filter(v=>v.id!==id)})))toast('Цель удалена');return;
  }
  if(action==='edit'){openGoal(id);return;}
  if(action==='toggle-step'){change(s=>({...s,goals:s.goals.map(v=>v.id===id?toggleStep(v,stepId,today()):v)}));return;}
  if(action==='mark'||action==='undo'){
    const result=(action==='mark'?markDay:undoDay)(g,today());
    if(!result.changed){toast('Сегодня уже отмечено');return;}
    if(change(s=>({...s,goals:s.goals.map(v=>v.id===id?result.goal:v)}))){celebratedId=action==='mark'?id:null;render();toast(action==='mark'?(progress(result.goal)===100?'Цель достигнута! Привычка продолжается.':'Шаг засчитан! Завтра вас ждёт следующий.'):'Отметка за сегодня отменена');}
  }
}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`privychka-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Резервная копия сохранена');}
async function importData(file){if(!file)return;
  try {if(file.size>5*1024*1024)throw new Error('Файл слишком большой (максимум 5 МБ)');const parsed=normalizeState(JSON.parse(await file.text()));if(!confirm(`Заменить текущие ${state.goals.length} целей на ${parsed.goals.length} из файла? Сделайте экспорт, если хотите сохранить текущие данные.`))return;
    const old=state;state=parsed;if(!save()){state=old;return;}currentTab='goals';render();toast('Данные восстановлены');
  }catch(err){toast(err instanceof SyntaxError?'Файл не является корректным JSON':err.message||'Импорт не удался');}
  finally{fileInput.value='';}
}
document.addEventListener('click',ev=>{
  const point=ev.target.closest?.('[data-activity-day]');
  if(point){selectActivityPoint(point);return;}
  const btn=ev.target.closest?.('button[data-tab],button[data-action],button[data-preset],button[data-chart-period],button[data-chart-mode]');if(!btn)return;
  if(btn.dataset.chartPeriod){const n=Number(btn.dataset.chartPeriod);if([7,14,30].includes(n)){activityPeriod=n;render();}return;}
  if(btn.dataset.chartMode){const mode=btn.dataset.chartMode;if(['daily','cumulative'].includes(mode)){activityMode=mode;render();}return;}
  if(btn.dataset.tab){currentTab=btn.dataset.tab;render();content.focus({preventScroll:true});return;}
  if(btn.dataset.action==='companion'){openCompanions();return;}
  if(btn.dataset.action==='choose-companion'||btn.dataset.action==='skip-companion'){
    const selected=btn.dataset.action==='skip-companion'?'none':btn.dataset.companion;
    if(!COMPANIONS.some(c=>c.id===selected)&&selected!=='none')return;
    if(change(s=>({...s,companionId:selected}))){companionDialog.close();toast(selected==='none'?'Героя можно выбрать в любой момент':`Теперь ваш спутник — ${currentCompanion().name}!`);}
    return;
  }
  if(btn.dataset.preset){if(!dialog.open)openGoal();fillPreset(btn.dataset.preset);return;}
  const a=btn.dataset.action,id=btn.dataset.id;
  if(a==='new')openGoal();else if(a==='close')dialog.close();else if(a==='add-step')addStepRow();else if(a==='remove-step'){if(inputSteps.children.length===1){toast('Нужен хотя бы один шаг');return;}btn.closest('.step-entry')?.remove();}
  else if(a==='export')exportData();else if(a==='import')fileInput.click();else if(id)editAction(a,id,btn.dataset.stepId);
});
document.addEventListener('keydown',ev=>{
  if(!['Enter',' '].includes(ev.key))return;
  const point=ev.target.closest?.('[data-activity-day]');if(!point)return;
  ev.preventDefault();selectActivityPoint(point);
});
form.addEventListener('submit',submitGoal);
fileInput.addEventListener('change',()=>importData(fileInput.files?.[0]));
function refreshIfNeeded(){const now=today();if(lastDay!==now){lastDay=now;render();}}
window.addEventListener('focus',refreshIfNeeded);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshIfNeeded();});setInterval(refreshIfNeeded,60_000);
render();
if(state.companionId===null)requestAnimationFrame(openCompanions);
