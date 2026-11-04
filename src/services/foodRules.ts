import workbook from '../referenceWorkbook.json';
import type { StorageMode } from '../types';
export type BasisKind='purchase'|'production'|'opened'|'cut';
export interface ReferenceTime {min:number;max:number;unit:'day'|'week'|'month';text:string;basis:BasisKind}
export interface FoodProfile {id:string;names:string[];label:string;sheet:string;row:number;times:Partial<Record<StorageMode,ReferenceTime>>;note:string;condition:string}
export const referenceSource=workbook.sourceUrl;
export const referenceName=workbook.sourceName;
export const basisLabels:Record<BasisKind,string>={purchase:'购买日期',production:'生产日期',opened:'开封日期',cut:'切开日期'};
const rows=(sheet:string,row:number)=>workbook.sheets.find(s=>s.name===sheet)!.rows.find(r=>r.row===row)!.cells;
function time(text:string,basis:BasisKind='purchase'):ReferenceTime|undefined {
    if(text.includes('当天吃完'))return {min:0,max:0,unit:'day',text,basis};
    const m=text.match(/(\d+)(?:[~～—-](\d+))?\s*(天|周|个月|月)/);
    if(!m)return undefined;
    return {min:+m[1],max:+(m[2]||m[1]),unit:m[3]==='天'?'day':m[3]==='周'?'week':'month',text,basis};
}
const profiles:FoodProfile[]=[];
function add(id:string,sheet:string,row:number,names:string[],label:string,values:Partial<Record<StorageMode,string>>,basis:BasisKind='purchase',condition='',extraNote=''){
    const original=rows(sheet,row),times:FoodProfile['times']={};
    for(const [storage,text] of Object.entries(values)){const parsed=time(text!,basis);if(parsed)times[storage as StorageMode]=parsed;}
    profiles.push({id,sheet,row,names,label,times,condition,note:[...original,extraNote].filter(Boolean).join('；')});
}
function vegetable(id:string,row:number,names:string[],label=names[0]){const r=rows('蔬菜类',row);add(id,'蔬菜类',row,names,label,{room:r[2],fridge:r[3]},'purchase','新鲜、完整，尚未发生变质');}
vegetable('leafy',2,['菠菜','生菜','油麦菜','青菜','上海青','小白菜'],'绿叶菜');
vegetable('cabbage',3,['白菜','包菜','娃娃菜','卷心菜'],'耐储叶菜');
vegetable('roots',4,['土豆','红薯','山药'],'根茎类（常温需避光）');
vegetable('carrot',5,['萝卜','白萝卜','胡萝卜'],'萝卜类');
vegetable('nightshade',6,['番茄','西红柿','茄子','青椒'],'茄果类');
add('cucumber','蔬菜类',7,['黄瓜'],'完整黄瓜',{room:'3~4天',fridge:'5~7天'},'purchase','新鲜完整');
add('wax-gourd','蔬菜类',7,['冬瓜','整冬瓜'],'整冬瓜',{room:'1~2月'},'purchase','完整未切开','本行未明确提供切开冬瓜或丝瓜的时长。');
add('loofah-unknown','蔬菜类',7,['丝瓜'],'丝瓜',{},'purchase','','表中没有明确的丝瓜数值，请手动确认。');
vegetable('mushroom',8,['香菇','鲜香菇','金针菇','杏鲍菇'],'鲜菌菇');
vegetable('beans',9,['四季豆','荷兰豆'],'鲜豆类');
add('scallion','蔬菜类',10,['大葱','葱'],'大葱',{room:'1周',fridge:'2周'});
add('ginger-garlic','蔬菜类',10,['生姜','姜','大蒜','蒜'],'姜蒜',{room:'2~4周'},'purchase','','表中未给姜蒜明确冷藏时长。');
function meat(id:string,row:number,names:string[],label=names[0],basis:BasisKind='purchase',condition='新鲜生肉，未反复解冻冷冻'){const r=rows('肉类',row);add(id,'肉类',row,names,label,{fridge:r[1],freezer:r[2]},basis,condition);}
meat('pork-whole',2,['猪肉','整块猪肉','瘦肉','猪瘦肉','五花肉','排骨'],'猪肉（整块）');
meat('pork-ground',3,['猪肉','猪肉末','猪绞肉','绞肉','肉末','肉馅'],'猪肉（绞肉）');
meat('beef',4,['牛肉','牛排']);meat('lamb',5,['羊肉']);
meat('whole-chicken',6,['鸡肉','整鸡','全鸡'],'鸡肉（整只）');
meat('chicken-pieces',7,['鸡肉','鸡块','鸡胸肉','鸡翅','鸡腿','鸡柳'],'鸡肉（切块）');
meat('duck',8,['鸭肉','鸭腿','鸭翅']);
meat('sausage',9,['腊肠','火腿'],'腊肠／火腿（已开封）','opened','已开封，开封日期已确认');
function seafood(id:string,row:number,names:string[],label=names[0],condition='新鲜生鲜水产'){const r=rows('水产类',row);add(id,'水产类',row,names,label,{fridge:r[1],freezer:r[2]},'purchase',condition);}
seafood('whole-fish',2,['鱼','鲜鱼','整鱼','鲈鱼','鲫鱼','鲤鱼'],'鲜鱼（整条）');
seafood('fish-pieces',3,['鱼片','鱼块','鱼柳','巴沙鱼','巴沙鱼柳'],'鱼片／鱼块');
seafood('shrimp',4,['虾','虾仁','鲜虾仁','鲜虾']);seafood('crab',5,['蟹','螃蟹','大闸蟹']);
seafood('shellfish',6,['贝类','蛤蜊','蛏子'],'贝类（需透气）','表中不建议冷冻');
seafood('squid',7,['鱿鱼','墨鱼'],'鱿鱼／墨鱼');
add('eggs','蛋奶豆制品',2,['鸡蛋'],'完整生鸡蛋',{room:'30天',fridge:'40~45天'},'purchase','完整生蛋；采用表内参考，包装日期优先');
add('fresh-milk-unopened','蛋奶豆制品',3,['牛奶','鲜牛奶','鲜奶','巴氏奶'],'鲜牛奶／巴氏奶（未开封）',{fridge:'5~7天'},'production','未开封，按包装生产日期起算');
add('fresh-milk-opened','蛋奶豆制品',3,['牛奶','鲜牛奶','鲜奶','巴氏奶'],'鲜牛奶／巴氏奶（已开封）',{fridge:'2~3天'},'opened','已开封并持续冷藏');
add('yogurt','蛋奶豆制品',4,['酸奶'],'酸奶（未开封）',{fridge:'14~21天'},'production','未开封，按包装生产日期起算');
add('uht-milk','蛋奶豆制品',5,['牛奶','常温奶','纯牛奶','盒装常温奶','灭菌奶'],'盒装常温奶（未开封）',{room:'6~12个月'},'production','未开封、避光；包装到期日优先');
add('tofu','蛋奶豆制品',6,['豆腐','嫩豆腐','老豆腐'],'新鲜豆腐',{fridge:'2~3天'},'purchase','按表中冷藏浸水条件；包装要求优先');
add('dried-tofu','蛋奶豆制品',7,['豆干','香干','豆腐皮','豆腐干'],'豆干／豆腐皮',{fridge:'3~5天'});
add('butter','蛋奶豆制品',8,['黄油'],'黄油',{fridge:'1~2个月',freezer:'6~9个月'},'production','按包装生产日期起算，包装条件优先');
add('cheese-opened','蛋奶豆制品',9,['奶酪','芝士'],'奶酪（已开封）',{fridge:'1~2周'},'opened','已开封');
const fruit='水果(常温储存类)';
add('apple',fruit,2,['苹果'],'完整苹果',{room:'1~2周',fridge:'1~2个月'});
add('pear',fruit,3,['梨','雪梨','香梨'],'完整梨',{room:'1周左右',fridge:'1~2个月'});
add('citrus',fruit,4,['橙子','橘子','橙','橘'],'橙子／橘子',{room:'1~2周'},'purchase','','表中仅写“冷藏更久”，未提供冷藏数字。');
add('pomelo',fruit,5,['柚子'],'完整柚子',{room:'1个月左右'},'purchase','完整果皮');
add('banana',fruit,6,['香蕉'],'完整香蕉',{room:'4~7天'},'purchase','常温，未过熟','冷冻可做冰沙，但表中没有冷冻时长。');
add('mango-room',fruit,7,['芒果'],'芒果（常温）',{room:'3~7天'});
add('mango-ripe',fruit,7,['芒果','熟芒果'],'芒果（已成熟，冷藏）',{fridge:'3~5天'},'purchase','已成熟');
add('kiwi-room',fruit,8,['猕猴桃'],'猕猴桃（后熟期，常温）',{room:'3~5天'},'purchase','后熟期');
add('kiwi-ripe',fruit,8,['猕猴桃','熟猕猴桃'],'猕猴桃（已成熟，冷藏）',{fridge:'1~2周'},'purchase','已成熟');
add('stone-room',fruit,9,['桃','桃子','李','李子','杏','杏子'],'桃／李／杏（常温）',{room:'3~5天'});
add('stone-ripe',fruit,9,['桃','桃子','李','李子','杏','杏子'],'桃／李／杏（已成熟，冷藏）',{fridge:'3~5天'},'purchase','已成熟');
add('dragon-fruit',fruit,10,['火龙果'],'完整火龙果',{room:'5~7天'},'purchase','','表中只写“冷藏更佳”，没有冷藏数值。');
add('melon-whole',fruit,11,['哈密瓜','甜瓜'],'哈密瓜／甜瓜（完整）',{room:'5~7天'},'purchase','完整未切开');
add('melon-cut',fruit,11,['哈密瓜','甜瓜','切开哈密瓜','切开甜瓜'],'哈密瓜／甜瓜（已切开）',{fridge:'1~2天'},'cut','已切开并冷藏');
add('persimmon',fruit,12,['柿子'],'完整柿子',{room:'3~7天',fridge:'1~2周'},'purchase','软熟后请及时检查实际状态');
add('pomegranate',fruit,13,['石榴'],'完整石榴',{room:'1~2周',fridge:'1个月左右'});
add('lemon',fruit,14,['柠檬'],'完整柠檬',{room:'2~3周',fridge:'1个月左右'});
const chilled='水果(冷藏储存类)';
for(const [id,row,names] of [['strawberry',2,['草莓']],['blueberry',3,['蓝莓']],['cherry',4,['樱桃','车厘子']],['grape',5,['葡萄']],['lychee',8,['荔枝']],['mangosteen',9,['山竹']],['bayberry',10,['杨梅']],['loquat',11,['枇杷']]] as [string,number,string[]][]){const r=rows(chilled,row);add(id,chilled,row,names,names[0],{fridge:r[1]},'purchase','新鲜完整',r[2]);}
add('watermelon-cut',chilled,6,['西瓜','切开西瓜'],'西瓜（已切开）',{fridge:'1~2天'},'cut','切开后保鲜膜封好冷藏');
add('durian-cut',chilled,7,['榴莲','切开榴莲'],'榴莲（已切开）',{fridge:'1~2天',freezer:'1个月'},'cut','已切开');
export const foodProfiles=profiles;
export function getFoodProfiles(name:string):FoodProfile[]{
    const clean=name.replace(/\s|[（）()]/g,'');
    if(/肉丸|丸子|罐头|熟鸡|熟牛|熟猪|水煮蛋|熟鸡蛋|干香菇|干蘑菇|炒|炖|煎|烤|蒸|卤|腌/.test(clean))return [];
    if(clean.includes('牛奶')&&!/常温|灭菌|巴氏|鲜/.test(clean))return profiles.filter(p=>['fresh-milk-unopened','fresh-milk-opened','uht-milk'].includes(p.id));
    const candidates=profiles.map(profile=>({profile,match:Math.max(0,...profile.names.filter(n=>{const index=clean.lastIndexOf(n);if(index<0)return false;const suffix=clean.slice(index+n.length);return /^(?:(?:未开封|已开封|开封|已成熟|未成熟|整块|整只|整条|切开|切片|切块|冷冻|冷藏|常温|新鲜))*$/.test(suffix);}).map(n=>n.length))})).filter(p=>p.match>0);
    const longest=Math.max(0,...candidates.map(p=>p.match));
    return candidates.filter(p=>p.match===longest).map(p=>p.profile).filter(p=>!/切开|切片|切块/.test(clean)||Object.values(p.times).some(t=>t?.basis==='cut'));
}
export const referenceCoverage={sheets:workbook.sheets.length,rows:workbook.sheets.reduce((sum,s)=>sum+s.rows.length-1,0),profiles:profiles.length};
