import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoal,markDay,toggleStep,undoDay,progress,normalizeState,starterState} from '../src/core.mjs';
import {goalDailyActivity,activityDayTotals,activityDays,activitySeries,activityValues,activitySummary} from '../src/activity.mjs';
import {activityReaction} from '../src/companion-reactions.mjs';

const day='2026-11-21';
const goal=()=>createGoal({title:'Учить Python',action:'занимаюсь',trigger:'кофе',minutes:5,steps:['Открыть урок','Прочитать','Написать код','Повторить']},new Date(2026,10,21));

test('REGRESSION: галочка отдельного шага появляется на графике и в днях активности',()=>{
  const first=goal(),changed=toggleStep(first,first.steps[0].id,day);
  assert.equal(changed.log.length,0,'ежедневный чек-ин не подделываем');
  assert.equal(progress(changed),25);
  assert.equal(activitySeries([changed],day,7).at(-1).count,1);
  assert.deepEqual(activityDays([changed]),[day]);
  assert.equal(activityReaction([changed],day).kind,'first');
});
test('две ручные галочки в одной цели в один день = два действия',()=>{
  let g=goal();
  g=toggleStep(g,g.steps[0].id,day);
  g=toggleStep(g,g.steps[1].id,day);
  assert.equal(activityDayTotals([g]).get(day),2);
  assert.equal(activitySummary(activitySeries([g],day,7)).total,2);
});
test('кнопка «Сделал шаг» и автоматическая галочка не удваивают действие',()=>{
  const g=markDay(goal(),day).goal;
  assert.equal(g.log.length,1);
  assert.equal(g.steps.filter(s=>s.completedOn===day).length,1);
  assert.equal(activitySeries([g],day,7).at(-1).count,1);
  assert.equal(activityReaction([g],day).count,1);
});
test('ручные этапы и ежедневная отметка одной цели не удваивают общий результат',()=>{
  let g=goal();
  g=toggleStep(g,g.steps[0].id,day);
  g=toggleStep(g,g.steps[1].id,day);
  g=markDay(g,day).goal;
  assert.equal(activitySeries([g],day,7).at(-1).count,3);
  assert.equal(activityDayTotals([g]).get(day),3);
});
test('отмена ручного шага и отмена отметки уменьшают соответствующий счётчик',()=>{
  const g=goal();
  const marked=markDay(g,day).goal;
  assert.equal(activitySeries([undoDay(marked,day).goal],day,7).at(-1).count,0);
  let manual=toggleStep(g,g.steps[0].id,day);
  manual=toggleStep(manual,manual.steps[0].id,day);
  assert.equal(activityDayTotals([manual]).size,0);
});
test('когда этапы давно пройдены, ежедневный чек-ин всё равно считается',()=>{
  let g=goal();
  for(let i=0;i<4;i++)g=toggleStep(g,g.steps[i].id,'2026-11-19');
  g=markDay(g,day).goal;
  assert.equal(activitySeries([g],day,3).at(-1).count,1);
  assert.equal(activitySeries([g],day,3)[0].count,4);
  assert.equal(activityDays([g]).length,2);
});
test('из разных целей действия суммируются, но не путаются между датами',()=>{
  let a=goal(),b=goal();
  a=toggleStep(a,a.steps[0].id,'2026-11-20');
  b=markDay(b,day).goal;
  assert.deepEqual(activitySeries([a,b],day,3).map(x=>x.count),[0,1,1]);
});
test('сохраняет историю шагов из старой JSON-схемы без миграции',()=>{
  let original=goal();original=toggleStep(original,original.steps[0].id,day);
  const stored=normalizeState({version:1,goals:[original],companionId:'pushi'});
  assert.equal(activitySeries(stored.goals,day,7).at(-1).count,1);
  assert.equal(stored.version,starterState().version);
});
test('прошлые дни и достижения пересчитываются по отметкам этапов',()=>{
  let g=goal();
  g=toggleStep(g,g.steps[0].id,'2026-11-19');
  g=toggleStep(g,g.steps[1].id,'2026-11-20');
  g=toggleStep(g,g.steps[2].id,'2026-11-21');
  assert.deepEqual(activityDays([g]),['2026-11-19','2026-11-20','2026-11-21']);
  const reaction=activityReaction([g],day);
  assert.equal(reaction.kind,'milestone');
  assert.equal(reaction.activeDays,3);
});
test('испорченные и будущие даты не превращаются в исторические точки',()=>{
  const g={log:['invalid','2026-11-22'],steps:[{completedOn:'2026-11-20'},{completedOn:'fake'},{completedOn:null}]};
  assert.deepEqual(activitySeries([g],day,3).map(x=>x.count),[0,1,0]);
  assert.deepEqual(activityDays([g],day),['2026-11-20']);
});
test('сохраняет накопительную сумму и нули за пропущенные даты',()=>{
  let g=goal();g=toggleStep(g,g.steps[0].id,'2026-11-19');g=toggleStep(g,g.steps[1].id,day);
  const x=activitySeries([g],day,3);
  assert.deepEqual(x.map(p=>p.count),[1,0,1]);
  assert.deepEqual(activityValues(x,'cumulative').map(p=>p.value),[1,1,2]);
});
test('выбранные разные дни не получают заслуги будущих дней',()=>{
  let g=goal();g=toggleStep(g,g.steps[0].id,'2026-11-20');g=toggleStep(g,g.steps[1].id,day);
  const f=activityReaction([g],day,'2026-11-20');
  assert.equal(f.count,1);
  assert.equal(f.activeDays,1);
});
test('история не изменяется при построении графика',()=>{
  let g=goal();g=toggleStep(g,g.steps[0].id,day);
  const before=JSON.stringify(g);
  const result=goalDailyActivity(g);
  assert.equal(result.get(day),1);
  assert.equal(JSON.stringify(g),before);
});
