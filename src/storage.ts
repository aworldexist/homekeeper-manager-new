import { seedData } from './data';
import type { Store } from './types';
import { categories } from './types';
export const STORAGE_KEY = 'homekeeper.v1';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const string = (v: unknown) => typeof v === 'string';
const nonnegative = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const validEstimate=(e:unknown)=>e===undefined||(record(e)&&['date','basisDate','basisName','basisLocation','ruleLabel','source'].every(k=>string(e[k]))&&['room','fridge','freezer'].includes(e.storage as string)&&nonnegative(e.days)&&(String(e.source).startsWith('https://')||e.source==='./references/food-storage.xlsx'));
export function isStore(s: unknown): s is Store { if (!record(s) || s.version !== 1 || !Array.isArray(s.items) || !Array.isArray(s.locations) || !Array.isArray(s.shopping) || !Array.isArray(s.movements))
    return false; return s.locations.every(string) && s.items.every(i => record(i) && ['id', 'name', 'unit', 'location', 'purchaseDate', 'expiryDate', 'notes', 'createdAt', 'updatedAt'].every(k => string(i[k])) && nonnegative(i.quantity) && nonnegative(i.minimum) && validEstimate(i.expiryEstimate) && categories.includes(i.category as Store['items'][number]['category'])) && s.shopping.every(i => record(i) && ['id', 'name', 'unit', 'source'].every(k => string(i[k])) && nonnegative(i.quantity) && typeof i.completed === 'boolean' && categories.includes(i.category as Store['items'][number]['category'])) && s.movements.every(m => record(m) && ['id', 'itemId', 'name', 'unit', 'reason', 'time'].every(k => string(m[k])) && typeof m.delta === 'number' && Number.isFinite(m.delta)); }
export function loadStore(): {
    store: Store;
    error: string;
} { try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
        return { store: seedData(), error: '' };
    const s: unknown = JSON.parse(raw);
    if (!isStore(s))
        throw new Error();
    return { store: s, error: '' };
}
catch {
    return { store: seedData(), error: '本地数据无法读取，已载入临时演示数据。原始数据未覆盖，请先检查浏览器存储或主动重置。' };
} }
export function saveStore(s: Store) { try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
catch {
    throw new Error('浏览器存储不可用或空间不足，本次修改未保存。请释放空间后重试。');
} }
