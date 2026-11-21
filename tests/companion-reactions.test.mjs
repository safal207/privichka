import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shiftDay} from '../src/core.mjs';
import {activityReaction} from '../src/companion-reactions.mjs';

const g=(...log)=>({log});

test('без действий герой приглашает начать — без выдуманных достижений',()=>{
  const r=activityReaction([], '2026-11-21');
  assert.equal(r.kind,'empty');
  assert.equal(r.count,0);
  assert.equal(r.activeDays,0);
  assert.equal(r.milestone,0);
});

test('первый шаг — реакция на первую дату, а не на количество отметок',()=>{
  const r=activityReaction([g('2026-11-21','2026-11-21'),g('2026-11-21')],'2026-11-21');
  assert.equal(r.kind,'first');
  assert.equal(r.count,2);
  assert.equal(r.activeDays,1);
});

test('достижения 3, 7 и 30 считаются по разным дням и не зависят от серии',()=>{
  for(const n of [3,7,30]){
    const days=Array.from({length:n},(_,i)=>shiftDay('2026-11-21',i-n+1));
    const r=activityReaction([g(...days)],'2026-11-21');
    assert.equal(r.kind,'milestone');
    assert.equal(r.milestone,n);
    assert.equal(r.activeDays,n);
  }
});

test('достижение не появляется повторно в другие дни',()=>{
  const days=['2026-11-17','2026-11-18','2026-11-19','2026-11-20'];
  const r=activityReaction([g(...days)],'2026-11-20');
  assert.notEqual(r.kind,'milestone');
  assert.equal(r.milestone,0);
  assert.equal(r.activeDays,4);
});

test('возвращение после паузы — поддержка, а не потеря прогресса',()=>{
  const r=activityReaction([g('2026-11-18','2026-11-21')],'2026-11-21');
  assert.equal(r.kind,'return');
  assert.equal(r.activeDays,2);
});

test('новый максимум по одновременным привычкам определяется реальными точками',()=>{
  const r=activityReaction([g('2026-11-20','2026-11-21'),g('2026-11-21')],'2026-11-21');
  assert.equal(r.kind,'record');
  assert.equal(r.count,2);
  assert.equal(r.peakBefore,1);
});

test('рост недели сравнивает два сопоставимых семидневных окна',()=>{
  const r=activityReaction([g('2026-11-09','2026-11-19','2026-11-20','2026-11-21')],'2026-11-21');
  assert.equal(r.kind,'rise');
  assert.equal(r.weekCount,3);
  assert.equal(r.previousWeekCount,1);
});

test('обычная активность остаётся обычной, без ложных наград',()=>{
  const r=activityReaction([g('2026-11-20','2026-11-21')],'2026-11-21');
  assert.equal(r.kind,'steady');
  assert.equal(r.milestone,0);
});

test('нулевая выбранная точка не трактуется как наказание',()=>{
  const r=activityReaction([g('2026-11-19')],'2026-11-21');
  assert.equal(r.kind,'idle');
  assert.equal(r.count,0);
  assert.equal(r.lifetimeActiveDays,1);
});

test('при выборе старой точки не используются будущие успехи',()=>{
  const goal=g('2026-11-19','2026-11-20','2026-11-21');
  const older=activityReaction([goal],'2026-11-21','2026-11-20');
  const newer=activityReaction([goal],'2026-11-21','2026-11-21');
  assert.equal(older.kind,'steady');
  assert.equal(older.activeDays,2);
  assert.equal(newer.kind,'milestone');
  assert.equal(newer.activeDays,3);
});

test('неправильные записи и будущие даты не создают фиктивный прогресс',()=>{
  const before=JSON.stringify([g('2026-11-20','2026-11-20','invalid','2026-12-01')]);
  const goals=JSON.parse(before);
  const r=activityReaction(goals,'2026-11-21');
  assert.equal(r.lifetimeActiveDays,1);
  assert.equal(r.kind,'idle');
  assert.equal(JSON.stringify(goals),before);
});

test('проверка даты реакции',()=>{
  assert.throws(()=>activityReaction([],'2026-02-30'));
  assert.throws(()=>activityReaction([],'2026-11-21','2026-11-22'));
  assert.throws(()=>activityReaction([], '2026-11-21','bad-date'));
  assert.throws(()=>activityReaction({}, '2026-11-21'));
});

test('график и поздравление используют одни и те же фактические реакции',()=>{
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(app,/function activityCoach\(/);
  assert.match(app,/function activityVoice\(/);
  assert.match(app,/activityReaction\(myGoals\(\),today\(\)/);
  assert.match(app,/companionPhrase\(kind\)/);
  assert.match(app,/selectActivityPoint\(point\)/);
});
