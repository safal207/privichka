import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_EFFECTS,normalizeEffects,feedbackPlan,EFFECTS_KEY} from '../src/feedback.mjs';

test('по умолчанию нет неожиданных звуков или вибраций',()=>{
  assert.deepEqual(DEFAULT_EFFECTS,{sound:false,haptics:false,animation:true});
  assert.deepEqual(normalizeEffects(null),DEFAULT_EFFECTS);
  assert.deepEqual(normalizeEffects([]),DEFAULT_EFFECTS);
  assert.deepEqual(normalizeEffects({sound:'true',haptics:1,animation:null}),DEFAULT_EFFECTS);
});
test('настройки принимают только настоящие boolean',()=>{
  assert.deepEqual(normalizeEffects({sound:true,haptics:true,animation:false,extra:'anything'}),{
    sound:true,haptics:true,animation:false
  });
});
test('без согласия не играет даже при наличии AudioContext и вибратора',()=>{
  const plan=feedbackPlan(DEFAULT_EFFECTS,'pushi','milestone',{audio:true,vibrate:true});
  assert.equal(plan.sound,false);assert.equal(plan.haptics,false);
});
test('звук и вибро активируются только если разрешены и поддерживаются браузером',()=>{
  const yes={sound:true,haptics:true,animation:true};
  const ok=feedbackPlan(yes,'pushi','step',{audio:true,vibrate:true,reducedMotion:false});
  const unsupported=feedbackPlan(yes,'pushi','step',{audio:false,vibrate:false});
  assert.equal(ok.sound,true);assert.equal(ok.haptics,true);
  assert.equal(unsupported.sound,false);assert.equal(unsupported.haptics,false);
});
test('настройка без анимации и системная reduced-motion учитываются',()=>{
  const on={sound:false,haptics:false,animation:true};
  assert.equal(feedbackPlan(on,'pushi','step',{reducedMotion:true}).animate,false);
  assert.equal(feedbackPlan(on,'pushi','step',{reducedMotion:false}).animate,true);
  assert.equal(feedbackPlan({...on,animation:false},'pushi','step',{reducedMotion:false}).animate,false);
});
test('у двух персонажей разные короткие оригинальные мелодии',()=>{
  const a=feedbackPlan(DEFAULT_EFFECTS,'pushi'),b=feedbackPlan(DEFAULT_EFFECTS,'bubo');
  assert.notDeepEqual(a.tones,b.tones);
  assert.equal(a.waveform,'triangle');
  assert.equal(b.waveform,'sine');
  assert.ok(a.tones.length<=4);
});
test('рубежи отличаются от обычной отметки без длинной навязчивой вибрации',()=>{
  const set={sound:true,haptics:true,animation:true};
  const step=feedbackPlan(set,'bubo','step',{audio:true,vibrate:true});
  const award=feedbackPlan(set,'bubo','milestone',{audio:true,vibrate:true});
  assert.ok(award.tones.length>step.tones.length);
  assert.ok(award.vibration.length>step.vibration.length);
  assert.ok(award.vibration.reduce((a,b)=>a+b,0)<150);
});
test('хранилище эффектов отделено от целей и не ломает импорт прошлых данных',()=>{
  assert.notEqual(EFFECTS_KEY,'privychka:v1');
  const core=readFileSync(new URL('../src/core.mjs',import.meta.url),'utf8');
  assert.match(core,/export const SCHEMA_VERSION = 1/);
  assert.ok(!core.includes(EFFECTS_KEY));
});
test('на странице есть доступные переключатели и ручная кнопка прослушивания',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const key of ['sound','haptics','animation']) assert.match(html,new RegExp('data-effect-setting="'+key+'"'));
  assert.match(html,/data-action="preview-effects"/);
  assert.match(html,/id="effects-dialog"/);
  assert.match(html,/data-action="effects"/);
});
test('звуки и вибрации запускаются только после успешной отметки',()=>{
  const js=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(js,/if\(change\(s=>/);
  assert.match(js,/playSuccessEffects\(/);
  assert.match(js,/function playToneSequence/);
  assert.match(js,/function openEffects/);
  assert.match(js,/effectsDialog\.showModal\(\)/);
});
