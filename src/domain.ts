import type { Item, ItemDraft, Store, Ingredient, ShoppingItem, Category } from './types';
export const uid = () => typeof crypto.randomUUID==='function'?crypto.randomUUID():`local-${Date.now().toString(36)}-${Array.from(crypto.getRandomValues(new Uint32Array(3)),n=>n.toString(36)).join('-')}`;
export function today(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function offsetDate(days: number, from = new Date()) { const d = new Date(from); d.setDate(d.getDate() + days); return today(d); }
export function daysLeft(date: string, base = today()) { if (!date)
    return null; const [y, m, d] = date.split('-').map(Number); const [by, bm, bd] = base.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(by, bm - 1, bd)) / 86400000); }
export const round = (n: number) => Math.round(n * 1000) / 1000;
export const isLow = (i: Item) => i.quantity <= i.minimum;
export const available = (i: Item) => i.quantity > 0 && (daysLeft(i.expiryDate) === null || daysLeft(i.expiryDate)! >= 0);
export function expiryText(i: Pick<Item, 'expiryDate' | 'expiryEstimate'>) { const d = daysLeft(i.expiryDate); return d === null ? '未设置' : (i.expiryEstimate ? '预计' : '') + (d < 0 ? `已过期 ${-d} 天` : d === 0 ? '今天到期' : d === 1 ? '明天到期' : `${d} 天后到期`); }
export function validateDraft(d: ItemDraft) { if (!d.name.trim() || !d.unit.trim())
    throw new Error('请填写名称和单位'); if (!Number.isFinite(d.quantity) || d.quantity < 0 || !Number.isFinite(d.minimum) || d.minimum < 0)
    throw new Error('数量与最低库存必须是大于或等于 0 的有效数字'); if (d.expiryDate && d.purchaseDate && d.expiryDate < d.purchaseDate)
    throw new Error('到期日期不能早于购买日期'); if(d.expiryEstimate&&(d.expiryEstimate.date!==d.expiryDate||d.expiryEstimate.basisName!==d.name.trim()||d.expiryEstimate.basisLocation!==d.location.trim()||((!d.expiryEstimate.basisKind||d.expiryEstimate.basisKind==='purchase')&&d.purchaseDate&&d.expiryEstimate.basisDate!==d.purchaseDate)))throw new Error('估算条件已改变，请重新估算到期日'); }
export function addItem(s: Store, draft: ItemDraft, reason = '新增入库'): Store { validateDraft(draft); const time = new Date().toISOString(); const i: Item = { ...draft, name: draft.name.trim(), unit: draft.unit.trim(), location: draft.location.trim(), id: uid(), quantity: round(draft.quantity), createdAt: time, updatedAt: time }; return { ...s, items: [i, ...s.items], locations: !i.location || s.locations.includes(i.location) ? s.locations : [...s.locations, i.location], movements: [{ id: uid(), itemId: i.id, name: i.name, delta: i.quantity, unit: i.unit, reason, time }, ...s.movements] }; }
export function changeStock(s: Store, id: string, delta: number, reason: string): Store { const i = s.items.find(x => x.id === id); if (!i)
    throw new Error('物品已不存在，请刷新后重试'); if (!Number.isFinite(delta) || round(i.quantity + delta) < 0)
    throw new Error('使用量不能超过现有库存'); if (!delta)
    return s; const time = new Date().toISOString(); return { ...s, items: s.items.map(x => x.id === id ? { ...x, quantity: round(x.quantity + delta), updatedAt: time } : x), movements: [{ id: uid(), itemId: id, name: i.name, delta: round(delta), unit: i.unit, reason, time }, ...s.movements] }; }
export function editItem(s: Store, id: string, d: ItemDraft) { validateDraft(d); const old = s.items.find(i => i.id === id); if (!old)
    throw new Error('物品不存在'); if (old.unit !== d.unit && old.quantity !== d.quantity)
    throw new Error('请先单独保存单位变更，再调整数量'); let next = changeStock(s, id, d.quantity - old.quantity, '编辑库存'); next = { ...next, items: next.items.map(i => i.id === id ? { ...i, ...d, name: d.name.trim(), location:d.location.trim(), updatedAt: new Date().toISOString() } : i), locations: !d.location.trim() || next.locations.includes(d.location.trim()) ? next.locations : [...next.locations, d.location.trim()] }; return next; }
