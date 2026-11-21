import {isValidDay,shiftDay} from './core.mjs';

const MILESTONES = [3,7,30];

/**
 * Deterministic, local-only facts for the user's mascot.
 * Each habit contributes at most one check-in on a calendar day.
 * All achievements use distinct active calendar days, not a fragile streak.
 * An earlier graph point never receives credit for activity in later days.
 */
export function activityReaction(goals,endDay,focusDay=endDay) {
  if(!Array.isArray(goals)||!isValidDay(endDay)||!isValidDay(focusDay)||focusDay>endDay)
    throw new RangeError('Некорректная дата реакции');
  const counts=new Map();
  for(const goal of goals) {
    if(!Array.isArray(goal?.log))continue;
    for(const day of new Set(goal.log)) {
      if(!isValidDay(day)||day>endDay)continue;
      counts.set(day,(counts.get(day)||0)+1);
    }
  }
  const days=[...counts.keys()].sort();
  const earlier=days.filter(day=>day<focusDay);
  const through=days.filter(day=>day<=focusDay);
  const count=counts.get(focusDay)||0;
  const peakBefore=earlier.reduce((max,day)=>Math.max(max,counts.get(day)),0);
  const startCurrentWeek=shiftDay(focusDay,-6);
  const endPreviousWeek=shiftDay(focusDay,-7);
  const startPreviousWeek=shiftDay(focusDay,-13);
  let weekCount=0,previousWeekCount=0;
  for(const [day,value] of counts) {
    if(day>=startCurrentWeek && day<=focusDay)weekCount+=value;
    else if(day>=startPreviousWeek && day<=endPreviousWeek)previousWeekCount+=value;
  }
  let kind='steady',milestone=0;
  if(days.length===0)kind='empty';
  else if(count===0)kind='idle';
  else if(through.length===1)kind='first';
  else if(MILESTONES.includes(through.length)) {
    kind='milestone';milestone=through.length;
  } else if(earlier.length && earlier[earlier.length-1]<shiftDay(focusDay,-1))kind='return';
  else if(count>=2 && count>peakBefore)kind='record';
  else if(previousWeekCount>0 && weekCount>=previousWeekCount+2)kind='rise';
  return {
    kind,day:focusDay,count,activeDays:through.length,lifetimeActiveDays:days.length,
    milestone,peakBefore,weekCount,previousWeekCount,isToday:focusDay===endDay
  };
}
