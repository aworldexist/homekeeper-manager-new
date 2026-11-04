import { useState } from 'react';
import { Sparkles, X, Check, AlertCircle, Bot } from 'lucide-react';
import { daysLeft, offsetDate, today } from './domain';
import { estimateExpiry, inferStorage, storageLabels, getFoodProfiles, basisLabels, referenceCoverage } from './services/expiry';
import { aiEstimateExpiry } from './services/cloud';
import type { ExpiryEstimate, ItemDraft, StorageMode } from './types';
interface Props {draft:Pick<ItemDraft,'name'|'category'|'purchaseDate'|'location'|'expiryDate'|'expiryEstimate'>;onChange:(date:string,estimate?:ExpiryEstimate)=>void;label?:string;compact?:boolean}
export default function ExpiryField({draft,onChange,label='到期日期',compact=false}:Props){
    const [open,setOpen]=useState(false),[storageOverride,setStorageOverride]=useState<StorageMode|''>('');
    const [profileId,setProfileId]=useState(draft.expiryEstimate?.profileId||'');
    const [basisDate,setBasisDate]=useState(draft.expiryEstimate?.basisKind&&draft.expiryEstimate.basisKind!=='purchase'?draft.expiryEstimate.basisDate:'');
    const [aiBusy,setAiBusy]=useState(false),[aiError,setAiError]=useState('');
    const storage=storageOverride||inferStorage(draft.location),profiles=getFoodProfiles(draft.name);
    const profile=profiles.find(p=>p.id===profileId)||(profiles.length===1?profiles[0]:undefined);
    const duration=storage?profile?.times[storage]:undefined;
    let result:ExpiryEstimate|undefined,error='';
    if(open){try{result=estimateExpiry(draft,storage,new Date(),{profileId:profile?.id,basisDate});}catch(e){error=(e as Error).message;}}
    const food=['食品','饮料','调味品'].includes(draft.category);
    // AI 兜底：参考表没有该物品的匹配即可用；未选储存方式时默认按常温估算并在结果中注明。
    // 云服务只对分配域名开放，因此在其他域名（如 Vercel）上不显示该入口，避免点了必然报错。
    const aiAvailable=food&&profiles.length===0;
    async function runAiEstimate(){
        if(aiBusy)return;
        setAiBusy(true);setAiError('');
        try{
            const mode:StorageMode=storage||'room';
            const ai=await aiEstimateExpiry(draft.name.trim(),mode,today());
            if(ai.maxDays===0&&ai.minDays===0)throw new Error(ai.note||'AI 认为该物品不适合此储存方式，请核对或手动填写。');
            const base=draft.purchaseDate||today();
            const baseDate=new Date(`${base}T12:00:00`);
            const date=offsetDate(ai.minDays,baseDate);
            const note=storage?ai.note:`未选择储存方式，按常温估算。${ai.note}`;
            const estimate:ExpiryEstimate={date,maxDate:offsetDate(ai.maxDays,baseDate),basisDate:base,basisKind:'purchase',basisLabel:'购买日期',basisName:draft.name.trim(),basisLocation:draft.location.trim(),storage:mode,days:daysLeft(date,base)!,ruleLabel:'AI 智能估算',source:'AI 大模型估算（非参考表数据，仅供参考）',referenceRange:`${ai.minDays}~${ai.maxDays} 天`,referenceNote:note};
            onChange(date,estimate);setOpen(false);
        }catch(e){setAiError((e as Error).message);}
        finally{setAiBusy(false);}
    }
    return <div className={`expiry-field ${compact?'compact':''}`}><label>{!compact&&<span>{label}{draft.expiryEstimate&&<small className="estimated-label">预计</small>}</span>}<input aria-label={label} type="date" value={draft.expiryDate} onInput={e=>onChange(e.currentTarget.value)} onChange={e=>onChange(e.target.value)}/></label>
        {food&&<button type="button" className="estimate-button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Sparkles size={13}/>{open?'收起估算':'估算到期日'}</button>}
        {draft.expiryEstimate&&!open&&<small className="estimate-saved">预计 · {storageLabels[draft.expiryEstimate.storage]}{draft.expiryEstimate.referenceRange&&` · 参考 ${draft.expiryEstimate.referenceRange}`} · 可手动修正</small>}
        {food&&open&&<div className="expiry-estimator"><div className="estimate-title"><b>按参考表估算</b><button type="button" className="icon-button" aria-label="关闭日期估算" onClick={()=>setOpen(false)}><X size={13}/></button></div><small className="reference-coverage">已载入 {referenceCoverage.sheets} 张表 · {referenceCoverage.rows} 行参考</small>
            {profiles.length>1&&<label>食品类型与状态<select aria-label={`${label}食品类型与状态`} value={profile?.id||''} onChange={e=>{setProfileId(e.target.value);setBasisDate('');}}><option value="">请选择准确类型与状态</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
            <label>实际储存方式<select aria-label={`${label}储存方式`} value={storage} onChange={e=>{setStorageOverride(e.target.value as StorageMode|'');setBasisDate('');}}><option value="">请选择，无需填写收纳位置</option>{Object.entries(storageLabels).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>
            {profile&&<p className="estimate-condition">{profile.label}{profile.condition&&`：${profile.condition}`}</p>}
            {duration&&duration.basis!=='purchase'&&<label>{basisLabels[duration.basis]}<input aria-label={`${label}${basisLabels[duration.basis]}`} type="date" value={basisDate} onInput={e=>setBasisDate(e.currentTarget.value)} onChange={e=>setBasisDate(e.target.value)}/><small>此时长从{basisLabels[duration.basis]}起算，不能用购买日期替代。</small></label>}
            {result?<><div className="estimate-result"><span>{result.qualityOnly?'预计品质参考期至':'预计提醒日期'}</span><strong>{result.date}</strong><small>参考范围：{result.referenceRange}；按下限设置提醒。<br/>{result.basisLabel} {result.basisDate} → 参考上限 {result.maxDate}</small></div>{daysLeft(result.date)!<0&&<p className="estimate-warning">此参考日期已早于今天，请检查实际状态。</p>}<p className="estimate-disclaimer">参考范围来自你提供的表格，不能替代包装标识或实际状态判断。{result.qualityOnly&&'冷冻时长用于品质规划，不是安全到期保证。'}</p><details className="reference-details"><summary>查看原始记录</summary><p>{result.referenceNote}</p><small>{result.sourceSheet} · 第 {result.sourceRow} 行</small></details><a className="estimate-source" href={result.source} target="_blank" rel="noreferrer">打开完整参考表 ↗</a><button type="button" className="button primary small" onClick={()=>{onChange(result!.date,result);setOpen(false);}}><Check size={13}/>{draft.expiryDate?'确认替换为预计日期':'采用此预计日期'}</button></>:<><p className="estimate-warning" role="status"><AlertCircle size={14}/>{error}</p>{aiAvailable&&!aiBusy&&<button type="button" className="button secondary small" onClick={runAiEstimate}><Bot size={13}/>参考表没有覆盖，用 AI 估算</button>}{aiBusy&&<p className="estimate-disclaimer" role="status"><Bot size={14}/> AI 正在估算「{draft.name.trim()}」的保存期限…</p>}{aiError&&<p className="estimate-warning" role="status"><AlertCircle size={14}/>{aiError}</p>}{profile&&<details className="reference-details"><summary>查看表内说明</summary><p>{profile.note}</p><small>{profile.sheet} · 第 {profile.row} 行</small></details>}</>}
        </div>}
    </div>;
}