export const suggestion = (i: Item): Omit<ShoppingItem, 'id' | 'completed'> => ({ name: i.name, quantity: Math.max(1, round(i.minimum * 2 - i.quantity)), unit: i.unit, category: i.category, source: '低库存补货' });
export function addShopping(s: Store, entries: Omit<ShoppingItem, 'id' | 'completed'>[], merge = false) { let added = 0; const shopping = [...s.shopping]; for (const e of entries) {
    if (!e.name.trim() || !e.unit.trim() || !Number.isFinite(e.quantity) || e.quantity <= 0)
        throw new Error('请填写名称、单位以及大于 0 的采购数量');
    const index = shopping.findIndex(i => !i.completed && i.name.trim() === e.name.trim() && i.unit === e.unit);
    if (index >= 0) {
        if (merge) {
            shopping[index] = { ...shopping[index], quantity: round(shopping[index].quantity + e.quantity) };
            added++;
        }
    }
    else {
        shopping.unshift({ ...e, name: e.name.trim(), id: uid(), completed: false });
        added++;
    }
} return { store: { ...s, shopping }, added }; }
export function purchase(s: Store, shoppingId: string, quantity: number, location: string, expiryDate: string, expiryEstimate?: Item['expiryEstimate']) { const target = s.shopping.find(i => i.id === shoppingId && !i.completed); if (!target)
    throw new Error('该采购项已完成或不存在'); if (!Number.isFinite(quantity) || quantity <= 0)
    throw new Error('实际购买数量必须大于 0'); let next = addItem(s, { name: target.name, category: target.category, quantity, unit: target.unit, location, purchaseDate: today(), expiryDate, expiryEstimate, minimum: 1, notes: '采购清单入库' }, '采购入库'); next = { ...next, shopping: next.shopping.map(i => i.id === shoppingId ? { ...i, completed: true } : i) }; return next; }
export function updateShopping(s: Store, id: string, d: Pick<ShoppingItem, 'name' | 'unit' | 'quantity' | 'category'>): Store { if (!d.name.trim() || !d.unit.trim() || !Number.isFinite(d.quantity) || d.quantity <= 0)
    throw new Error('请填写有效的采购名称、单位和数量'); const current = s.shopping.find(i => i.id === id); if (!current)
    throw new Error('采购项不存在'); const duplicate = s.shopping.find(i => i.id !== id && !i.completed && i.name.trim() === d.name.trim() && i.unit.trim() === d.unit.trim()); if (duplicate)
    return { ...s, shopping: s.shopping.filter(i => i.id !== id).map(i => i.id === duplicate.id ? { ...i, quantity: round(i.quantity + d.quantity) } : i) }; return { ...s, shopping: s.shopping.map(i => i.id === id ? { ...i, ...d, name: d.name.trim(), unit: d.unit.trim() } : i) }; }
const mass: Record<string, number> = { '克': 1, 'g': 1, '千克': 1000, 'kg': 1000, '斤': 500, '公斤': 1000 };
const volume: Record<string, number> = { '毫升': 1, 'ml': 1, '升': 1000, 'L': 1000 };
export function conversion(from: string, to: string): number | null { if (from === to)
    return 1; for (const table of [mass, volume])
    if (table[from] && table[to])
        return table[from] / table[to]; return null; }
