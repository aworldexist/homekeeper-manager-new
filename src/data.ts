import { userRecipes } from './userRecipes';
import { extraRecipes } from './recipeLibrary';
import { offsetDate, today, uid, categoryFor } from './domain';
import type { Store, Recipe } from './types';
export const defaultLocations = ['厨房 · 冰箱冷藏室', '厨房 · 冰箱冷冻室', '厨房 · 调味架', '厨房 · 储物柜', '客厅 · 电视柜', '客厅 · 储物柜', '卫生间 · 洗手台下柜', '阳台 · 清洁用品柜'];
export function seedData(): Store { const specs: [
    string,
    number,
    string,
    number,
    number | null,
    number
][] = [['牛奶', 3, '盒', 0, 2, 2], ['牛奶', 6, '盒', 3, 24, 2], ['鸡蛋', 8, '个', 0, 9, 5], ['番茄', 3, '个', 0, 1, 2], ['青菜', 300, '克', 0, 0, 100], ['鸡胸肉', 500, '克', 1, 6, 200], ['面条', 600, '克', 3, 120, 200], ['大米', 2.5, '千克', 3, 180, 1], ['酸奶', 2, '杯', 0, -2, 2], ['生抽', 0.5, '瓶', 2, 90, 1], ['食用油', 1, '升', 2, 200, 0.5], ['洗衣液', 0.5, '瓶', 7, null, 1], ['洗洁精', 1, '瓶', 2, null, 1], ['抽纸', 2, '包', 5, null, 3], ['牙膏', 0, '支', 6, null, 1], ['垃圾袋', 3, '卷', 5, null, 2], ['豆腐', 1, '块', 0, 3, 1], ['土豆', 4, '个', 3, 15, 2], ['胡萝卜', 2, '根', 0, 5, 1], ['黄瓜', 2, '根', 0, 2, 1], ['香菇', 200, '克', 0, 4, 100], ['洗衣液', 2, '瓶', 6, null, 1], ['燕麦片', 400, '克', 3, 60, 100], ['盐', 300, '克', 2, null, 100]]; const time = new Date().toISOString(); return { version: 1, locations: defaultLocations, shopping: [{ id: uid(), name: '牙膏', quantity: 2, unit: '支', category: '洗护用品', source: '手动添加', completed: false }, { id: uid(), name: '水果', quantity: 1, unit: '份', category: '食品', source: '手动添加', completed: false }], items: specs.map(([name, quantity, unit, loc, expiry, minimum]) => ({ id: uid(), name, quantity, unit, location: defaultLocations[loc], expiryDate: expiry === null ? '' : offsetDate(expiry), purchaseDate: offsetDate(-5), minimum, category: categoryFor(name), notes: '', createdAt: time, updatedAt: time })), movements: [] }; }
export const blankDraft = () => ({ name: '', category: '食品' as const, quantity: 1, unit: '个', location: '', purchaseDate: today(), expiryDate: '', minimum: 1, notes: '' });
const originalRecipes: Recipe[] = [
    { id: 'tomato-egg', name: '番茄炒鸡蛋', minutes: 12, tags: ['快手菜', '高蛋白'], ingredients: [{ name: '番茄', quantity: 2, unit: '个' }, { name: '鸡蛋', quantity: 3, unit: '个' }], steps: ['番茄切块，鸡蛋打散。', '热锅少油，炒熟鸡蛋后盛出。', '炒软番茄，放回鸡蛋，加少许盐翻匀。'], color: '#e5a275', kind: 'stir' },
    { id: 'greens', name: '香菇炒青菜', minutes: 10, tags: ['快手菜', '清淡'], ingredients: [{ name: '青菜', quantity: 300, unit: '克' }, { name: '香菇', quantity: 150, unit: '克' }], steps: ['青菜洗净，香菇切片。', '少油煸香香菇，加入青菜翻炒。', '加少许盐和水，炒至断生。'], color: '#8caa6d', kind: 'salad' },
    { id: 'chicken', name: '香煎鸡胸肉', minutes: 20, tags: ['高蛋白', '清淡'], ingredients: [{ name: '鸡胸肉', quantity: 300, unit: '克' }, { name: '黄瓜', quantity: 1, unit: '根' }], steps: ['鸡胸肉切薄片，以少许盐腌制。', '平底锅薄油，两面煎至全熟。', '黄瓜切片，搭配鸡胸肉装盘。'], color: '#d4b17a', kind: 'salad' },
    { id: 'soup', name: '番茄豆腐汤', minutes: 15, tags: ['快手菜', '清淡', '高蛋白'], ingredients: [{ name: '番茄', quantity: 1, unit: '个' }, { name: '豆腐', quantity: 1, unit: '块' }, { name: '鸡蛋', quantity: 1, unit: '个' }], steps: ['番茄、豆腐切块。', '番茄炒软，加水煮开，加入豆腐。', '淋入蛋液，煮熟后加少许盐。'], color: '#e0a17f', kind: 'soup' },
    { id: 'noodle', name: '青菜鸡蛋面', minutes: 15, tags: ['快手菜', '清淡'], ingredients: [{ name: '面条', quantity: 200, unit: '克' }, { name: '青菜', quantity: 150, unit: '克' }, { name: '鸡蛋', quantity: 2, unit: '个' }], steps: ['水煮开，下入面条。', '加入青菜和鸡蛋，煮至全熟。', '用少许生抽、盐调味。'], color: '#cbb58b', kind: 'noodle' },
    { id: 'rice', name: '田园蔬菜炒饭', minutes: 18, tags: ['快手菜'], ingredients: [{ name: '大米', quantity: 150, unit: '克' }, { name: '鸡蛋', quantity: 2, unit: '个' }, { name: '胡萝卜', quantity: 1, unit: '根' }, { name: '豌豆', quantity: 80, unit: '克' }], steps: ['提前将大米煮熟，胡萝卜切丁。', '炒熟鸡蛋，加入蔬菜翻炒。', '加入米饭，炒散后调味。'], color: '#c4a66b', kind: 'rice' },
    { id: 'potato', name: '清炒土豆丝', minutes: 15, tags: ['快手菜', '清淡'], ingredients: [{ name: '土豆', quantity: 2, unit: '个' }, { name: '青椒', quantity: 1, unit: '个' }], steps: ['土豆切丝，清水冲洗淀粉。', '青椒切丝，热锅少油。', '下土豆丝炒熟，加入青椒和少许盐。'], color: '#c7b275', kind: 'stir' },
    { id: 'chicken-rice', name: '香菇鸡肉焖饭', minutes: 35, tags: ['高蛋白'], ingredients: [{ name: '鸡胸肉', quantity: 250, unit: '克' }, { name: '香菇', quantity: 100, unit: '克' }, { name: '大米', quantity: 200, unit: '克' }, { name: '胡萝卜', quantity: 1, unit: '根' }], steps: ['鸡肉、香菇和胡萝卜切丁。', '米淘洗后加入平时煮饭的水量。', '放入全部食材及少许生抽，焖至米饭和鸡肉熟透。'], color: '#ba9a77', kind: 'rice' },
    { id: 'oat', name: '牛奶燕麦粥', minutes: 8, tags: ['快手菜', '清淡'], ingredients: [{ name: '牛奶', quantity: 400, unit: '毫升' }, { name: '燕麦片', quantity: 100, unit: '克' }, { name: '香蕉', quantity: 1, unit: '根' }], steps: ['牛奶与燕麦片小火煮至浓稠。', '香蕉切片。', '关火装碗，搭配香蕉食用。'], color: '#cbb69c', kind: 'soup' },
    ...extraRecipes
];

const importedIds=new Set(userRecipes.map(r=>r.id));
export const recipes:Recipe[]=[...originalRecipes.filter(r=>!importedIds.has(r.id)),...userRecipes];
