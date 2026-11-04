import { useState } from 'react';
import { Check, Clock3, Leaf, RefreshCw, Search, ShoppingBasket, ArrowRight, Sparkles, X } from 'lucide-react';
import type { Store, Recipe, Ingredient } from './types';
import { available, daysLeft, ingredientStatus, round } from './domain';
import { intelligence } from './services/intelligence';
import { recipes } from './data';
import { DishArt, Empty } from './components';

interface Props {store:Store;tags:string[];setTags:(v:string[])=>void;people:number;setPeople:(v:number)=>void;prioritize:boolean;setPrioritize:(v:boolean)=>void;recentNames:string[];onAddMissing:(r:Recipe)=>void;onDetail:(r:Recipe)=>void}
export default function RecipesPage({store,tags,setTags,people,setPeople,prioritize,setPrioritize,recentNames,onAddMissing,onDetail}:Props){
    const [mode,setMode]=useState<'recommended'|'all'>('recommended');
    const [query,setQuery]=useState('');
    const [section,setSection]=useState('全部分类');
    const [useRecent,setUseRecent]=useState(true);
    const [revision,setRevision]=useState(0);
    const freshNames=useRecent?recentNames:[];
    const recommended=intelligence.recommend(store,{tags,people,prioritize,mode,query,limit:8,freshNames,section});
    const scaled=(r:Recipe):Ingredient[]=>r.ingredients.map(i=>({...i,quantity:round(i.quantity*people/2)}));
    const allFood=store.items.filter(i=>['食品','饮料'].includes(i.category)&&available(i));
    const freshAvailable=freshNames.filter(name=>allFood.some(i=>i.name===name));
    return <>
        <section className="panel recipe-controls"><div><h2>今天想怎么吃？</h2><p>{recipes.length} 道日常灵感，按家里最新食材实时匹配。</p></div><div className="recipe-prefs">{['快手菜','高蛋白','清淡','早餐','水果轻食'].map(t=><button className={`preference ${tags.includes(t)?'selected':''}`} onClick={()=>setTags(tags.includes(t)?tags.filter(x=>x!==t):[...tags,t])} key={t}>{tags.includes(t)&&<Check size={14}/>} {t}</button>)}<label className="people-select"><span>用餐人数</span><select aria-label="用餐人数" value={people} onChange={e=>setPeople(+e.target.value)}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n} 人</option>)}</select></label><label className="toggle-label"><input type="checkbox" checked={prioritize} onChange={e=>setPrioritize(e.target.checked)}/><span/>优先消耗临期食材</label></div></section>
        {freshAvailable.length>0&&<div className="recent-food-banner"><Sparkles size={18}/><div><strong>刚添了新食材：{freshAvailable.join('、')}</strong><p>相关食谱已优先展示，数量和缺料也已同步更新。</p></div><button className="text-button" onClick={()=>setUseRecent(false)}><X size={14}/>取消优先</button></div>}
        <section className="recipe-browser-controls"><div className="recipe-mode-tabs" role="group" aria-label="食谱浏览范围"><button className={mode==='recommended'?'active':''} onClick={()=>setMode('recommended')}>推荐搭配</button><button className={mode==='all'?'active':''} onClick={()=>setMode('all')}>全部食谱 <span>{recipes.length}</span></button></div><label className="recipe-section-filter"><span>食谱分类</span><select aria-label="食谱分类" value={section} onChange={e=>setSection(e.target.value)}>{['全部分类','素菜','鸡蛋与豆制品','肉菜','鱼虾类','汤品与一锅炖','主食配菜','原有搭配'].map(c=><option key={c}>{c}</option>)}</select></label><div className="search-field"><Search size={17}/><input aria-label="搜索菜名或食材" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜菜名、苹果、香蕉…"/>{query&&<button className="icon-button" aria-label="清空食谱搜索" onClick={()=>setQuery('')}><X size={14}/></button>}</div></section>
        <div className="list-toolbar"><p>{mode==='all'?'找到':'为你搭配了'} <strong>{recommended.length}</strong> 道食谱 <span>· 基于当前 {new Set(allFood.map(i=>i.name)).size} 种可用食材</span></p><button className="text-button" onClick={()=>{setRevision(v=>v+1);if(recentNames.length)setUseRecent(true);}}><RefreshCw size={14}/>按最新库存搭配</button></div>
        {!allFood.length&&mode==='recommended'&&<div className="notice">还没有可用食材，先看看这些灵感。补齐食材后，匹配结果会自动更新。</div>}
        {recommended.length?<div className="recipes-grid" key={revision}>{recommended.map(r=>{
            const list=scaled(r).map(i=>ingredientStatus(store,i)),missing=list.filter(i=>i.missing>0);
            const fresh=r.ingredients.filter(i=>freshAvailable.includes(i.name)&&ingredientStatus(store,i).available>0);
            const urgent=r.ingredients.find(ing=>allFood.some(i=>i.name===ing.name&&i.expiryDate&&daysLeft(i.expiryDate)!>=0&&daysLeft(i.expiryDate)!<=3));
            const owned=list.filter(i=>i.available>0).map(i=>i.name);
            const reason=fresh.length?`用刚入库的${fresh.map(i=>i.name).join('、')}换个花样`:prioritize&&urgent?`优先使用临期的${urgent.name}`:owned.length?`用家里现有的${owned.join('、')}`:'先收藏灵感，食材还需添补';
            return <article className="recipe-card" key={r.id}><button className="dish-button" onClick={()=>onDetail(r)}><DishArt recipe={r}/><span className="dish-tag"><Clock3 size={13}/>{r.minutes} 分钟</span>{fresh.length>0&&<span className="fresh-recipe-tag"><Sparkles size={12}/>新食材搭配</span>}</button><div className="recipe-card-body"><div className="recipe-title"><button onClick={()=>onDetail(r)}><h2>{r.name}</h2></button><span>{people} 人份</span></div><div className="recipe-tags">{r.section&&<span className="recipe-section-tag">{r.section}</span>}{r.tags.map(t=><span key={t}>{t}</span>)}</div><p className="recipe-reason"><Leaf size={14}/>{reason}</p><div className="ingredients compact">{list.map(ing=><div key={ing.name}><span>{ing.missing===0?<Check size={14} className="text-green"/>:<ShoppingBasket size={14} className="text-orange"/>}<b>{ing.name}</b><small>{ing.quantity} {ing.unit}{ing.amountText&&<span className="unit-warning">原配方：{ing.amountText}，需核对</span>}</small></span><span className={ing.missing>0?'text-orange':'text-green'}>{ing.missing>0?`缺 ${ing.missing} ${ing.unit}`:'家里有'}{ing.uncertain&&<small className="unit-warning">{ing.incompatible.join('、')}装需核对</small>}</span></div>)}</div>{!!r.flexibleIngredients?.length&&<p className="recipe-flexible-note">另备：{r.flexibleIngredients.map(i=>i.name+'（'+i.amountText+'）').join('、')}，用量待确认</p>}{r.tip&&<p className="recipe-tip-preview">{r.tip}</p>}<div className="recipe-actions"><button className="button secondary small" onClick={()=>onAddMissing(r)}><ShoppingBasket size={14}/>{missing.length?`补齐 ${missing.length} 项食材`:r.flexibleIngredients?.length?'定量食材已备齐':'食材已备齐'}</button><button className="button primary small" onClick={()=>onDetail(r)}>看看做法<ArrowRight size={14}/></button></div></div></article>;
        })}</div>:<section className="panel"><Empty title="暂时没有匹配的食谱" description="试试其他菜名或食材，也可以清除偏好，浏览完整食谱库。" action={<button className="button secondary" onClick={()=>{setQuery('');setTags([]);setSection('全部分类');setMode('all');}}>查看全部食谱</button>}/></section>}
        {mode==='recommended'&&recommended.length>0&&<div className="browse-more"><button className="button secondary" onClick={()=>setMode('all')}>继续探索全部 {recipes.length} 道食谱<ArrowRight size={15}/></button></div>}
        <div className="service-note">演示模式：本地结构化食谱库，库存变化后即时重算。过期食材不计入匹配；无法换算的单位会提示核对。多选偏好满足其中一项即可。</div>
    </>;
}
