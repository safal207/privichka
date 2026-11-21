import {isValidDay,shiftDay} from './core.mjs';

/**
 * One point per local calendar day, including days with no completed habit.
 * A goal contributes at most one completion per day, even if its backup log
 * accidentally contains repeated entries. Manual step checkboxes are not daily
 * habit check-ins and are therefore not counted.
 */
export function activitySeries(goals,endDay,period=14) {
  if(!Array.isArray(goals)||!isValidDay(endDay)||!Number.isInteger(period)||period<2||period>90)
    throw new RangeError('Некорректный период графика');
  const start=shiftDay(endDay,1-period);
  const dates=Array.from({length:period},(_,i)=>shiftDay(start,i));
  const counts=new Map(dates.map(day=>[day,0]));
  for(const goal of goals) {
    if(!Array.isArray(goal?.log)) continue;
    for(const day of new Set(goal.log)) {
      if(counts.has(day))counts.set(day,counts.get(day)+1);
    }
  }
  return dates.map(day=>({day,count:counts.get(day)}));
}
export function activityValues(series,mode='daily') {
  if(!Array.isArray(series)||!['daily','cumulative'].includes(mode))throw new RangeError('Некорректный режим графика');
  let sum=0;
  return series.map(({day,count})=>{
    sum+=count;
    return {day,count,value:mode==='cumulative'?sum:count};
  });
}
export function activitySummary(series) {
  const total=series.reduce((acc,x)=>acc+x.count,0);
  const activeDays=series.filter(x=>x.count>0).length;
  const peak=series.reduce((acc,x)=>Math.max(acc,x.count),0);
  return {total,activeDays,peak};
}
