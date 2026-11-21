import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoal, localDay, shiftDay, streak, bestStreak, markDay, undoDay, nextStep, progress, normalizeState, starterState, milestones, toggleStep, dailySummary, COMPANIONS, normalizeCompanionId } from '../src/core.mjs';
const sample=()=>createGoal({title:'Освоить Python',action:'учу 5 минут',trigger:'кофе',minutes:5,steps:['Шаг 1','Шаг 2','Шаг 3']},new Date(2026,10,21));
test('создание цели и первый шаг',()=>{const g=sample();assert.equal(g.steps.length,3);assert.equal(progress(g),0);assert.equal(nextStep(g).title,'Шаг 1');});
test('один день — одна отметка',()=>{const a=markDay(sample(),'2026-11-21');assert.equal(a.changed,true);assert.equal(progress(a.goal),33);assert.equal(markDay(a.goal,'2026-11-21').changed,false);});
test('отмена отметки возвращает шаг',()=>{const g=undoDay(markDay(sample(),'2026-11-21').goal,'2026-11-21').goal;assert.equal(progress(g),0);assert.equal(g.log.length,0);});
test('после закрытия всех шагов привычку продолжаем отмечать',()=>{let g=sample();for(let i=21;i<=23;i++)g=markDay(g,`2026-11-${i}`).goal;assert.equal(progress(g),100);assert.equal(nextStep(g),null);const r=markDay(g,'2026-11-24');assert.equal(r.changed,true);assert.equal(r.goal.log.length,4);assert.equal(progress(r.goal),100);});
test('ручной выбор шага',()=>{const g=sample(),id=g.steps[2].id;const a=toggleStep(g,id,'2026-11-21');assert.equal(progress(a),33);assert.equal(progress(toggleStep(a,id,'2026-11-21')),0);});
test('серия сохраняется один пропущенный вечер до конца следующего дня',()=>{const d=['2026-11-19','2026-11-20'];assert.equal(streak(d,'2026-11-20'),2);assert.equal(streak(d,'2026-11-21'),2);assert.equal(streak(d,'2026-11-22'),0);assert.equal(bestStreak(['2026-11-01','2026-11-02',...d]),2);});
test('переход месяца, года и високосного дня',()=>{assert.equal(shiftDay('2026-12-31',1),'2027-01-01');assert.equal(shiftDay('2024-03-01',-1),'2024-02-29');});
test('дата по локальному календарю',()=>assert.equal(localDay(new Date(2026,10,21,23,59)),'2026-11-21'));
test('JSON roundtrip',()=>{const state={version:1,goals:[sample()],companionId:null};assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);});
test('отклонение повреждённого импорта',()=>{assert.throws(()=>normalizeState({goals:[]}));assert.throws(()=>normalizeState({version:1,goals:[{...sample(),log:['2026-02-30']}]}));assert.throws(()=>normalizeState({version:2,goals:[]}));});
test('обязательные поля',()=>{assert.throws(()=>createGoal({title:'A',trigger:'B',action:'',steps:['X']}));assert.throws(()=>createGoal({title:'A',trigger:'B',action:'C',steps:[]}));});
test('достижения и пустое состояние',()=>{assert.deepEqual(milestones(7),[3,7]);assert.deepEqual(starterState(),{version:1,goals:[],companionId:null});});

test('дневной фокус выбирает незавершённую привычку, не меняя порядок',()=>{
  const first=sample(),second=sample(),third=sample();
  const a=markDay(first,'2026-11-21').goal;
  const list=[a,second,third];
  assert.deepEqual(dailySummary(list,'2026-11-21'),{done:1,total:3,nextGoalId:second.id});
  assert.deepEqual(list,[a,second,third]);
});
test('после выполнения всех привычек дневной фокус больше не предлагается',()=>{
  const a=markDay(sample(),'2026-11-21').goal;
  assert.deepEqual(dailySummary([a],'2026-11-21'),{done:1,total:1,nextGoalId:null});
  assert.deepEqual(dailySummary([],'2026-11-21'),{done:0,total:0,nextGoalId:null});
});
test('дневной фокус на новом дне не использует вчерашнюю отметку',()=>{
  const g=markDay(sample(),'2026-11-21').goal;
  assert.deepEqual(dailySummary([g],'2026-11-22'),{done:0,total:1,nextGoalId:g.id});
});

test('ровно два оригинальных героя с уникальными id',()=>{
  assert.deepEqual(COMPANIONS.map(x=>x.id),['pushi','bubo']);
  assert.equal(new Set(COMPANIONS.map(x=>x.id)).size,2);
});
test('выбор героя сохраняется в резервной копии',()=>{
  for(const id of ['pushi','bubo','none']){
    const s=normalizeState({...starterState(),companionId:id});
    assert.equal(s.companionId,id);
    assert.equal(normalizeState(JSON.parse(JSON.stringify(s))).companionId,id);
  }
});
test('резервные копии прежней версии и незнакомые id безопасны',()=>{
  assert.deepEqual(normalizeState({version:1,goals:[]}),starterState());
  assert.equal(normalizeState({version:1,goals:[],companionId:'<script>'}).companionId,null);
  assert.equal(normalizeCompanionId('unknown'),null);
});
