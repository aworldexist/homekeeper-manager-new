import { useState } from 'react';
import { Bell, Clock3, ShoppingBasket, ArrowRight, AlertTriangle } from 'lucide-react';
import type { Store, Item } from './types';
import { expiryText } from './domain';
import { reminderSummary,isMutedToday } from './services/reminders';
import { Modal, ItemPicture } from './components';
interface Props {store:Store;onDismiss:(mute:boolean)=>void;onExpiry:(mute:boolean)=>void;onShopping:(items:Item[],mute:boolean)=>void;onItem:(item:Item,mute:boolean)=>void}
export default function StartupReminder({store,onDismiss,onExpiry,onShopping,onItem}:Props){
    const [mute,setMute]=useState(isMutedToday),r=reminderSummary(store);
    return <Modal title="今天，先照顾这些家物" subtitle="临期先安排，需要添补的记下来。" onClose={()=>onDismiss(mute)} wide><div className="reminder-summary"><span><Clock3 size={19}/><b>{r.expiring.length}</b> 项食品临期</span><span><ShoppingBasket size={19}/><b>{r.low.length}</b> 项需要补货</span></div>
        <div className="startup-reminder-groups">
            {r.expired.length>0&&<section className="startup-expired"><h3><AlertTriangle size={15}/>已过期食品 · {r.expired.length}</h3><p>请检查并及时清理，不纳入可用食材。</p>{r.expired.slice(0,3).map(i=><button className="startup-row" key={i.id} onClick={()=>onItem(i,mute)}><ItemPicture item={i}/><span><b>{i.name}</b><small>{i.location||'位置未设置'} · {i.quantity} {i.unit}</small></span><em>{expiryText(i)}</em></button>)}</section>}
            <section><h3><Clock3 size={15}/>3 天内到期 · 含今天</h3>{r.expiring.length?r.expiring.slice(0,5).map(i=><button className="startup-row" key={i.id} onClick={()=>onItem(i,mute)}><ItemPicture item={i}/><span><b>{i.name}</b><small>{i.location||'位置未设置'} · 剩余 {i.quantity} {i.unit}</small></span><em>{expiryText(i)}</em></button>):<p className="startup-empty">这三天暂无即将到期的食品。</p>}<button className="text-button" onClick={()=>onExpiry(mute)}>查看全部保质期提醒<ArrowRight size={13}/></button></section>
            <section><h3><ShoppingBasket size={15}/>这些家物，记得添补</h3>{r.low.length?r.low.slice(0,5).map(i=><button className="startup-row" key={i.id} onClick={()=>onItem(i,mute)}><ItemPicture item={i}/><span><b>{i.name}</b><small>{i.location||'位置未设置'}</small></span><em>{i.quantity===0?'已用完':`剩 ${i.quantity} ${i.unit}`}</em></button>):<p className="startup-empty">库存充足，暂时无需补货。</p>}{r.low.length>5&&<p className="helper">另有 {r.low.length-5} 个批次需要补货，可在物品页筛选低库存查看。</p>}</section>
        </div><label className="reminder-mute"><input type="checkbox" checked={mute} onChange={e=>setMute(e.target.checked)}/>今日不再提醒</label><div className="modal-actions"><button className="button secondary" onClick={()=>onDismiss(mute)}>稍后处理</button><button className="button primary" disabled={!r.low.length} onClick={()=>onShopping(r.low,mute)}><ShoppingBasket size={16}/>补货加入采购清单</button></div></Modal>;
}
