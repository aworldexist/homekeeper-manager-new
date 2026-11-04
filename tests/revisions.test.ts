import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData,blankDraft,recipes } from '../src/data';
import { addItem,editItem,purchase,categoryFor,daysLeft,today } from '../src/domain';
import { categories } from '../src/types';
import { intelligence } from '../src/services/intelligence';
import { parseEntryLocally } from '../src/services/entryParser';
import { estimateExpiry,inferStorage } from '../src/services/expiry';
import { isStore } from '../src/storage';

test('位置选填：新增、编辑与采购均可留空且不创建空位置',()=>{
    const s=seedData();let next=addItem(s,{...blankDraft(),name:'苹果',location:'  '});
    assert.equal(next.items[0].location,'');assert.deepEqual(next.locations,s.locations);
    next=editItem(next,next.items[0].id,{...next.items[0],location:''});assert.deepEqual(next.locations,s.locations);
    const bought=purchase(next,next.shopping[0].id,2,'','');assert.equal(bought.items[0].location,'');assert.ok(!bought.locations.includes(''));
});
test('其他类别完整支持，未知物品不默认当成食品',()=>{
    assert.ok(categories.includes('其他'));assert.equal(categoryFor('螺丝刀'),'其他');assert.equal(categoryFor('苹果'),'食品');
    const s=addItem(seedData(),{...blankDraft(),name:'螺丝刀',category:'其他'});assert.ok(isStore(s));assert.equal(s.items[0].category,'其他');
});
test('用户反馈原句：无空格与逗号得到苹果3个和香蕉2根',async()=>{
    const result=await intelligence.parseEntry('我今天买了3个苹果，2根香蕉',[],new Date(2026,9,24));
    assert.deepEqual(result.items.map(d=>[d.name,d.quantity,d.unit,d.location,d.expiryDate]),[['苹果',3,'个','',''],['香蕉',2,'根','','']]);
    assert.ok(result.items.every(d=>d.purchaseDate==='2026-10-24'));assert.deepEqual(result.warnings,[]);
});
test('中文数量、顿号、和连接、小数及连续表达',()=>{
    for(const text of ['买了三个苹果、两根香蕉','买了3个苹果和2根香蕉','买了3个苹果2根香蕉']){
        const result=parseEntryLocally(text,[]);assert.deepEqual(result.items.map(i=>i.name),['苹果','香蕉']);assert.deepEqual(result.warnings,[]);
    }
    const {items,warnings}=parseEntryLocally('买了1.5斤牛肉，半斤猪肉',[]);assert.equal(items[0].quantity,1.5);assert.equal(items[1].quantity,.5);assert.deepEqual(warnings,[]);
});
test('物品独立的位置日期与明确共享位置正确归属',()=>{
    const locations=seedData().locations;
    const individual=parseEntryLocally('买了3个苹果放冰箱冷藏室，2根香蕉放客厅储物柜',locations);
    assert.deepEqual(individual.items.map(d=>d.location),['厨房 · 冰箱冷藏室','客厅 · 储物柜']);assert.deepEqual(individual.warnings,[]);
    const shared=parseEntryLocally('今天买了3个苹果，2根香蕉，都放在冰箱冷藏室，都明天到期',locations);
    assert.ok(shared.items.every(d=>d.location==='厨房 · 冰箱冷藏室'));assert.ok(shared.items.every(d=>daysLeft(d.expiryDate)===1));assert.deepEqual(shared.warnings,[]);
});
test('未知日期和缺数量片段有明确提示，不伪造或静默丢失',()=>{
    const r=parseEntryLocally('我今天买了3个苹果，下周五到期，还有一大袋零食',[]);
    assert.equal(r.items.length,1);assert.equal(r.items[0].name,'苹果');assert.equal(r.items[0].expiryDate,'');
    assert.ok(r.warnings.some(w=>w.includes('下周五到期')));assert.ok(r.warnings.some(w=>w.includes('一大袋零食')));
});
test('相对日期跨年、无效日期拒绝；昨日购买按设备日历计算',()=>{
    const now=new Date(2026,11,28);
    assert.equal(parseEntryLocally('今天买了3个苹果，下个月15号到期',[],now).items[0].expiryDate,'2027-01-15');
    assert.equal(parseEntryLocally('昨天买了3个苹果',[],now).items[0].purchaseDate,'2026-12-27');
    assert.throws(()=>parseEntryLocally('买了3个苹果，2026-02-30到期',[],now),/日期无效/);
});
test('日期估算按种类、储存条件和购买日期生成且明确保留来源',()=>{
    const d={...blankDraft(),name:'苹果',purchaseDate:'2026-10-20'};
    const result=estimateExpiry(d,'fridge',new Date(2026,9,24));assert.equal(result.date,'2026-11-20');assert.equal(result.basisDate,'2026-10-20');assert.equal(result.storage,'fridge');assert.ok(result.source.endsWith('/references/food-storage.xlsx'));
    assert.equal(estimateExpiry({...d,name:'鸡胸肉'},'fridge',new Date(2026,9,24)).date,'2026-10-22');
    assert.equal(inferStorage('厨房 · 冰箱冷藏室'),'fridge');assert.equal(inferStorage(''),'');
    const saved=addItem(seedData(),{...d,expiryDate:result.date,expiryEstimate:result});assert.ok(isStore(saved));assert.equal(saved.items[0].expiryEstimate?.date,'2026-11-20');
});
test('无收纳位置也可选储存方式估算；不猜包装奶或冷冻安全期限',()=>{
    const d={...blankDraft(),name:'苹果'};
    assert.ok(estimateExpiry(d,'fridge').date);assert.throws(()=>estimateExpiry(d,''),/储存方式/);
    assert.throws(()=>estimateExpiry({...d,name:'牛奶',category:'饮料'},'fridge'),/类型与状态/);
    assert.throws(()=>estimateExpiry({...d,name:'鸡胸肉'},'room'),/储存方式/);
    assert.throws(()=>estimateExpiry(d,'freezer'),/明确时长/);
    assert.throws(()=>estimateExpiry({...d,category:'其他'},'fridge'),/仅食品/);
});
test('估算条件变更不能带着旧的预计日期保存；旧版无估算字段照常读取',()=>{
    const d={...blankDraft(),name:'苹果'},estimate=estimateExpiry({...blankDraft(),name:'苹果'},'fridge');
    assert.throws(()=>addItem(seedData(),{...d,name:'鸡胸肉',expiryDate:estimate.date,expiryEstimate:estimate}),/重新估算/);
    assert.ok(isStore(seedData()));
    const saved=addItem(seedData(),{...d,expiryDate:estimate.date,expiryEstimate:estimate});
    assert.equal(isStore({...saved,items:[{...saved.items[0],expiryEstimate:{date:'broken'}}]}),false);
});
test('负数解析明确拒绝，不误记为正数数量',()=>{assert.throws(()=>parseEntryLocally('买了-3个苹果',[]),/负数/);});
test('扩充食谱可完整浏览与搜索，新增苹果香蕉触发相关推荐',()=>{
    assert.ok(recipes.length>=30);assert.equal(new Set(recipes.map(r=>r.id)).size,recipes.length);
    const options={tags:[],people:2,prioritize:true,mode:'all' as const};
    assert.equal(intelligence.recommend(seedData(),options).length,recipes.length);
    let s=addItem(seedData(),{...blankDraft(),name:'苹果',quantity:3});s=addItem(s,{...blankDraft(),name:'香蕉',unit:'根',quantity:2});
    const result=intelligence.recommend(s,{...options,mode:'recommended',limit:8,freshNames:['苹果','香蕉']});
    assert.ok(result.slice(0,3).some(r=>r.id==='fruit-bowl'));assert.ok(result.some(r=>r.ingredients.some(i=>i.name==='苹果')));
    const searched=intelligence.recommend(s,{...options,query:'香蕉'});assert.ok(searched.length>=4);assert.ok(searched.every(r=>r.name.includes('香蕉')||r.ingredients.some(i=>i.name==='香蕉')));
    assert.equal(intelligence.recommend(s,{...options,query:'不存在的菜'}).length,0);
});
test('过期或已用完的新水果不会获得可用食材加分',()=>{
    const s=addItem(seedData(),{...blankDraft(),name:'苹果',quantity:3,purchaseDate:'',expiryDate:'2000-01-01'});
    const options={tags:[],people:2,prioritize:true,mode:'all' as const};
    assert.deepEqual(intelligence.recommend(s,options).map(r=>r.id),intelligence.recommend(s,{...options,freshNames:['苹果']}).map(r=>r.id));
});
