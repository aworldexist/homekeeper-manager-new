import test from 'node:test';
import assert from 'node:assert/strict';
import {seedData,blankDraft,recipes} from '../src/data';
import {userRecipes} from '../src/userRecipes';
import workbook from '../src/referenceWorkbook.json';
import {foodProfiles,referenceCoverage,getFoodProfiles} from '../src/services/foodRules';
import {estimateExpiry,addMonths} from '../src/services/expiry';
import {addItem,ingredientStatus,cook,offsetDate,today,expiryText,validateDraft} from '../src/domain';
import {isStore} from '../src/storage';
import {intelligence} from '../src/services/intelligence';
import {REMINDER_KEY,reminderSummary,shouldShowReminders,muteRemindersToday} from '../src/services/reminders';

const now=new Date(2026,9,24),base={...blankDraft(),purchaseDate:'2026-10-24'};
test('工作簿6张表54条记录全部保留且每行均有对应规则或明确缺失说明',()=>{
    assert.equal(referenceCoverage.sheets,6);assert.equal(referenceCoverage.rows,54);
    for(const sheet of workbook.sheets)for(const row of sheet.rows.slice(1))assert.ok(foodProfiles.some(p=>p.sheet===sheet.name&&p.row===row.row),`${sheet.name} 第${row.row}行未覆盖`);
    assert.equal(new Set(foodProfiles.map(p=>p.id)).size,foodProfiles.length);
});
test('范围取下限、保留上限和来源：叶菜常温1天冷藏3天',()=>{
    const draft={...base,name:'上海青'};
    const ambient=estimateExpiry(draft,'room',now);assert.equal(ambient.date,'2026-10-25');assert.equal(ambient.maxDate,'2026-10-26');assert.equal(ambient.referenceRange,'1~2天');
    const cold=estimateExpiry(draft,'fridge',now);assert.equal(cold.date,'2026-10-27');assert.equal(cold.maxDate,'2026-10-29');assert.equal(cold.sourceSheet,'蔬菜类');assert.equal(cold.sourceRow,2);
});
test('月按日历计算，不按固定30天；月末和闰年正确',()=>{
    assert.equal(addMonths(new Date(2026,0,31),1),'2026-02-28');assert.equal(addMonths(new Date(2028,0,31),1),'2028-02-29');
    const r=estimateExpiry({...base,name:'苹果'},'fridge',now);assert.equal(r.date,'2026-11-24');assert.equal(r.maxDate,'2026-12-24');assert.equal(r.referenceRange,'1~2个月');
});
test('奶类型与开封状态不猜测；生产和开封日期分别起算',()=>{
    const d={...base,name:'牛奶',category:'饮料' as const};assert.equal(getFoodProfiles('牛奶').length,3);
    assert.throws(()=>estimateExpiry(d,'fridge',now),/类型与状态/);
    assert.throws(()=>estimateExpiry(d,'fridge',now,{profileId:'fresh-milk-unopened'}),/生产日期/);
    const unopened=estimateExpiry(d,'fridge',now,{profileId:'fresh-milk-unopened',basisDate:'2026-10-21'});assert.equal(unopened.date,'2026-10-26');assert.equal(unopened.basisKind,'production');
    const opened=estimateExpiry(d,'fridge',now,{profileId:'fresh-milk-opened',basisDate:'2026-10-23'});assert.equal(opened.date,'2026-10-25');assert.equal(opened.basisKind,'opened');
    const uht=estimateExpiry(d,'room',now,{profileId:'uht-milk',basisDate:'2026-09-01'});assert.equal(uht.date,'2027-03-01');
    assert.doesNotThrow(()=>validateDraft({...d,expiryDate:unopened.date,expiryEstimate:unopened}));
});
test('切开日期、同日提醒及冷冻品质参考均可保存且不覆盖旧版元数据',()=>{
    const cut=estimateExpiry({...base,name:'西瓜'},'fridge',now,{basisDate:'2026-10-23'});assert.equal(cut.date,'2026-10-24');assert.equal(cut.basisKind,'cut');
    const crab=estimateExpiry({...base,name:'螃蟹'},'fridge',now);assert.equal(crab.days,0);assert.equal(crab.date,'2026-10-24');
    assert.ok(isStore(addItem(seedData(),{...base,name:'螃蟹',expiryDate:crab.date,expiryEstimate:crab})));
    const frozen=estimateExpiry({...base,name:'鸡胸肉'},'freezer',now);assert.equal(frozen.date,'2027-04-24');assert.ok(frozen.qualityOnly);assert.ok(expiryText({expiryDate:frozen.date,expiryEstimate:frozen}).startsWith('预计'));
    const legacy={date:'2026-11-01',basisDate:'2026-10-24',basisName:'苹果',basisLocation:'',storage:'fridge' as const,days:8,ruleLabel:'原规则',source:'https://example.com/reference'};
    assert.ok(isStore(addItem(seedData(),{...base,name:'苹果',expiryDate:legacy.date,expiryEstimate:legacy})));
});
test('混合单元格不把黄瓜天数套给冬瓜和丝瓜；非数字条件不编造',()=>{
    const winter=estimateExpiry({...base,name:'冬瓜'},'room',now);assert.equal(winter.date,'2026-11-24');
    assert.throws(()=>estimateExpiry({...base,name:'丝瓜'},'fridge',now),/明确时长/);
    assert.throws(()=>estimateExpiry({...base,name:'橙子'},'fridge',now),/明确时长/);
    assert.throws(()=>estimateExpiry({...base,name:'蛤蜊'},'freezer',now),/明确时长/);
    assert.throws(()=>estimateExpiry({...base,name:'香蕉'},'freezer',now),/明确时长/);
    assert.equal(getFoodProfiles('干香菇').length,0);assert.equal(getFoodProfiles('切开苹果').length,0);
    assert.ok(getFoodProfiles('未开封鲜奶').some(p=>p.id==='fresh-milk-unopened'));
    assert.ok(getFoodProfiles('未开封鲜奶').some(p=>p.id==='fresh-milk-opened'));
    for(const name of ['蟹味菇','虾皮','鸡蛋面','苹果汁','鲫鱼汤'])assert.equal(getFoodProfiles(name).length,0,`${name}不应误套生鲜参考`);
    assert.equal(getFoodProfiles('伊利纯牛奶').length,3);
});
test('41条用户食谱全部覆盖，合并两个重复菜后78道，保留别名和分类',()=>{
    assert.equal(userRecipes.length,41);assert.equal(recipes.length,78);assert.equal(new Set(recipes.map(r=>r.id)).size,78);
    for(const r of userRecipes)assert.ok(recipes.some(x=>x.id===r.id));
    const options={tags:[],people:2,prioritize:true,mode:'all' as const,query:'番茄炒鸡蛋'};
    const found=intelligence.recommend(seedData(),options);assert.equal(found.length,1);assert.equal(found[0].name,'番茄炒蛋');
    assert.equal(intelligence.recommend(seedData(),{...options,query:'',section:'素菜'}).length,11);
    assert.ok(recipes.find(r=>r.id==='loofah-egg')!.tip!.includes('应丢弃'));
});
test('小把、少许和半颗保留原描述，无虚构克数；食材别名不做单位假换算',()=>{
    const broccoli=recipes.find(r=>r.id==='garlic-broccoli')!;assert.equal(broccoli.ingredients[0].quantity,.5);assert.equal(broccoli.ingredients[0].unit,'颗');
    const soup=recipes.find(r=>r.id==='cabbage-tofu-soup')!;assert.ok(soup.flexibleIngredients?.some(i=>i.name==='白菜'&&i.amountText==='几片'&&i.role==='main'));
    const mushroom=recipes.find(r=>r.id==='mushroom-egg')!;assert.equal(mushroom.ingredients[0].unit,'朵');assert.equal(mushroom.ingredients[0].quantity,6);
    const status=ingredientStatus(seedData(),mushroom.ingredients[0]);assert.ok(status.uncertain);assert.equal(status.available,0);assert.equal(status.missing,6);
    assert.ok(recipes.every(r=>r.ingredients.every(i=>i.quantity>0)));
});
test('别名食材按相同单位正确分配批次，未定量调味可通过实际量扣减',()=>{
    const s=seedData();const next=cook(s,[{name:'西红柿',quantity:1,unit:'个'},{name:'盐',quantity:2,unit:'克'}],'实际烹饪');
    assert.equal(next.items.find(i=>i.name==='番茄')!.quantity,2);assert.equal(next.items.find(i=>i.name==='盐')!.quantity,298);
    assert.throws(()=>cook(s,[{name:'鲜香菇',quantity:6,unit:'朵'}],'单位未知'),/库存不足/);
});
test('启动提醒来自当前数据：今天至3天、过期分组，非食品不算临期食品',()=>{
    let s=seedData();s=addItem(s,{...blankDraft(),name:'测试日用品',category:'日用品',quantity:3,minimum:1,expiryDate:today()});
    const r=reminderSummary(s);assert.ok(r.expired.every(i=>i.expiryDate<today()));assert.ok(r.expiring.some(i=>i.expiryDate===today()));assert.ok(r.expiring.some(i=>i.expiryDate===offsetDate(3)));
    assert.ok(!r.expiring.some(i=>i.name==='测试日用品'));assert.ok(!r.expiring.some(i=>i.expiryDate===offsetDate(4)));assert.ok(r.low.some(i=>i.quantity===0));
});
test('今日不再提醒只影响当天；无提醒不弹，存储异常不导致崩溃',()=>{
    const s=seedData(),cache=new Map<string,string>();const storage={getItem:(key:string)=>cache.get(key)||null,setItem:(key:string,value:string)=>{cache.set(key,value);}};
    assert.ok(shouldShowReminders(s,storage));muteRemindersToday(storage);assert.equal(cache.get(REMINDER_KEY),today());assert.equal(shouldShowReminders(s,storage),false);
    cache.set(REMINDER_KEY,offsetDate(-1));assert.ok(shouldShowReminders(s,storage));
    const empty={...s,items:s.items.map(i=>({...i,quantity:i.minimum+2,expiryDate:''}))};assert.equal(shouldShowReminders(empty,storage),false);
    assert.ok(shouldShowReminders(s,{getItem:()=>{throw new Error('unavailable');}}));assert.throws(()=>muteRemindersToday({setItem:()=>{throw new Error('quota');}}),/未能保存/);
});
