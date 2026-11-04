import { parseEntryLocally, type EntryParseResult } from './entryParser';
import { categoryFor, daysLeft, isLow, offsetDate, today, nameVariants } from '../domain';
import { recipes } from '../data';
import { ingredientStatus, canonicalFoodName } from '../domain';
import type { ItemDraft, Store, Recipe } from '../types';
export const entryExamples = ['今天买了 6 盒牛奶，放在厨房储物柜，下个月 15 号到期。', '买了 10 个鸡蛋放冰箱冷藏室，还有 2 瓶洗衣液放阳台柜。', '新增 3 包抽纸，放客厅储物柜，最低库存设为 2 包。', '我今天买了3个苹果，2根香蕉'];
export interface RecipeOptions {
    tags: string[];
    people: number;
    prioritize: boolean;
    mode?: 'recommended' | 'all';
    query?: string;
    section?:string;
    limit?: number;
    freshNames?: string[];
}
export type Intent = {
    type: 'search';
    query: string;
} | {
    type: 'expiry';
} | {
    type: 'low';
} | {
    type: 'recipes';
} | {
    type: 'unsupported';
};
export interface IntelligenceService {
    parseEntry(text: string, locations: string[], now?: Date): Promise<EntryParseResult>;
    recommend(s:Store,options:RecipeOptions):Recipe[];
    recognize(text: string, known?: string[]): Intent;
}
const pause = () => new Promise(r => setTimeout(r, 500));
export const localIntelligence: IntelligenceService = {
    async parseEntry(text,locations,now=new Date()) { await pause(); return parseEntryLocally(text,locations,now); },
    recommend(s,options) {
        const query=(options.query||'').trim();
        const pool=recipes.filter(r=>(options.tags.length===0||options.tags.some(t=>r.tags.includes(t)))&&(!options.section||options.section==='全部分类'||(r.section||'原有搭配')===options.section)&&(!query||r.name.includes(query)||r.aliases?.some(n=>n.includes(query))||r.ingredients.some(i=>i.name.includes(query))||r.flexibleIngredients?.some(i=>i.name.includes(query))));
        const score=(r:Recipe)=>r.ingredients.reduce((sum,ing)=>{
            const status=ingredientStatus(s,{...ing,quantity:ing.quantity*options.people/2});
            const urgent=s.items.some(i=>canonicalFoodName(i.name)===canonicalFoodName(ing.name)&&i.quantity>0&&!!i.expiryDate&&daysLeft(i.expiryDate)!>=0&&daysLeft(i.expiryDate)!<=3);
            const fresh=options.freshNames?.some(n=>canonicalFoodName(n)===canonicalFoodName(ing.name))&&status.available>0;
            return sum+(status.missing===0?4:status.available>0?2:0)+(options.prioritize&&urgent?3:0)+(fresh?10:0);
        },0)/r.ingredients.length;
        const ranked=[...pool].sort((a,b)=>score(b)-score(a)||a.minutes-b.minutes);
        if(options.mode==='all')return ranked;
        const matched=ranked.filter(r=>r.ingredients.some(i=>ingredientStatus(s,i).available>0));
        return (matched.length?matched:ranked).slice(0,options.limit??4);
    },
    recognize(text, known = []) { if (/加入.*采购|补货|采购.*快用完/.test(text) && /快用完|低库存|不足|补货/.test(text))
        return { type: 'low' }; if (/到期|过期|临期/.test(text))
        return { type: 'expiry' }; if (/吃|做.*菜|菜谱|食谱/.test(text))
        return { type: 'recipes' }; if (/多少|在哪|在哪里|找|还有|剩/.test(text)) {
        const names = known.length ? known : ['牛奶', '洗衣液', '鸡蛋', '抽纸', '番茄', '鸡胸肉', '牙膏', '青菜', '大米', '酸奶', '面条', '洗洁精', '垃圾袋'];
        // Longest name wins so 「鲜牛奶」 is not matched as 「牛奶」 by accident.
        const sorted = [...names].sort((a, b) => b.length - a.length);
        const name = sorted.find(n => nameVariants(n).some(v => text.includes(v)));
        const query = name || text.replace(/家里|还有|还剩|多少|放在哪里|放在哪|在哪里|在哪|找一下|找|吗|？|\?/g, '').trim();
        return query ? { type: 'search', query } : { type: 'unsupported' };
    } return { type: 'unsupported' }; }
};
export const intelligence = localIntelligence;
export const assistantExamples = ['家里还有多少牛奶？', '洗衣液放在哪里？', '这三天有什么快过期了？', '把快用完的东西加入采购清单。', '今晚想吃清淡一点，家里能做什么？'];
export const toolsForAssistant = { searchItems: (s: Store, q: string) => s.items.filter(i => i.name.includes(q)), getExpiringItems: (s: Store) => s.items.filter(i => i.quantity > 0 && i.expiryDate && daysLeft(i.expiryDate)! >= 0 && daysLeft(i.expiryDate)! <= 3), getLowStockItems: (s: Store) => s.items.filter(isLow) };
