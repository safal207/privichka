import {isValidDay,shiftDay} from './core.mjs';

/**
 * Count actual actions, not just habit check-ins:
 * - each manually/automatically completed step contributes one action on its day;
 * - a daily habit check-in contributes at least one action on its day;
 * - if the daily check-in already completed a step, count it only once.
 * This is backwards compatible with existing localStorage / exported JSON.
 */
export function goalDailyActivity(goal) {
  const days=new Map();
  for(const step of Array.isArray(goal?.steps)?goal.steps:[]){
    const day=step?.completedOn;
    if(isValidDay(day))days.set(day,(days.get(day)||0)+1);
  }
  for(const day of new Set(Array.isArray(goal?.log)?goal.log:[])){
    if(isValidDay(day))days.set(day,Math.max(1,days.get(day)||0));
  }
  return days;
}
export function activityDayTotals(goals,endDay=null) {
  if(!Array.isArray(goals)||endDay!==null&&!isValidDay(endDay))
    throw new RangeError('Некорректные данные для активности');
  const totals=new Map();
  for(const goal of goals){
    for(const [day,count] of goalDailyActivity(goal)){
      if(endDay!==null&&day>endDay)continue;
      totals.set(day,(totals.get(day)||0)+count);
    }
  }
  return totals;
}
export function activityDays(goals,endDay=null){
  return [...activityDayTotals(goals,endDay).keys()].sort();
}
/** Exactly one calendar point per day, including days with zero activity. */
export function activitySeries(goals,endDay,period=14) {
  if(!isValidDay(endDay)||!Number.isInteger(period)||period<2||period>90)
    throw new RangeError('Некорректный период графика');
  const counts=activityDayTotals(goals,endDay);
  const start=shiftDay(endDay,1-period);
  return Array.from({length:period},(_,i)=>{
    const day=shiftDay(start,i);
    return {day,count:counts.get(day)||0};
  });
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
