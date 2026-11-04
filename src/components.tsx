import ExpiryField from './ExpiryField';
import { useState, useEffect, useRef, type ReactNode, type FormEvent } from 'react';
import { X, Package, MapPin, Milk, Carrot, SprayCan, Droplets, ShoppingBasket, Utensils, Leaf, AlertCircle, Clock3, Check, Plus, Minus, Pencil, Trash2, History } from 'lucide-react';
import type { Item, ItemDraft, Store, Category, Recipe } from './types';
import { categories } from './types';
import { daysLeft, expiryText, isLow } from './domain';
export function IconFor({ name, category, size = 24 }: {
    name?: string;
    category?: string;
    size?: number;
}) { const Icon = /牛奶|酸奶/.test(name || '') ? Milk : category === '清洁用品' ? SprayCan : category === '洗护用品' ? Droplets : category === '食品' ? Carrot : category === '饮料' ? Milk : category === '调味品' ? Utensils : Package; return <Icon size={size} strokeWidth={1.7}/>; }
export function ItemPicture({ item }: {
    item: Pick<Item, 'name' | 'category'>;
}) { return <span className={`item-picture tone-${categories.indexOf(item.category as Category)}`}><IconFor name={item.name} category={item.category} size={29}/></span>; }
export function Status({ item }: {
    item: Item;
}) { const d = daysLeft(item.expiryDate); return <div className="badges">{item.quantity === 0 ? <span className="badge gray">已用完</span> : d !== null && d < 0 ? <span className="badge red">{expiryText(item)}</span> : d !== null && d <= 3 ? <span className="badge orange"><Clock3 size={11}/>{expiryText(item)}</span> : d !== null && d <= 7 ? <span className="badge yellow">{expiryText(item)}</span> : <span className={`badge ${d === null ? 'gray' : 'green'}`}>{d === null ? '到期日未设置' : item.expiryEstimate ? '预计日期已设置' : '保质期充足'}</span>}{isLow(item) && item.quantity > 0 && <span className="badge orange">库存偏低</span>}</div>; }
export function Modal({ title, subtitle, children, onClose, wide = false }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
}) { const root = useRef<HTMLElement>(null); useEffect(() => { const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; root.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus(); const trap = (e: KeyboardEvent) => { if (e.key !== 'Tab' || !root.current)
    return; const els = Array.from(root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')); const first = els[0], last = els.at(-1); if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
}
else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
} }; document.addEventListener('keydown', trap); return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', trap); previous?.focus(); }; }, []); return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
    onClose(); }} onKeyDown={e => { if (e.key === 'Escape')
    onClose(); }}><section ref={root} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={20}/></button></div>{children}</section></div>; }
