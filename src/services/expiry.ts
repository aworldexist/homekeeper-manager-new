import { daysLeft, offsetDate, today } from '../domain';
import type { ExpiryEstimate, ItemDraft, StorageMode } from '../types';
import { basisLabels, getFoodProfiles, referenceSource } from './foodRules';
export {getFoodProfiles,referenceCoverage,referenceName,basisLabels} from './foodRules';
export const storageLabels:Record<StorageMode,string>={room:'常温阴凉处',fridge:'冷藏（0—4°C）',freezer:'冷冻（−18°C）'};
export function inferStorage(location:string):StorageMode|''{return /冷冻/.test(location)?'freezer':/冷藏/.test(location)?'fridge':/储物柜|调味架|餐边柜/.test(location)?'room':'';}
export interface EstimateOptions {profileId?:string;basisDate?:string}
export function addMonths(date:Date,months:number):string {const target=new Date(date.getFullYear(),date.getMonth()+months,1,12);const last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();target.setDate(Math.min(date.getDate(),last));return today(target);}
export function estimateExpiry(d:Pick<ItemDraft,'name'|'category'|'purchaseDate'|'location'>,storage:StorageMode|'',now=new Date(),options:EstimateOptions={}):ExpiryEstimate {
    if(!['食品','饮料','调味品'].includes(d.category))throw new Error('仅食品、饮料和调味品支持日期估算。');
    if(!d.name.trim())throw new Error('请先填写食品名称。');
    if(!storage)throw new Error('请选择实际储存方式，无需填写收纳位置。');
    const profiles=getFoodProfiles(d.name);
    if(!profiles.length)throw new Error('参考表暂未覆盖这类食品，请填写包装日期或手动确认。');
    const profile=profiles.find(p=>p.id===options.profileId)||(profiles.length===1?profiles[0]:undefined);
    if(!profile)throw new Error('请先选择食品类型与状态，例如鲜奶／常温奶、开封／未开封。');
    const duration=profile.times[storage];
    if(!duration)throw new Error(`参考表没有提供「${profile.label}」在此储存方式下的明确时长，请核对或手动填写。`);
    const basisDate=duration.basis==='purchase'?(d.purchaseDate||today(now)):(options.basisDate||'');
    if(!basisDate)throw new Error(`请填写${basisLabels[duration.basis]}，不能用购买日期替代。`);
    const base=new Date(`${basisDate}T12:00:00`);
    if(!Number.isFinite(base.getTime())||today(base)!==basisDate)throw new Error('请填写有效的起算日期。');
    if(basisDate>today(now))throw new Error('起算日期晚于今天，请先核对。');
    const add=(n:number)=>duration.unit==='month'?addMonths(base,n):offsetDate(n*(duration.unit==='week'?7:1),base);
    const date=add(duration.min);
    return {date,maxDate:add(duration.max),basisDate,basisKind:duration.basis,basisLabel:basisLabels[duration.basis],basisName:d.name.trim(),basisLocation:d.location.trim(),storage,days:daysLeft(date,basisDate)!,ruleLabel:profile.label,source:referenceSource,profileId:profile.id,sourceSheet:profile.sheet,sourceRow:profile.row,referenceRange:duration.text,referenceNote:profile.note,qualityOnly:storage==='freezer'};
}