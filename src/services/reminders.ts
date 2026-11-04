import { daysLeft, isLow, today } from '../domain';
import type { Store } from '../types';
export const REMINDER_KEY='homekeeper.reminder.hidden-date.v1';
export function isMutedToday(){try{return localStorage.getItem(REMINDER_KEY)===today();}catch{return false;}}
export function clearReminderMute(){try{localStorage.removeItem(REMINDER_KEY);}catch{throw new Error('免提醒设置未能更新，请检查浏览器存储。');}}
export function reminderSummary(s:Store,base=today()){
    const food=s.items.filter(i=>i.quantity>0&&['食品','饮料','调味品'].includes(i.category)&&!!i.expiryDate);
    return {expired:food.filter(i=>daysLeft(i.expiryDate,base)!<0).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate)),expiring:food.filter(i=>daysLeft(i.expiryDate,base)!>=0&&daysLeft(i.expiryDate,base)!<=3).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate)),low:s.items.filter(isLow)};
}
export function hasReminders(s:Store){const r=reminderSummary(s);return r.expired.length+r.expiring.length+r.low.length>0;}
export function shouldShowReminders(s:Store,storage:Pick<Storage,'getItem'>=localStorage){try{return hasReminders(s)&&storage.getItem(REMINDER_KEY)!==today();}catch{return hasReminders(s);}}
export function muteRemindersToday(storage:Pick<Storage,'setItem'>=localStorage){try{storage.setItem(REMINDER_KEY,today());}catch{throw new Error('今日免提醒未能保存，下次打开可能仍显示提醒。');}}