export function Empty({ title = '这里暂时空空的', description = '添加一些物品，让家里的每一份储备都有迹可循。', action }: {
    title?: string;
    description?: string;
    action?: ReactNode;
}) { return <div className="empty"><div className="empty-icon"><ShoppingBasket size={35} strokeWidth={1.3}/></div><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function SectionTitle({ title, subtitle, action }: {
    title: string;
    subtitle?: string;
    action?: ReactNode;
}) { return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
export function ItemForm({initial,locations,onSave,onCancel}:{initial:ItemDraft;locations:string[];onSave:(d:ItemDraft)=>void;onCancel:()=>void}){
    const [d,setD]=useState(initial);
    const update=(key:keyof ItemDraft,value:string|number)=>setD(prev=>{
        const next={...prev,[key]:value};
        if(prev.expiryEstimate&&['name','category','purchaseDate','location'].includes(key)&&prev[key]!==value){next.expiryDate='';next.expiryEstimate=undefined;}
        return next;
    });
    return <form onSubmit={e=>{e.preventDefault();onSave(d);}}><div className="form-grid">
        <label>物品名称 <b>*</b><input autoFocus required maxLength={50} value={d.name} onChange={e=>update('name',e.target.value)} placeholder="例如：苹果"/></label>
        <label>物品类别<select value={d.category} onChange={e=>update('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>当前数量 <b>*</b><input type="number" min="0" step="0.001" required value={d.quantity} onChange={e=>update('quantity',e.target.valueAsNumber)}/></label>
        <label>计量单位 <b>*</b><input required maxLength={12} value={d.unit} onChange={e=>update('unit',e.target.value)}/></label>
        <label className="span-2">收纳位置（选填）<input list="form-locations" value={d.location} onChange={e=>update('location',e.target.value)} placeholder="暂不填写，也可以稍后补充"/><datalist id="form-locations">{locations.map(l=><option key={l}>{l}</option>)}</datalist></label>
        <label>购买日期<input type="date" value={d.purchaseDate} onInput={e=>update('purchaseDate',e.currentTarget.value)} onChange={e=>update('purchaseDate',e.target.value)}/></label>
        <ExpiryField draft={d} onChange={(date,estimate)=>setD(prev=>({...prev,expiryDate:date,expiryEstimate:estimate}))}/>
        <label className="span-2">最低库存阈值（{d.unit}）<input type="number" min="0" step="0.001" required value={d.minimum} onChange={e=>update('minimum',e.target.valueAsNumber)}/><small>库存小于或等于此数量时提醒补货。</small></label>
        <label className="span-2">备注<textarea rows={2} value={d.notes} maxLength={300} onChange={e=>update('notes',e.target.value)} placeholder="给家人留一句小提示…"/></label>
    </div><div className="notice"><Leaf size={16}/>不同保质期分别保存；预计日期会明确标记，修改食品或储存条件后需重新估算。</div><div className="modal-actions"><button type="button" className="button secondary" onClick={onCancel}>取消</button><button className="button primary" type="submit"><Check size={16}/>保存物品</button></div></form>;
}
export function ItemCard({ item, onView, onStock, onEdit, onDelete, onHistory }: {
    item: Item;
    onView: () => void;
    onStock: (mode: 'consume' | 'restock') => void;
    onEdit: () => void;
    onDelete: () => void;
    onHistory: () => void;
}) { return <article className={`item-card ${item.quantity === 0 ? 'depleted' : ''}`}><div className="item-card-top"><ItemPicture item={item}/><button onClick={onView} className="item-card-name"><h3>{item.name}</h3><span>{item.category}</span></button><button className="icon-button" aria-label={`编辑${item.name}`} onClick={onEdit}><Pencil size={15}/></button></div><Status item={item}/><div className="item-quantity"><strong>{item.quantity}</strong><span>{item.unit}</span><small>最低库存 {item.minimum} {item.unit}</small></div><div className="item-location"><MapPin size={14}/>{item.location || '位置未设置'}</div><div className="item-date"><Clock3 size={14}/>{item.expiryDate ? `${item.expiryEstimate?'预计 ':''}${item.expiryDate} 到期` : '到期日期未设置'}</div><div className="item-card-actions"><button onClick={() => onStock('consume')} disabled={!item.quantity}><Minus size={14}/>消耗</button><button onClick={() => onStock('restock')}><Plus size={14}/>补充</button><button aria-label={`${item.name}库存记录`} onClick={onHistory}><History size={15}/></button><button aria-label={`删除${item.name}`} onClick={onDelete}><Trash2 size={14}/></button></div></article>; }
export function StockForm({ item, mode, onSave, onCancel }: {
    item: Item;
    mode: 'consume' | 'restock';
    onSave: (q: number) => void;
    onCancel: () => void;
}) { const [q, setQ] = useState(Math.min(1, item.quantity) || 1); return <form onSubmit={e => { e.preventDefault(); onSave(q); }}><div className="stock-summary"><ItemPicture item={item}/><div><h3>{item.name}</h3><p>{item.location || '位置未设置'} · 剩余 {item.quantity} {item.unit}</p></div></div><label>{mode === 'consume' ? '本次使用数量' : '本次补充数量'}（{item.unit}）<input autoFocus type="number" step="0.001" min="0.001" max={mode === 'consume' ? item.quantity : undefined} value={q} required onChange={e => setQ(e.target.valueAsNumber)}/></label>{mode === 'restock' && <p className="helper">仅用于补充相同到期日的批次；不同到期日请使用“新增物品”。</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onCancel}>取消</button><button className="button primary" type="submit">确认{mode === 'consume' ? '使用' : '补充'}</button></div></form>; }
export function PantryArt() { return <svg className="pantry-art" viewBox="0 0 390 240" aria-label="温暖的家庭储物角落插画" role="img"><defs><linearGradient id="glass" x2="1" y2="1"><stop stopColor="#f1f1da"/><stop offset="1" stopColor="#ccd6b1"/></linearGradient><pattern id="grain" width="11" height="13" patternUnits="userSpaceOnUse"><ellipse cx="4" cy="5" rx="1.6" ry="2.5" fill="#dfc69b"/></pattern></defs><ellipse cx="209" cy="215" rx="158" ry="13" fill="#d9e0cb"/><path d="M43 196H360V207H43z" fill="#ba9976"/><path d="M58 207v26m286-26v26" stroke="#c3a17d" strokeWidth="7"/><rect x="72" y="96" width="77" height="99" rx="10" fill="url(#glass)" stroke="#aab995"/><rect x="76" y="121" width="69" height="69" rx="7" fill="url(#grain)"/><rect x="68" y="87" width="85" height="15" rx="5" fill="#c7aa7d"/><rect x="87" y="133" width="47" height="33" rx="3" fill="#f7f3df"/><text x="110" y="154" textAnchor="middle" fill="#7c8264" fontSize="11">OATS</text><path d="M164 105l14-22h35l13 22v89h-62z" fill="#f9f5e9"/><path d="M164 105h62l-13-22h-35z" fill="#a1b79c"/><path d="M195 105v89h31v-89" fill="#dde6d5"/><rect x="183" y="78" width="23" height="7" rx="2" fill="#749178"/><text x="181" y="144" fill="#77927a" fontSize="13" fontWeight="700">MILK</text><path d="M175 158h37" stroke="#afc0a3" strokeWidth="2"/><path d="M239 132h89l-10 63h-69z" fill="#d1aa79"/><path d="M242 144h82m-80 13h78m-76 13h74m-71 13h68m-56-48l3 58m15-58v58m15-58l-3 58" stroke="#e5c89b" strokeWidth="3"/><ellipse cx="283" cy="132" rx="46" ry="10" fill="#ad885c"/><circle cx="264" cy="123" r="19" fill="#d99068"/><circle cx="297" cy="120" r="21" fill="#dd9d71"/><path d="M261 105l5-9 3 10m27-5l2-9 3 9" stroke="#668665" fill="none" strokeWidth="4"/><path d="M313 119c4-32 20-53 24-47 8 16-7 36-24 47m-2-2c-13-27-14-50-6-48 18 9 16 33 6 48" fill="#86a479"/><path d="M311 119c7-42 9-52 11-61" stroke="#688b61" strokeWidth="3" fill="none"/><path d="M51 155c-26-25-24-39-11-36 15 6 15 22 11 36m1 1c-2-31 8-46 17-36 4 15-3 29-17 36" fill="#79966e"/><path d="M35 155h35l-5 40H41z" fill="#dfc7aa"/><path d="M101 59c5-9 8-11 12-11" stroke="#afbe9d" strokeWidth="2" fill="none"/><circle cx="236" cy="59" r="3" fill="#cfbb89"/><path d="M347 137l7-7m-5 15h8" stroke="#b7c39f" strokeWidth="2"/></svg>; }
export function DishArt({ recipe }: {
    recipe: Recipe;
}) { const seed = recipe.id.length; return <svg viewBox="0 0 320 170" className="dish-art" role="img" aria-label={`${recipe.name}插画`} style={{ background: recipe.color + '22' }}><ellipse cx="164" cy="138" rx="93" ry="13" fill="#0000000b"/><ellipse cx="160" cy="89" rx="100" ry="65" fill="#faf8f0"/><ellipse cx="160" cy="89" rx="84" ry="50" fill={recipe.color + '40'}/>{Array.from({ length: 22 }, (_, i) => { const x = 100 + ((i * 37 + seed * 7) % 123), y = 57 + ((i * 23 + seed) % 62); return <g key={i} transform={`translate(${x} ${y}) rotate(${i * 29})`}>{i % 3 === 0 ? <ellipse rx="17" ry="7" fill={recipe.color}/> : i % 3 === 1 ? <path d="M-14 0Q0-18 14 0Q0 14-14 0" fill={recipe.kind === 'salad' ? '#779a5d' : '#a7b383'}/> : <rect x="-9" y="-6" width="18" height="12" rx="4" fill="#eddaa4"/>}</g>; })}<ellipse cx="160" cy="89" rx="89" ry="55" stroke="#dfddd0" fill="none" strokeWidth="2"/><path d="M274 30l-9 109m16-109l-9 109" stroke="#a88b6c" strokeWidth="4" strokeLinecap="round"/><path d="M46 47c-17 4-19 25-6 32l4 60" fill="none" stroke="#b0b5a1" strokeWidth="6" strokeLinecap="round"/></svg>; }
