import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activitySeries,activityValues,activitySummary} from '../src/activity.mjs';

const goal=log=>({log:[...log]});
test('каждый календарный день — отдельная точка, пропуски не исчезают',()=>{
  assert.deepEqual(activitySeries([goal(['2026-11-20','2026-11-22'])],'2026-11-22',4),[
    {day:'2026-11-19',count:0},{day:'2026-11-20',count:1},
    {day:'2026-11-21',count:0},{day:'2026-11-22',count:1}
  ]);
});
test('несколько привычек в один день суммируются без дублей внутри одной',()=>{
  const goals=[goal(['2026-11-21','2026-11-21']),goal(['2026-11-21','2026-11-20'])];
  const snap=JSON.stringify(goals),series=activitySeries(goals,'2026-11-21',3);
  assert.deepEqual(series.map(x=>x.count),[0,1,2]);
  assert.equal(JSON.stringify(goals),snap,'функция не изменяет входные данные');
  assert.deepEqual(activitySummary(series),{total:3,activeDays:2,peak:2});
});
test('накопительная линия растёт только после отмеченных дней',()=>{
  const series=activitySeries([goal(['2026-11-19','2026-11-21'])],'2026-11-22',4);
  assert.deepEqual(activityValues(series,'daily').map(x=>x.value),[1,0,1,0]);
  assert.deepEqual(activityValues(series,'cumulative').map(x=>x.value),[1,1,2,2]);
  assert.deepEqual(series.map(x=>x.count),[1,0,1,0]);
});
test('7, 14 и 30 дней: корректная длина диапазона и смена года',()=>{
  for(const n of [7,14,30]){
    const s=activitySeries([], '2027-01-02', n);
    assert.equal(s.length,n);
    assert.equal(s.at(-1).day,'2027-01-02');
    assert.equal(s.at(-2).day,'2027-01-01');
    assert.ok(s.every(x=>x.count===0));
  }
});
test('29 февраля попадает в график без потери дня',()=>{
  const s=activitySeries([goal(['2024-02-29'])],'2024-03-01',3);
  assert.deepEqual(s,[
    {day:'2024-02-28',count:0},
    {day:'2024-02-29',count:1},
    {day:'2024-03-01',count:0}
  ]);
});
test('точки будущего не попадают в выбранный исторический интервал',()=>{
  assert.deepEqual(activitySeries([goal(['2026-11-24','2026-11-21'])],'2026-11-21',2).map(x=>x.count),[0,1]);
});
test('недопустимые даты, длины и режимы отвергаются',()=>{
  assert.throws(()=>activitySeries([], '2026-02-30',7));
  assert.throws(()=>activitySeries([], '2026-11-21',1));
  assert.throws(()=>activitySeries([], '2026-11-21',91));
  assert.throws(()=>activitySeries([], '2026-11-21',7.5));
  assert.throws(()=>activityValues([], 'undefined'));
});
test('новый график доступен в интерфейсе и не требует внешнего сервиса',()=>{
  const code=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(code,/function activityChart\(/);
  assert.match(code,/data-chart-period/);
  assert.match(code,/data-chart-mode/);
  assert.match(code,/data-activity-day/);
  assert.match(code,/aria-label/);
});

test('мобильная неделя помещается целиком, без скрытой последней точки',()=>{
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(app,/const svgWidth=compact\?340:760/);
  assert.match(app,/viewBox="0 0 \$\{svgWidth\} 300"/);
  assert.match(css,/\.activity-svg\[data-activity-period="7"\]\{min-width:0;width:100%;max-width:100%\}/);
  assert.match(app,/activityPeriod=window\.matchMedia/);
});
test('длинные графики сразу показывают последние дни и выбранную точку',()=>{
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(app,/function positionActivityChart\(/);
  assert.match(app,/scroll\.scrollLeft=Math\.max\(0,scroll\.scrollWidth-scroll\.clientWidth\)/);
  assert.match(app,/if\(latest\)selectActivityPoint\(latest\)/);
  assert.match(app,/positionActivityChart\(\)/);
  assert.match(app,/Листайте график влево/);
});
test('фактическая последняя точка накопительного графика соответствует числу выполнений',()=>{
  const series=activitySeries([goal(['2026-11-21']),goal(['2026-11-21']),goal(['2026-11-21'])],'2026-11-21',7);
  const cumulative=activityValues(series,'cumulative');
  assert.deepEqual(cumulative.map(p=>p.value),[0,0,0,0,0,0,3]);
  assert.equal(cumulative.at(-1).day,'2026-11-21');
  assert.deepEqual(activitySummary(series),{total:3,activeDays:1,peak:3});
});
