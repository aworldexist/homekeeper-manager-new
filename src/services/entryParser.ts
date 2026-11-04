import { categoryFor, offsetDate, today } from '../domain';
import type { ItemDraft } from '../types';

export interface EntryParseResult { items:ItemDraft[]; warnings:string[] }
const amountPattern=/(\d+(?:\.\d+)?|[一二两三四五六七八九十百半]+)\s*(千克|公斤|毫升|盒|个|瓶|包|支|卷|克|斤|升|杯|块|根|袋|颗|只|条|罐|份|瓣|片|节|朵|勺|把|碗|桶|张|套|台|听|粒|提|枚)\s*/g;
function numberOf(raw:string):number {
    if (/^\d/.test(raw)) return Number(raw);
    if (raw==='半') return 0.5;
    const map:Record<string,number>={'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
    let value=0,part=0;
    for (const c of raw) { if(c==='十'||c==='百'){value+=(part||1)*(c==='十'?10:100);part=0;}else part=map[c]||0; }
    return value+part;
}
function resolveLocation(raw:string,locations:string[]):string {
    const normalized=raw.replace(/\s|·/g,'');
    const aliases:Record<string,string>={'阳台柜':'阳台清洁用品柜','冰箱冷藏室':'厨房冰箱冷藏室','冰箱冷冻室':'厨房冰箱冷冻室'};
    const exact=locations.find(l=>l.replace(/\s|·/g,'')===(aliases[normalized]||normalized));
    if(exact)return exact;
    const matches=locations.filter(l=>l.replace(/\s|·/g,'').endsWith(normalized));
    // Ambiguous short names remain the user's original text, never choose a room arbitrarily.
    return matches.length===1?matches[0]:raw.trim();
}
export function parseExpiry(text:string,now:Date):string {
    let m;
    if((m=text.match(/(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})日?\s*(?:号)?\s*到期/))){
        const d=new Date(+m[1],+m[2]-1,+m[3]);
        if(d.getFullYear()!==+m[1]||d.getMonth()!==+m[2]-1||d.getDate()!==+m[3])throw new Error('日期无效，请核对年月日。');
        return today(d);
    }
    if((m=text.match(/下个?月\s*(\d{1,2})\s*[号日]\s*到期/))){
        const d=new Date(now.getFullYear(),now.getMonth()+1,+m[1]);
        if(d.getDate()!==+m[1])throw new Error('下个月没有这一天，请手动确认日期。');
        return today(d);
    }
    if(/今天到期/.test(text))return today(now);
    if(/明天到期/.test(text))return offsetDate(1,now);
    if(/后天到期/.test(text))return offsetDate(2,now);
    if((m=text.match(/(\d+)\s*天后到期/)))return offsetDate(+m[1],now);
    return '';
}
function properties(text:string,locations:string[],now:Date){
    const loc=text.match(/(?:放(?:在|到)?|存放(?:在)?|收纳(?:在)?)\s*(.+?)(?=[，,、]|还有|另外|以及|最低库存|下个?月|\d{4}[-年/]|今天到期|明天到期|后天到期|\d+\s*天后到期|$)/)?.[1]?.trim().replace(/(?:都|全部|一起|统一|均)$/,'')||'';
    const min=text.match(/最低库存(?:设为|为|设成)?\s*(\d+(?:\.\d+)?|[一二两三四五六七八九十百半]+)\s*(?:千克|公斤|毫升|盒|个|瓶|包|支|卷|克|斤|升|杯|块|根|袋|颗|只|条|罐|份|瓣|片|节|朵|勺|把|碗|桶|张|套|台|听|粒|提|枚)?/);
    return {location:loc?resolveLocation(loc,locations):'',expiryDate:parseExpiry(text,now),minimum:min?numberOf(min[1]):undefined};
}
function remaining(clause:string,recognized:{token:string;name:string}[]):string {
    let value=clause;
    for(const r of recognized)value=value.replace(r.token+r.name,'');
    value=value.replace(/(?:都|全部|一起|统一|均)?(?:放(?:在|到)?|存放(?:在)?|收纳(?:在)?).+?(?=最低库存|下个?月|\d{4}[-年/]|今天到期|明天到期|后天到期|\d+\s*天后到期|$)/g,'');
    value=value.replace(/最低库存(?:设为|为|设成)?\s*(?:\d+(?:\.\d+)?|[一二两三四五六七八九十百半]+)\s*(?:千克|公斤|毫升|盒|个|瓶|包|支|卷|克|斤|升|杯|块|根|袋|颗|只|条|罐|份|瓣|片|节|朵|勺|把|碗|桶|张|套|台|听|粒|提|枚)?/g,'');
    value=value.replace(/(?:\d{4}[-年/]\d{1,2}[-月/]\d{1,2}日?号?|下个?月\s*\d{1,2}\s*[号日]|今天|明天|后天|\d+\s*天后)\s*到期/g,'');
    return value.replace(/我们|我|家里|今天|昨天|前天|刚刚|刚|新买了|买了|购买了|购买|购入|新增|添加|还买了|还有|另外|以及|并且|然后|都|全部|一起|统一|均|也|和|与|了|\s|[，,、]/g,'').trim();
}
export function parseEntryLocally(text:string,locations:string[],now=new Date()):EntryParseResult {
    if(!text.trim())throw new Error('请先描述要记入家里的物品。');
    const items:ItemDraft[]=[],warnings:string[]=[];
    for(const sentence of text.trim().split(/[。！？!；;\n]+/).filter(Boolean)){
        const matches=[...sentence.matchAll(new RegExp(amountPattern.source,'g'))].filter(m=>!/最低库存(?:设为|为|设成)?\s*$/.test(sentence.slice(0,m.index)));
        const recognized:{token:string;name:string}[]=[];
        const group:ItemDraft[]=[];
        for(let index=0;index<matches.length;index++){
            const m=matches[index];
            if(/[-负]/.test(sentence.charAt((m.index||0)-1)))throw new Error('录入数量不能为负数，请核对。');
            const tail=sentence.slice(m.index!+m[0].length,matches[index+1]?.index??sentence.length);
            const name=tail.split(/放|存放|收纳|最低库存|下个?月|\d{4}[-年/]|今天到期|明天到期|后天到期|\d+\s*天后到期|准备|打算|用于|用来|[，,、]|还有|另外|以及/)[0].replace(/(?:还买了|买了|以及|另外|还有|全部|一起|统一|都|均|和|与)+$/,'').trim();
            if(!name||/^\d|到期|库存/.test(name))continue;
            const meta=properties(tail,locations,now);
            const purchaseDate=/前天/.test(sentence)?offsetDate(-2,now):/昨天/.test(sentence)?offsetDate(-1,now):/今天|买|购/.test(sentence)?today(now):'';
            group.push({name,quantity:numberOf(m[1]),unit:m[2],category:categoryFor(name),location:meta.location,purchaseDate,expiryDate:meta.expiryDate,minimum:meta.minimum??0,notes:''});
            recognized.push({token:m[0],name});
        }
        // Only explicit "都/一起/统一" can propagate a location/date to earlier items.
        const shared=sentence.match(/(?:都|全部|一起|统一|均)(?:放|存放|收纳|在|下|于|\d|今天|明天|后天|最低).*/)?.[0];
        if(shared&&group.length>1){const meta=properties(shared,locations,now);for(const d of group){if(meta.location)d.location=meta.location;if(meta.expiryDate)d.expiryDate=meta.expiryDate;if(meta.minimum!==undefined)d.minimum=meta.minimum;}}
        for(const clause of sentence.split(/[，,、]|还有|另外|以及/).map(s=>s.trim()).filter(Boolean)){
            if(remaining(clause,recognized))warnings.push(/到期|保质/.test(clause)?`尚未确认「${clause}」中的日期，请使用明确年月日、明天或 N 天后到期，或手动填写。`:`暂未识别「${clause}」，请补充数量、单位或手动录入。`);
        }
        items.push(...group);
    }
    if(!items.length)throw new Error('暂时无法完整理解这段描述。试试“我今天买了3个苹果，2根香蕉”，或使用手动新增。');
    return {items,warnings:[...new Set(warnings)]};
}
