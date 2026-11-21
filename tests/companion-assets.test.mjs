import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const asset=name=>readFileSync(new URL('../assets/companions/'+name+'.webp',import.meta.url));

test('оба новых героя — настоящие локальные WebP, оптимизированные для мобильной сети',()=>{
  const pushi=asset('pushi'),bubo=asset('bubo');
  for (const [name,data] of [['Пуши',pushi],['Бубо',bubo]]) {
    assert.equal(data.toString('ascii',0,4),'RIFF',name+' RIFF');
    assert.equal(data.toString('ascii',8,12),'WEBP',name+' WEBP');
    assert.ok(data.length>2000 && data.length<60000,name+' весит менее 60 КБ');
  }
  assert.notDeepEqual(pushi,bubo,'персонажи различаются');
});

test('картинки доступны в выборе героя, при приветствии и без удалённых URL',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  for(const name of ['pushi','bubo'])assert.ok(html.includes('assets/companions/'+name+'.webp'));
  assert.ok(app.includes('assets/companions/${id}.webp'));
  assert.ok(html.includes('data-action="skip-companion"'));
  assert.ok(html.includes('aria-pressed="false"'));
});