const nameAliases:Record<string,string>={'西红柿':'番茄','鲜香菇':'香菇','嫩豆腐':'豆腐','老豆腐':'豆腐','香干':'豆干','大蒜':'蒜','蒜瓣':'蒜','生姜':'姜','鲜虾仁':'虾仁','鲜虾':'虾'};
export function canonicalFoodName(name:string):string {return nameAliases[name.trim()]||name.trim();}
export function nameVariants(name:string):string[] {const canonical=canonicalFoodName(name);return [canonical,...Object.keys(nameAliases).filter(k=>nameAliases[k]===canonical)];}
export function ingredientStatus(s: Store, ingredient: Ingredient) { const batches = s.items.filter(i => canonicalFoodName(i.name) === canonicalFoodName(ingredient.name) && available(i)); let amount = 0; const incompatible: string[] = []; for (const i of batches) {
    const factor = conversion(i.unit, ingredient.unit);
    if (factor === null)
        incompatible.push(i.unit);
    else
        amount += i.quantity * factor;
} return { ...ingredient, available: round(amount), missing: round(Math.max(0, ingredient.quantity - amount)), uncertain: incompatible.length > 0, incompatible: [...new Set(incompatible)] }; }
export function cook(s: Store, ingredients: Ingredient[], name: string) { let next = s; for (const ing of ingredients) {
    if (!Number.isFinite(ing.quantity) || ing.quantity < 0)
        throw new Error('实际用量必须是非负数字');
    if (!ing.quantity)
        continue;
    const status = ingredientStatus(next, ing);
    if (status.missing > 0)
        throw new Error(`${ing.name} 库存不足，缺 ${status.missing} ${ing.unit}。可将实际用量改为 0，表示本次未从家庭库存取用。`);
    let remaining = ing.quantity;
    const batches = next.items.filter(i => canonicalFoodName(i.name) === canonicalFoodName(ing.name) && available(i) && conversion(i.unit, ing.unit) !== null).sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999'));
    for (const i of batches) {
        if (remaining <= 0)
            break;
        const factor = conversion(i.unit, ing.unit)!;
        const used = Math.min(i.quantity, remaining / factor);
        next = changeStock(next, i.id, -used, `烹饪 · ${name}`);
        remaining = round(remaining - used * factor);
    }
} return next; }
export function categoryFor(name: string): Category {
    if (/奶|果汁|可乐|茶饮|咖啡/.test(name)) return '饮料';
    if (/洗衣|洗洁|清洁/.test(name)) return '清洁用品';
    if (/牙膏|沐浴|洗发/.test(name)) return '洗护用品';
    if (/纸|垃圾袋|保鲜膜|保鲜袋/.test(name)) return '日用品';
    if (/食用油|橄榄油|花生油|玉米油|大豆油|生抽|老抽|酱油|盐|醋|蚝油|胡椒|香油|蒸鱼豉油|香醋|白糖|黑胡椒|辣酱|辣椒酱|豆瓣酱|豆板酱|黄豆酱|老干妈|腐乳|沙拉酱|番茄酱|芝麻酱|芥末|料酒|甜面酱|柱侯酱|排骨酱|叉烧酱|黄酱|面酱|拌饭酱|香菇酱|虾酱|鱼露|蒜蓉酱/.test(name)) return '调味品';
    if (/上海青|娃娃菜|油麦菜|西葫芦|长豆角|干辣椒|蒜薹|蒜|姜|葱|韭菜|莲藕|香干|瘦肉|五花肉|鸡块|丸子|洋葱|巴沙鱼|鲈鱼|虾皮|紫菜|木耳|蟹味菇|金针菇|丝瓜|白萝卜|四季豆|荷兰豆|山药|枇杷|山竹|荔枝|榴莲|杨梅|石榴|柿子|柚子|黄油|芝士|苹果|香蕉|番茄|西红柿|鸡蛋|鸭蛋|鹌鹑蛋|鸡胸肉|鸡肉|鸡腿|鸡翅|鸭肉|猪肉|牛肉|羊肉|排骨|鱼|虾|海鲜|青菜|菠菜|生菜|白菜|西兰花|芹菜|茄子|土豆|胡萝卜|黄瓜|香菇|蘑菇|豆腐|豆干|面条|大米|小米|包菜|燕麦|面包|吐司|玉米|豌豆|青椒|南瓜|红薯|橙子|橘子|柠檬|柚子|草莓|蓝莓|葡萄|梨|桃子|猕猴桃|牛油果|西瓜|冬瓜|银耳|红枣|花生|面粉|奶酪/.test(name)) return '食品';
    return '其他';
}
