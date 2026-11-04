import StartupReminder from './StartupReminder';
import {shouldShowReminders,muteRemindersToday,hasReminders,clearReminderMute} from './services/reminders';
import ExpiryField from './ExpiryField';
import RecipesPage from './RecipesPage';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { House, Package, Sparkles, Clock3, MapPin, ShoppingBasket, ChefHat, MessageCircle, Settings, Search, Plus, ArrowUpRight, ArrowRight, Leaf, Bell, ChevronRight, Check, Trash2, Pencil, History, X, SlidersHorizontal, Send, RefreshCw, AlertTriangle, Loader2, CheckCircle2, CalendarDays, LayoutGrid, List, Menu, WandSparkles, ShieldCheck, Heart, CircleHelp, Droplets } from 'lucide-react';
import type { Store, Item, ItemDraft, Page, ShoppingItem, Recipe, Ingredient, FlexibleIngredient } from './types';
import { categories } from './types';
import { uid, today, daysLeft, isLow, expiryText, validateDraft, addItem, editItem, changeStock, suggestion, addShopping, updateShopping, purchase, ingredientStatus, cook, round, canonicalFoodName } from './domain';
import { seedData, blankDraft } from './data';
import { loadStore, saveStore, STORAGE_KEY } from './storage';
import { fetchRemoteStore, pushRemoteStore } from './services/remoteStore';
import { intelligence, entryExamples, assistantExamples, toolsForAssistant } from './services/intelligence';
import { ItemPicture, IconFor, Status, Modal, Empty, SectionTitle, ItemForm, StockForm, ItemCard, PantryArt, DishArt } from './components';
const nav = [{ id: 'overview', label: '家庭概览', icon: House }, { id: 'items', label: '家庭物品', icon: Package }, { id: 'entry', label: '智能录入', icon: Sparkles }, { id: 'expiry', label: '保质期提醒', icon: Clock3 }, { id: 'locations', label: '收纳与寻物', icon: MapPin }, { id: 'shopping', label: '采购清单', icon: ShoppingBasket }, { id: 'recipes', label: '今日食谱', icon: ChefHat }, { id: 'assistant', label: '家庭小助手', icon: MessageCircle }] as const;
const titles: Record<Page, [
    string,
    string
]> = { overview: ['家庭概览', '照顾好家里的小事，就是认真生活。'], items: ['家庭物品', '每一份储备，都心中有数。'], entry: ['智能录入', '随口记一笔，家里的物品就安排好了。'], expiry: ['保质期提醒', '及时享用每一份新鲜，少一点浪费。'], locations: ['收纳与寻物', '给物品一个位置，也给生活一点秩序。'], shopping: ['采购清单', '出门前看一眼，刚刚好地买回家。'], recipes: ['今日食谱', '看看家里的食材，今天也好好吃饭。'], assistant: ['家庭小助手', '关于家里的小问题，随时聊一聊。'], settings: ['偏好与数据', '一个更懂你家的小管家。'] };
interface Chat {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    items?: Item[];
    action?: 'shopping' | 'recipes' | 'entry';
    confirmed?: boolean;
}
export default function App() {
    const [loaded] = useState(loadStore);
    const [store, setStore] = useState(loaded.store);
    const storeRef = useRef(store);
    const [storageError, setStorageError] = useState(loaded.error);
    const [syncState, setSyncState] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
    const [syncError, setSyncError] = useState('');
    const syncTimer = useRef<number | null>(null);
    const [page, setPage] = useState<Page>('overview');
    const [modal, setModal] = useState<ReactNode>(null);
    const [startupVisible,setStartupVisible]=useState(()=>!loaded.error&&shouldShowReminders(loaded.store));
    const [toast, setToast] = useState<{
        text: string;
        error: boolean;
    } | null>(null);
    const [mobileMenu, setMobileMenu] = useState(false);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('全部类别');
    const [location, setLocation] = useState('全部位置');
    const [status, setStatus] = useState('全部状态');
    const [sort, setSort] = useState('到期时间');
    const [view, setView] = useState('grid');
    const [entry, setEntry] = useState('');
    const [drafts, setDrafts] = useState<ItemDraft[]>([]);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState('');
    const [parseWarnings,setParseWarnings]=useState<string[]>([]);
    const [warningsAccepted,setWarningsAccepted]=useState(false);
    const [findQuery, setFindQuery] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [people, setPeople] = useState(2);
    const [prioritize, setPrioritize] = useState(true);
    const recentFoodNames=[...new Set(store.movements.filter(m=>m.delta>0&&['新增入库','智能录入','采购入库'].includes(m.reason)&&today(new Date(m.time))===today()).map(m=>store.items.find(i=>i.id===m.itemId)).filter((i):i is Item=>!!i&&['食品','饮料'].includes(i.category)&&i.quantity>0).map(i=>i.name))].slice(0,6);
    const [chatInput, setChatInput] = useState('');
    const [chat, setChat] = useState<Chat[]>([{ id: 'welcome', role: 'assistant', text: '你好，我是你家的生活小助手。找物品、查保质期、安排补货，或者想想今晚吃什么，都可以交给我。' }]);
    const [chatBusy, setChatBusy] = useState('');
    const chatEnd = useRef<HTMLDivElement>(null);
    useEffect(() => { if (!loaded.error) {
        try {
            if(localStorage.getItem(STORAGE_KEY)===null)saveStore(storeRef.current);
        }
        catch (e) {
            setStorageError((e as Error).message);
        }
    } }, [loaded]);
    useEffect(() => { let cancelled = false; (async () => { try {
        // 云端优先：任何设备打开同一网址，都读取同一份家庭数据。
        const remote = await fetchRemoteStore();
        if (cancelled)
            return;
        if (remote) {
            saveStore(remote);
            storeRef.current = remote;
            setStore(remote);
            setStorageError('');
        }
        else
            await pushRemoteStore(storeRef.current);
        setSyncState('saved');
        setSyncError('');
    }
    catch (e) {
        setSyncState('error');
        setSyncError((e as Error).message);
    } })(); return () => { cancelled = true; }; }, []);
    function scheduleSync(next: Store) { setSyncState('saving'); if (syncTimer.current)
        window.clearTimeout(syncTimer.current);
        syncTimer.current = window.setTimeout(() => { pushRemoteStore(next).then(() => { setSyncState('saved'); setSyncError(''); }).catch(e => { setSyncState('error'); setSyncError((e as Error).message); }); }, 350); }
    useEffect(() => { if (toast) {
        const id = setTimeout(() => setToast(null), 4500);
        return () => clearTimeout(id);
    } }, [toast]);
    useEffect(() => { if (page === 'assistant')
        chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [chat, chatBusy, page]);
    useEffect(() => { const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        setModal(null);
        setMobileMenu(false);
    } }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, []);
    function notify(text: string, error = false) { setToast({ text, error }); }
    function commit(transform: (s: Store) => Store, message?: string) { try {
        const next = transform(storeRef.current);
        if (storageError && loaded.error)
            throw new Error('本地数据读取异常。为保护原始数据，请先在设置中确认重置演示数据。');
        saveStore(next);
        storeRef.current = next;
        setStore(next);
        setStorageError('');
        scheduleSync(next);
        if (message)
            notify(message);
        return true;
    }
    catch (e) {
        notify((e as Error).message, true);
        return false;
    } }
    function go(p: Page) { setPage(p); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    function openItems(filter = '全部状态', search = '', loc = '全部位置') { setStatus(filter); setQuery(search); setCategory('全部类别'); setLocation(loc); go('items'); }
    function close() { setModal(null); }
    function dismissStartup(mute=false){try{if(mute)muteRemindersToday();else clearReminderMute();}catch(e){notify((e as Error).message,true);}setStartupVisible(false);}
    const low = store.items.filter(isLow), active = store.items.filter(i => i.quantity > 0), expired = active.filter(i => daysLeft(i.expiryDate)! < 0 && !!i.expiryDate), urgent = active.filter(i => i.expiryDate && daysLeft(i.expiryDate)! >= 0 && daysLeft(i.expiryDate)! <= 3), week = active.filter(i => i.expiryDate && daysLeft(i.expiryDate)! >= 4 && daysLeft(i.expiryDate)! <= 7), pending = store.shopping.filter(i => !i.completed);
    function itemForm(item?: Item) { setModal(<Modal title={item ? '编辑物品' : '添一件家物'} subtitle={item ? '修改这个批次的信息' : '记录小小的储备，让生活更有底。'} onClose={close}><ItemForm initial={item ? { ...item } : blankDraft()} locations={storeRef.current.locations} onCancel={close} onSave={d => { if (commit(s => item ? editItem(s, item.id, d) : addItem(s, d), item ? '物品已更新' : '物品已入库，家里又多一份储备'))
        close(); }}/></Modal>); }
    function stockModal(item: Item, mode: 'consume' | 'restock') { setModal(<Modal title={mode === 'consume' ? '记录使用' : '补充库存'} onClose={close}><StockForm item={item} mode={mode} onCancel={close} onSave={q => { if (!Number.isFinite(q) || q <= 0) {
        notify('请输入大于 0 的数量', true);
        return;
    } if (commit(s => changeStock(s, item.id, mode === 'consume' ? -q : q, mode === 'consume' ? '日常使用' : '补充库存'), '库存已更新'))
        close(); }}/></Modal>); }
    function removeItem(item: Item) { setModal(<Modal title={`删除「${item.name}」？`} subtitle="此操作会删除这个批次的物品，历史库存记录会保留。" onClose={close}><div className="notice warning"><AlertTriangle size={18}/>请确认已不再需要管理这个批次。</div><div className="modal-actions"><button className="button secondary" onClick={close}>保留物品</button><button className="button danger" onClick={() => { if (commit(s => ({ ...s, items: s.items.filter(i => i.id !== item.id) }), '物品已删除'))
        close(); }}>确认删除</button></div></Modal>); }
    function history(item: Item) { const records = storeRef.current.movements.filter(m => m.itemId === item.id); setModal(<Modal title={`${item.name} · 库存记录`} subtitle="每次增减，都有迹可循。" onClose={close}>{records.length ? <div className="history-list">{records.map(m => <div key={m.id}><span className={`history-dot ${m.delta < 0 ? 'out' : ''}`}><History size={15}/></span><div><strong>{m.reason}</strong><small>{new Date(m.time).toLocaleString('zh-CN')}</small></div><b className={m.delta < 0 ? 'text-orange' : 'text-green'}>{m.delta > 0 ? '+' : ''}{m.delta} {m.unit}</b></div>)}</div> : <Empty title="还没有变动记录" description="示例物品的初始数量为起点，后续每次库存变动都会记录在这里。"/>}</Modal>); }
    function viewItem(i: Item) { setModal(<Modal title={i.name} subtitle={`${i.category} · 独立批次`} onClose={close}><div className="detail-top"><ItemPicture item={i}/><div><strong className="detail-quantity">{i.quantity} <small>{i.unit}</small></strong><Status item={i}/></div></div><dl className="detail-grid"><dt>收纳位置</dt><dd>{i.location || '位置未设置'}</dd><dt>购买日期</dt><dd>{i.purchaseDate || '未设置'}</dd><dt>到期日期</dt><dd>{i.expiryDate || '未设置'}{i.expiryDate && ` · ${expiryText(i)}`}</dd><dt>最低库存</dt><dd>{i.minimum} {i.unit}</dd><dt>备注</dt><dd>{i.notes || '暂无备注'}</dd><dt>最近更新</dt><dd>{new Date(i.updatedAt).toLocaleString('zh-CN')}</dd></dl><div className="modal-actions"><button className="button secondary" onClick={() => history(i)}><History size={16}/>库存记录</button><button className="button primary" onClick={() => itemForm(i)}><Pencil size={16}/>编辑物品</button></div></Modal>); }
    function addSuggestions(items: Item[]) { const entries = items.map(suggestion); let count = 0; const saved = commit(s => { const r = addShopping(s, entries); count = r.added; return r.store; }); if (saved)
        notify(count ? `已将 ${count} 项加入采购清单` : '这些物品已在采购清单中，未重复添加'); return saved; }
    function addShopForm(existing?: ShoppingItem) { setModal(<Modal title={existing ? '编辑采购项' : '添加采购项'} subtitle="手动添加同名同单位项目时，数量会合并。" onClose={close}><ShoppingForm initial={existing} onCancel={close} onSave={d => { if (commit(s => existing ? updateShopping(s, existing.id, d) : addShopping(s, [{ ...d, source: '手动添加' }], true).store, '采购清单已更新'))
        close(); }}/></Modal>); }
    function purchaseModal(item: ShoppingItem) { setModal(<Modal title="买到了，放回家" subtitle="确认实际购买数量，位置和日期可稍后补充，会作为新批次入库。" onClose={close}><PurchaseForm item={item} locations={storeRef.current.locations} onCancel={close} onSave={(q, l, e,estimate) => { if (commit(s => purchase(s, item.id, q, l, e,estimate), '购买已完成，物品已入库'))
        close(); }}/></Modal>); }
    function addLocation() { setModal(<Modal title="给物品一个新位置" onClose={close}><LocationForm onCancel={close} onSave={(room, name) => { const full = `${room} · ${name.trim()}`; if (storeRef.current.locations.includes(full)) {
        notify('这个位置已经存在', true);
        return;
    } if (commit(s => ({ ...s, locations: [...s.locations, full] }), '收纳位置已添加'))
        close(); }}/></Modal>); }
    async function parse() { setParsing(true); setParseError(''); setParseWarnings([]); setDrafts([]); try {
        const result=await intelligence.parseEntry(entry,store.locations);setDrafts(result.items);setParseWarnings(result.warnings);setWarningsAccepted(false);
    }
    catch (e) {
        setParseError((e as Error).message);
    }
    finally {
        setParsing(false);
    } }
    function updateDraft(index:number,key:keyof ItemDraft,value:string|number){setDrafts(ds=>ds.map((d,i)=>{if(i!==index)return d;const next={...d,[key]:value};if(d.expiryEstimate&&['name','category','location','purchaseDate'].includes(key)&&d[key]!==value){next.expiryDate='';next.expiryEstimate=undefined;}return next;}));}
    function saveDrafts() { if (parseWarnings.length&&!warningsAccepted){notify('请先核对未识别的内容',true);return;} if (!drafts.length)
        return; try {
        drafts.forEach(validateDraft);
    }
    catch (e) {
        notify((e as Error).message, true);
        return;
    } if (commit(s => drafts.reduce((next, d) => addItem(next, d, '智能录入'), s), `已成功入库 ${drafts.length} 件物品`)) {
        setDrafts([]);
        setEntry('');
        go('items');
    } }
    const scaled = (r: Recipe) => r.ingredients.map(i => ({ ...i, quantity: round(i.quantity * people / 2) }));
    function addMissing(r: Recipe) { const missing = scaled(r).map(i => ingredientStatus(storeRef.current, i)).filter(i => i.missing > 0); if (!missing.length) {
        notify(r.flexibleIngredients?.length?'定量食材已备齐，未定量食材与调味请在做菜前核对':'食材都已备齐，无需采购');
        return;
    } let count = 0; if (commit(s => { const result = addShopping(s, missing.map(i => ({ name: i.name, quantity: i.missing, unit: i.unit, category: '食品', source: `食谱 · ${r.name}` }))); count = result.added; return result.store; }))
        notify(count ? `已添加 ${count} 项缺少食材` : '缺少的食材已在采购清单中'); }
    function cookModal(r: Recipe) { const ingredients = scaled(r); setModal(<Modal title={`记录烹饪 · ${r.name}`} subtitle="确认实际从家里取用的食材，将优先扣减较早到期的可用批次。" onClose={close}><CookForm ingredients={ingredients} flexible={r.flexibleIngredients||[]} store={storeRef.current} onCancel={close} onSave={actual => { if (commit(s => cook(s, actual, r.name), '用量已记录，好好享用这一餐'))
        close(); }}/></Modal>); }
    function recipeDetail(r: Recipe) { setModal(<Modal title={r.name} subtitle={`${r.minutes} 分钟 · ${people} 人份 · ${r.tags.join(' / ')}`} onClose={close} wide><DishArt recipe={r}/><h3 className="modal-section-heading">准备这些食材</h3><IngredientList ingredients={scaled(r)} store={storeRef.current}/><FlexibleList ingredients={r.flexibleIngredients||[]}/><p className="helper">“少许／几片”等用量不自动换算。可在做菜确认时填写实际取用数量，未填写的调味不会自动扣库存。另备常用油、水。</p>{r.tip&&<div className="notice recipe-tip"><Leaf size={16}/>{r.tip}</div>}<h3 className="modal-section-heading">跟着做，轻松开饭</h3><ol className="recipe-steps">{r.steps.map((s, i) => <li key={s}><span>{i + 1}</span>{s}</li>)}</ol><div className="notice"><ShieldCheck size={18}/>已过期食材不会用于推荐或扣减。浏览食谱不会改变库存。</div><div className="modal-actions"><button className="button secondary" onClick={() => addMissing(r)}><ShoppingBasket size={16}/>缺料加入采购</button><button className="button primary" onClick={() => cookModal(r)}><Check size={16}/>已做这道菜</button></div></Modal>); }
    async function ask(text = chatInput) { if (!text.trim() || chatBusy)
        return; setChatInput(''); setChat(c => [...c, { id: uid(), role: 'user', text: text.trim() }]); const intent = intelligence.recognize(text, [...new Set(storeRef.current.items.map(i => i.name))]); setChatBusy(intent.type === 'recipes' ? '正在搭配家里的食材…' : intent.type === 'low' ? '正在整理补货建议…' : '正在查询家庭库存…'); await new Promise(r => setTimeout(r, 650)); const s = storeRef.current; let answer: Omit<Chat, 'id' | 'role'>; if (intent.type === 'search') {
        const items = toolsForAssistant.searchItems(s, intent.query);
        const positions = new Set(items.map(i => i.location).filter(Boolean)).size;
        answer = { text: items.length ? `家里共剩 ${Object.entries(items.reduce<Record<string, number>>((sum, i) => ({ ...sum, [i.unit]: round((sum[i.unit] || 0) + i.quantity) }), {})).map(([unit, q]) => `${q} ${unit}`).join('、')}，分布在 ${positions} 个位置、${items.length} 个批次。请留意各批次的保质期：` : `没有找到「${intent.query}」，可以试试其他名称，或先记一笔。`, items, action: items.length ? undefined : 'entry' };
    }
    else if (intent.type === 'expiry') {
        const items = toolsForAssistant.getExpiringItems(s);
        answer = { text: items.length ? `这三天有 ${items.length} 个批次需要优先享用（含今天）。已过期的物品没有列入可用食材。` : '这三天没有即将到期的在库物品，安心过日子吧。', items };
    }
    else if (intent.type === 'low') {
        const items = toolsForAssistant.getLowStockItems(s);
        answer = { text: items.length ? `有 ${items.length} 个批次库存偏低，我整理了一份补货建议。确认后才会加入采购清单，已有的项目不会重复添加。` : '家里储备充足，暂时没有需要补货的物品。', items, action: items.length ? 'shopping' : undefined };
    }
    else if (intent.type === 'recipes') {
        const count = intelligence.recommend(s, { tags: ['清淡'], people: 2, prioritize: true }).length;
        answer = { text: `根据家里当前可用的食材，为你准备了 ${count} 道清淡家常菜，优先照顾临期食材。食材是否足量会在食谱里逐项标出。`, action: 'recipes' };
    }
    else
        answer = { text: '目前我可以帮你查询库存与位置、查看三天内临期物品、整理低库存采购建议，以及推荐家常菜。试试下方的示例，或直接手动录入物品。', action: 'entry' }; setChat(c => [...c, { ...answer, id: uid(), role: 'assistant' }]); setChatBusy(''); }
    function confirmChat(id: string) { const message = chat.find(c => c.id === id); if (!message || message.confirmed)
        return; const items = toolsForAssistant.getLowStockItems(storeRef.current); const fingerprint = (list: Item[]) => list.map(i => `${i.id}:${i.quantity}:${i.minimum}`).sort().join('|'); if (fingerprint(items) !== fingerprint(message.items || [])) {
        setChat(c => c.map(m => m.id === id ? { ...m, items, text: '库存已发生变化，补货建议已按当前数据更新。请再次确认后执行。' } : m));
        return;
    } if (!addSuggestions(items))
        return; setChat(c => c.map(m => m.id === id ? { ...m, confirmed: true, text: `已按最新库存处理补货建议。采购清单中已有的同名同单位项目没有重复添加。` } : m)); }
    const filtered = store.items.filter(i => i.name.includes(query.trim()) && (category === '全部类别' || i.category === category) && (location === '全部位置' || location==='位置未设置'&&!i.location || i.location === location) && (status === '全部状态' || status === '有库存' && i.quantity > 0 || status === '低库存' && isLow(i) || status === '已用完' && i.quantity === 0 || status === '已过期' && i.expiryDate && daysLeft(i.expiryDate)! < 0 && i.quantity > 0 || status === '临期' && i.expiryDate && daysLeft(i.expiryDate)! >= 0 && daysLeft(i.expiryDate)! <= 7 && i.quantity > 0 || status === '正常' && i.expiryDate && daysLeft(i.expiryDate)! > 7 && i.quantity > 0 || status === '未设置' && !i.expiryDate)).sort((a, b) => sort === '到期时间' ? (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999') : sort === '最近更新' ? b.updatedAt.localeCompare(a.updatedAt) : a.name.localeCompare(b.name, 'zh-CN'));
    const findName = findQuery.replace(/放在哪里|在哪里|放在哪|在哪|？|\?/g, '').trim();
    const found = store.items.filter(i => findName && i.name.includes(findName));
    return <div className="app-shell"><aside className={`sidebar ${mobileMenu ? 'open' : ''}`}><button className="brand" onClick={() => go('overview')}><span className="brand-mark"><House size={24}/><Leaf size={12}/></span><span><b>家物管家</b><small>HOME, WELL KEPT.</small></span></button><div className="house-switch"><span className="house-avatar"><House size={20}/></span><div><strong>我的温暖小家</strong><small>一起，把日子过好</small></div><ChevronRight size={15}/></div><span className="nav-label">我的家 · MY HOME</span><nav>{nav.map(n => <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)}><n.icon size={19}/><span>{n.label}</span>{n.id === 'expiry' && urgent.length + expired.length > 0 && <b className="nav-count">{urgent.length + expired.length}</b>}{n.id === 'entry' && <span className="new-tag">NEW</span>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-tip"><span><Leaf size={19}/></span><b>少一份浪费，多一份从容</b><p>让每一件家物，都恰到好处。</p></div><button className={`settings-link ${page === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}><Settings size={18}/>偏好与数据</button><div className="profile"><span>家</span><div><strong>生活收藏家</strong><small>认真生活的第 {Math.max(1, Math.floor((Date.now() - new Date(store.items.at(-1)?.createdAt || today()).getTime()) / 86400000) + 1)} 天</small></div><Heart size={16}/></div></div></aside>{mobileMenu && <div className="nav-scrim" onClick={() => setMobileMenu(false)}/>}
 <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="展开导航" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={22}/></button><House size={15}/><span>我的家</span><ChevronRight size={13}/><strong>{titles[page][0]}</strong></div><div className="topbar-right"><span className={`local-pill sync-${syncState}`} title={syncError || '数据已保存到云端数据库，任何设备打开都能看到'}><span />{syncState === 'loading' ? '正在连接云端…' : syncState === 'saving' ? '正在同步…' : syncState === 'error' ? '云端未连接' : '云端已同步'}</span><button className="notification icon-button" aria-label="查看保质期提醒" onClick={() => go('expiry')}><Bell size={19}/>{urgent.length > 0 && <i />}</button><span className="avatar">家</span></div></header>
 <main>{storageError && <div role="alert" className="storage-error"><AlertTriangle size={18}/>{storageError}<button onClick={() => go('settings')}>前往设置</button></div>}<div className="page-heading"><div><div className="eyebrow">{page === 'overview' ? 'A LITTLE ORDER, A LOT OF JOY' : 'LITTLE THINGS, BETTER LIVING'}</div><h1>{page === 'overview' ? '家有底，心从容。' : titles[page][0]}{page === 'overview' && <span className="heading-leaf"><Leaf size={28} strokeWidth={1.5}/></span>}</h1><p>{titles[page][1]}</p></div><div className="heading-actions">{page === 'overview' ? <div className="date-display"><CalendarDays size={16}/>{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</div> : page === 'items' ? <><button className="button secondary" onClick={() => go('entry')}><Sparkles size={16}/>智能录入</button><button className="button primary" onClick={() => itemForm()}><Plus size={17}/>新增物品</button></> : page === 'shopping' ? <button className="button primary" onClick={() => addShopForm()}><Plus size={17}/>添加采购</button> : page === 'locations' ? <button className="button primary" onClick={addLocation}><Plus size={17}/>新增位置</button> : null}</div></div>
 {page === 'overview' && <><section className="hero"><div className="hero-copy"><span className="hero-label"><span />家的小事，交给管家</span><h2>收好生活的琐碎，<br />留住日常的小美好。</h2><p>知道家里有什么，把每一份储备都用得刚刚好。</p><button className="button primary" onClick={() => go('entry')}><Plus size={17}/>记一笔家物<ArrowRight size={16}/></button></div><PantryArt /><div className="hero-note"><Leaf size={14}/>有序的家，松弛的生活</div></section>
 <section className="stats-grid">{[{ label: '在库物品', value: new Set(active.map(i => i.name)).size, unit: '种', icon: Package, note: '生活所需，妥帖安放', tone: 'green', action: () => openItems('有库存') }, { label: '即将到期', value: urgent.length + week.length, unit: '项', icon: Clock3, note: '7 天内到期，优先享用', tone: 'orange', action: () => openItems('临期') }, { label: '库存偏低', value: low.length, unit: '项', icon: SlidersHorizontal, note: '及时添补，安心不缺', tone: 'yellow', action: () => openItems('低库存') }, { label: '待采购', value: pending.length, unit: '项', icon: ShoppingBasket, note: '带上清单，刚好买齐', tone: 'blue', action: () => go('shopping') }].map(s => <button className="stat-card" key={s.label} onClick={s.action}><div className="stat-top"><span>{s.label}</span><span className={`stat-icon ${s.tone}`}><s.icon size={21}/></span></div><div className="stat-number">{s.value}<small>{s.unit}</small><ArrowUpRight size={18}/></div><p>{s.note}</p></button>)}</section>
 <div className="overview-columns"><section className="panel priority-panel"><SectionTitle title="这些家物，先照顾一下" subtitle="一点及时的关注，让生活少些浪费" action={<button className="text-button" onClick={() => go('expiry')}>查看全部<ArrowRight size={14}/></button>}/><div className="priority-tabs"><span className="selected">优先处理 <b>{expired.length + urgent.length}</b></span><button onClick={() => openItems('低库存')}>该补货了 <b>{low.length}</b></button></div><div className="priority-list">{[...expired, ...urgent].slice(0, 4).map(i => <div className="priority-row" key={i.id}><ItemPicture item={i}/><div className="priority-name"><button onClick={() => viewItem(i)}>{i.name}</button><span><MapPin size={12}/>{i.location || '位置未设置'}</span></div><div className="priority-status"><Status item={i}/><small>剩余 {i.quantity} {i.unit}</small></div><button className="icon-button" aria-label={`使用${i.name}`} onClick={() => stockModal(i, 'consume')}><ChevronRight size={18}/></button></div>)}{!expired.length && !urgent.length && <Empty title="家里的新鲜，都照顾得很好" description="暂时没有需要优先处理的临期物品。"/>}</div><div className="gentle-note"><Leaf size={15}/>临期先享用，过期请及时清理。</div></section><section className="panel quick-panel"><SectionTitle title="让日常，简单一点" subtitle="你需要的，都在这里"/><button className="quick-row" onClick={() => go('entry')}><span className="quick-icon green"><WandSparkles size={21}/></span><div><b>随口说，轻松记</b><small>一句话，批量录入新家物</small></div><ArrowUpRight size={17}/></button><button className="quick-row" onClick={() => go('locations')}><span className="quick-icon peach"><Search size={21}/></span><div><b>东西放哪儿了？</b><small>不翻箱倒柜，一搜就知道</small></div><ArrowUpRight size={17}/></button><button className="quick-row" onClick={() => go('recipes')}><span className="quick-icon yellow"><ChefHat size={21}/></span><div><b>今天，吃点什么</b><small>用现有食材，做一顿好饭</small></div><ArrowUpRight size={17}/></button><button className="quick-row" onClick={() => go('shopping')}><span className="quick-icon blue"><ShoppingBasket size={21}/></span><div><b>出门采购，不漏买</b><small>把家里需要的，一次带回家</small></div><ArrowUpRight size={17}/></button></section></div>
 <section className="location-preview"><SectionTitle title="每一处，都井井有条" subtitle="熟悉家里的每一个小角落" action={<button className="text-button" onClick={() => go('locations')}>所有位置<ArrowRight size={14}/></button>}/><div className="room-grid">{['厨房', '客厅', '卫生间', '阳台'].map((room, index) => <button className="room-card" key={room} onClick={() => { setFindQuery(''); go('locations'); }}><span className={`room-icon room-${index}`}>{index === 0 ? <ChefHat size={26}/> : index === 1 ? <House size={26}/> : index === 2 ? <Droplets size={26}/> : <Leaf size={26}/>}</span><div><strong>{room}</strong><p>{store.locations.filter(l => l.startsWith(room)).length} 个收纳位置 · {new Set(store.items.filter(i => i.location.startsWith(room) && i.quantity > 0).map(i => i.name)).size} 种物品</p></div><ChevronRight size={17}/></button>)}</div></section><div className="bottom-quote"><Leaf size={14}/> 把小日子，过成自己喜欢的样子。</div></>}
 {page === 'items' && <><section className="panel filters"><div className="search-field"><Search size={18}/><input aria-label="搜索物品名称" placeholder="找找家里的物品…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button className="icon-button" aria-label="清空搜索" onClick={() => setQuery('')}><X size={14}/></button>}</div><div className="filter-selects">{status === '低库存' && <button className="button secondary small" onClick={() => addSuggestions(filtered)}><ShoppingBasket size={14}/>加入采购清单</button>}<select aria-label="类别筛选" value={category} onChange={e => setCategory(e.target.value)}>{['全部类别', ...categories].map(c => <option key={c}>{c}</option>)}</select><select aria-label="位置筛选" value={location} onChange={e => setLocation(e.target.value)}>{['全部位置', '位置未设置', ...store.locations].map(c => <option key={c}>{c}</option>)}</select><select aria-label="状态筛选" value={status} onChange={e => setStatus(e.target.value)}>{['全部状态', '有库存', '正常', '临期', '已过期', '低库存', '已用完', '未设置'].map(c => <option key={c}>{c}</option>)}</select><button className="text-button" onClick={() => { setQuery(''); setCategory('全部类别'); setLocation('全部位置'); setStatus('全部状态'); }}>重置筛选</button></div></section><div className="list-toolbar"><p>共 <strong>{filtered.length}</strong> 个物品批次 <span>· 同名不同保质期分开记录</span></p><div><select aria-label="排序方式" value={sort} onChange={e => setSort(e.target.value)}>{['到期时间', '最近更新', '物品名称'].map(c => <option key={c}>{c}</option>)}</select><button className={`icon-button ${view === 'grid' ? 'selected' : ''}`} aria-label="卡片视图" onClick={() => setView('grid')}><LayoutGrid size={17}/></button><button className={`icon-button ${view === 'list' ? 'selected' : ''}`} aria-label="列表视图" onClick={() => setView('list')}><List size={18}/></button></div></div>{filtered.length ? <div className={`inventory-grid ${view === 'list' ? 'list-view' : ''}`}>{filtered.map(i => <ItemCard key={i.id} item={i} onView={() => viewItem(i)} onStock={m => stockModal(i, m)} onEdit={() => itemForm(i)} onDelete={() => removeItem(i)} onHistory={() => history(i)}/>)}</div> : <section className="panel"><Empty title="没有找到匹配的家物" description="试试其他关键词或筛选条件，也可以添一件新物品。" action={<button className="button primary" onClick={() => itemForm()}><Plus size={16}/>新增物品</button>}/></section>}</>}
 {page === 'entry' && <><section className="panel entry-panel"><span className="feature-icon"><Sparkles size={27}/></span><h2>买了什么？告诉我就好。</h2><p>用平常说话的方式，记下家里的新物品。</p><textarea aria-label="自然语言录入" placeholder="例如：买了 10 个鸡蛋放冰箱冷藏室，还有 2 瓶洗衣液放阳台柜。" value={entry} onChange={e => {setEntry(e.target.value);setDrafts([]);setParseWarnings([]);setParseError('');}} rows={4} maxLength={1000}/><div className="entry-bottom"><span><ShieldCheck size={15}/>信息会先预览，确认后才入库</span><button className="button primary" disabled={parsing || !entry.trim()} onClick={parse}>{parsing ? <Loader2 className="spin" size={17}/> : <Sparkles size={17}/>} {parsing ? '正在整理…' : '智能整理'}</button></div><div className="example-label">不知道怎么说？点一句试试</div><div className="entry-examples">{entryExamples.map((s, i) => <button key={s} disabled={parsing} onClick={() => { setEntry(s); setDrafts([]); setParseError('');setParseWarnings([]); }}><span>0{i + 1}</span>{s}<ArrowUpRight size={16}/></button>)}</div></section>{parseError && <div className="parse-error" role="alert"><AlertTriangle size={20}/><div><b>这句话还需要你帮个忙</b><p>{parseError}</p><button className="text-button" onClick={() => itemForm()}>手动新增物品<ArrowRight size={15}/></button></div></div>}{parseWarnings.length>0&&<div className="parse-error parse-warning"><AlertTriangle size={20}/><div><b>以下内容还没有录入</b>{parseWarnings.map(w=><p key={w}>{w}</p>)}<label className="acknowledge-warning"><input type="checkbox" checked={warningsAccepted} onChange={e=>setWarningsAccepted(e.target.checked)}/>我已核对，先保存已识别的物品，未识别内容暂不入库</label></div></div>}{drafts.length > 0 && <section className="panel preview-panel"><SectionTitle title={`整理好了 ${drafts.length} 件物品`} subtitle="核对名称与数量即可入库。位置、日期可留空，食品可点击估算到期日；最低库存默认为 0。"/><div className="table-scroll"><table className="preview-table"><thead><tr>{['物品名称', '类别', '数量', '单位', '收纳位置', '购买日期', '到期日期', '最低库存', ''].map((t, i) => <th key={i}>{t}</th>)}</tr></thead><tbody>{drafts.map((d, i) => <tr key={i}><td><input aria-label={`物品${i + 1}名称`} value={d.name} onChange={e => updateDraft(i, 'name', e.target.value)}/></td><td><select aria-label={`物品${i + 1}类别`} value={d.category} onChange={e => updateDraft(i, 'category', e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></td><td><input aria-label={`物品${i + 1}数量`} type="number" min="0" step="0.001" value={d.quantity} onChange={e => updateDraft(i, 'quantity', e.target.valueAsNumber)}/></td><td><input aria-label={`物品${i + 1}单位`} value={d.unit} onChange={e => updateDraft(i, 'unit', e.target.value)}/></td><td><input aria-label={`物品${i + 1}位置`} list="entry-locations" value={d.location} placeholder="选填，稍后补充" onChange={e => updateDraft(i, 'location', e.target.value)}/></td><td><input aria-label={`物品${i + 1}购买日期`} type="date" value={d.purchaseDate} onInput={e => updateDraft(i, 'purchaseDate', e.currentTarget.value)} onChange={e => updateDraft(i, 'purchaseDate', e.target.value)}/></td><td><ExpiryField compact draft={d} label={`物品${i+1}到期日期`} onChange={(date,estimate)=>setDrafts(ds=>ds.map((draft,n)=>n===i?{...draft,expiryDate:date,expiryEstimate:estimate}:draft))}/></td><td><input aria-label={`物品${i + 1}最低库存`} type="number" min="0" step="0.001" value={d.minimum} onChange={e => updateDraft(i, 'minimum', e.target.valueAsNumber)}/></td><td><button className="icon-button" aria-label={`移除物品${i + 1}`} onClick={() => setDrafts(ds => ds.filter((_, n) => n !== i))}><X size={16}/></button></td></tr>)}</tbody></table><datalist id="entry-locations">{store.locations.map(l => <option key={l}>{l}</option>)}</datalist></div><div className="modal-actions"><button className="button secondary" onClick={() => {setDrafts([]);setParseWarnings([]);setWarningsAccepted(false);}}>取消本次录入</button><button className="button primary" disabled={parseWarnings.length>0&&!warningsAccepted} onClick={saveDrafts}><Check size={16}/>确认并批量入库</button></div></section>}<div className="service-note"><CircleHelp size={16}/><span>演示模式：本地规则解析，支持逗号、顿号、连续数量与“还有”等表达。共享位置请明确说“都放在…”。日期以设备今天为基准，不确定的信息保留为空。</span></div></>}
 {page === 'expiry' && <><div className="notice reminder-notice"><Leaf size={20}/><span>把新鲜留在餐桌上。今天到期的食材仍可优先使用，请先自行检查实际状态。</span><button className="text-button" onClick={() => { setPrioritize(true); go('recipes'); }}>用临期食材做菜<ArrowRight size={15}/></button></div>{[{ title: '已过期', description: '请检查并及时清理，不会用于食谱推荐', items: expired, tone: 'red' }, { title: '3 天内到期', description: '包括今天到期，记得优先享用', items: urgent, tone: 'orange' }, { title: '4—7 天内到期', description: '给接下来的餐桌，提前做个安排', items: week, tone: 'green' }].map(group => <section className="panel expiry-group" key={group.title}><SectionTitle title={`${group.title} · ${group.items.length}`} subtitle={group.description}/>{group.items.length ? group.items.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).map(i => <div className="expiry-row" key={i.id}><ItemPicture item={i}/><div><button className="name-link" onClick={() => viewItem(i)}>{i.name}</button><small><MapPin size={12}/>{i.location || '位置未设置'}</small></div><div className={`expiry-days text-${group.tone}`}><b>{expiryText(i)}</b><small>{i.expiryDate}</small></div><span className="expiry-quantity">剩余 {i.quantity} {i.unit}</span><button className="button secondary small" onClick={() => stockModal(i, 'consume')}>{group.tone === 'red' ? '记录清理' : '记录使用'}</button>{group.tone !== 'red' && i.category === '食品' && <button className="icon-button" aria-label={`用${i.name}推荐食谱`} onClick={() => { setPrioritize(true); go('recipes'); }}><ChefHat size={20}/></button>}</div>) : <div className="inline-empty"><CheckCircle2 size={20}/>这个分组暂时没有物品，家里的新鲜照顾得很好。</div>}</section>)}</>}
 {page === 'locations' && <><section className="panel finder"><div className="feature-icon"><Search size={26}/></div><div><h2>家里的东西，放哪儿了？</h2><p>试试搜“洗衣液在哪里”，所有存放位置都会列出来。</p></div><div className="search-field"><Search size={18}/><input aria-label="寻物搜索" value={findQuery} onChange={e => setFindQuery(e.target.value)} placeholder="输入物品名称，或问问它在哪里…"/>{findQuery && <button className="icon-button" aria-label="清空寻物" onClick={() => setFindQuery('')}><X size={15}/></button>}</div></section>{findQuery && <section className="panel find-results"><SectionTitle title={`寻物结果 · ${found.length} 个批次`}/>{found.length ? found.map(i => <div className="find-row" key={i.id}><ItemPicture item={i}/><div><strong>{i.name}</strong><small>{i.quantity === 0 ? '已用完' : `剩余 ${i.quantity} ${i.unit}`} · {expiryText(i)}</small></div><b><MapPin size={15}/>{i.location || '位置未设置'}</b><button className="text-button" onClick={() => viewItem(i)}>查看<ChevronRight size={14}/></button></div>) : <Empty title="暂时没找到这件物品" description="试试更简短的物品名，或先将它录入家中。"/>}</section>}<div className="location-groups">{[...new Set(store.locations.map(l => l.split(' · ')[0]))].map(room => <section key={room}><h2><House size={19}/>{room}<span>{store.locations.filter(l => l.startsWith(room + ' · ') || l === room).length} 个位置</span></h2><div className="locations-grid">{store.locations.filter(l => l.startsWith(room + ' · ') || l === room).map(l => { const items = active.filter(i => i.location === l); return <button className="location-card" key={l} onClick={() => openItems('全部状态', '', l)}><span className="location-card-icon"><MapPin size={25}/></span><h3>{l.split(' · ')[1] || l}</h3><p><strong>{new Set(items.map(i => i.name)).size}</strong> 种在库物品</p><div className="location-names">{[...new Set(items.map(i => i.name))].slice(0, 3).join('、') || '这里还有空间，等待新家物'}{items.length > 3 ? '…' : ''}</div><ArrowUpRight size={19}/></button>; })}</div></section>)}</div></>}
 {page === 'shopping' && <><section className="shopping-summary"><span className="feature-icon"><ShoppingBasket size={28}/></span><div><h2>下一次出门，带上这张清单。</h2><p>还有 <b>{pending.length}</b> 项待采购，买到后记得确认入库。</p></div><button className="button secondary" onClick={() => addSuggestions(low)}><Plus size={16}/>一键补齐低库存</button></section><section className="panel shopping-panel"><SectionTitle title={`待采购 · ${pending.length}`} subtitle="建议添加会自动去重；手动添加同名同单位物品会合并数量。"/>{pending.length ? pending.map(i => <div className="shopping-row" key={i.id}><button className="purchase-check" aria-label={`标记已购买${i.name}`} onClick={() => purchaseModal(i)}><Check size={15}/></button><ItemPicture item={{ ...i }}/><div className="shopping-name"><strong>{i.name}</strong><small>{i.source}</small></div><b>{i.quantity} <small>{i.unit}</small></b><button className="button secondary small" onClick={() => purchaseModal(i)}>买到了</button><button className="icon-button" aria-label={`编辑采购${i.name}`} onClick={() => addShopForm(i)}><Pencil size={16}/></button><button className="icon-button" aria-label={`删除采购${i.name}`} onClick={() => commit(s => ({ ...s, shopping: s.shopping.filter(x => x.id !== i.id) }), '已移除采购项')}><Trash2 size={16}/></button></div>) : <Empty title="采购清单空空的，心里满满的" description="家里需要添补什么，随时记下来。" action={<button className="button primary" onClick={() => addShopForm()}><Plus size={16}/>添加采购</button>}/>}</section>{store.shopping.some(i => i.completed) && <section className="panel completed-panel"><SectionTitle title={`已购入 · ${store.shopping.filter(i => i.completed).length}`} subtitle="这些物品已经妥帖入库。"/>{store.shopping.filter(i => i.completed).map(i => <div className="completed-row" key={i.id}><CheckCircle2 size={17}/><span>{i.name}</span><small>已确认入库</small><button className="icon-button" aria-label={`删除已完成${i.name}`} onClick={() => commit(s => ({ ...s, shopping: s.shopping.filter(x => x.id !== i.id) }), '已移除完成记录，库存保留')}><Trash2 size={14}/></button></div>)}</section>}</>}
 {page === 'recipes' && <RecipesPage store={store} tags={tags} setTags={setTags} people={people} setPeople={setPeople} prioritize={prioritize} setPrioritize={setPrioritize} recentNames={recentFoodNames} onAddMissing={addMissing} onDetail={recipeDetail}/>}
 {page === 'assistant' && <div className="assistant-layout"><section className="panel chat-panel"><div className="chat-header"><span className="assistant-avatar"><Sparkles size={24}/></span><div><h2>家里的事，随时问我</h2><p><span className="online-dot"/>陪你打理生活的小细节</p></div><span className="badge green">演示模式</span></div><div className="chat-messages">{chat.map(m => <div className={`chat-message ${m.role}`} key={m.id}>{m.role === 'assistant' && <span className="message-avatar"><Sparkles size={16}/></span>}<div className="message-body"><p>{m.text}</p>{m.items && m.items.length > 0 && <div className="chat-items">{m.items.map(i => <button key={i.id} onClick={() => viewItem(storeRef.current.items.find(x => x.id === i.id) || i)}><ItemPicture item={i}/><span><b>{i.name}</b><small>{i.location || '位置未设置'}</small></span><strong>{m.action === 'shopping' ? `${suggestion(i).quantity} ${i.unit}（建议）` : `${i.quantity} ${i.unit}`}</strong>{m.action !== 'shopping' && <small className="chat-expiry">{expiryText(i)}</small>}</button>)}</div>}{m.action === 'shopping' && <button disabled={m.confirmed} className="button primary small" onClick={() => confirmChat(m.id)}>{m.confirmed ? <Check size={15}/> : <ShoppingBasket size={15}/>} {m.confirmed ? '已确认执行' : '确认加入采购清单'}</button>}{m.action === 'recipes' && <button className="button primary small" onClick={() => { setTags(['清淡']); setPrioritize(true); go('recipes'); }}>查看清淡食谱<ArrowRight size={15}/></button>}{m.action === 'entry' && <button className="button secondary small" onClick={() => go('entry')}>去记一笔<ArrowRight size={15}/></button>}</div></div>)}{chatBusy && <div className="chat-progress" role="status"><Loader2 size={16} className="spin"/>{chatBusy}</div>}<div ref={chatEnd}/></div><form className="chat-composer" onSubmit={e => { e.preventDefault(); void ask(); }}><input aria-label="向助手提问" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="问问家里的库存、位置，或今晚吃什么…" maxLength={300} disabled={!!chatBusy}/><button className="send-button" aria-label="发送问题" disabled={!!chatBusy || !chatInput.trim()}><Send size={19}/></button></form><div className="chat-disclaimer">本地规则演示 · 回答基于当前家庭数据 · 修改前请你确认</div></section><aside className="assistant-side"><section className="panel"><span className="feature-icon"><MessageCircle size={23}/></span><h3>可以这样问我</h3><div className="assistant-examples">{assistantExamples.map(t => <button disabled={!!chatBusy} onClick={() => void ask(t)} key={t}>{t}<ArrowUpRight size={15}/></button>)}</div></section><div className="assistant-note"><ShieldCheck size={21}/><b>家的数据，留在家里</b><p>无需账号或 API Key。当前使用本地意图识别与规则工具，不代表已经接入真实大模型。</p></div></aside></div>}
 {page === 'settings' && <><section className="panel settings-panel"><SectionTitle title="关于这个小管家" subtitle="把生活交给秩序，把数据留在设备。" action={<button className="button secondary small" onClick={()=>hasReminders(store)?setStartupVisible(true):notify('当前没有需要处理的提醒')}>查看当前家庭提醒</button>}/><div className="setting-row"><span className="feature-icon"><ShieldCheck size={23}/></span><div><h3>云端数据库</h3><p>数据保存在云端 PostgreSQL 数据库中，刷新页面不会丢失；换一台电脑或换一个浏览器打开同一个网址，看到的都是同一份家庭数据。</p>{syncError && <p className="helper">{syncError}</p>}</div><span className="badge green">{syncState === 'saved' ? '已同步' : syncState === 'saving' ? '同步中' : syncState === 'error' ? '未连接' : '连接中'}</span></div><div className="setting-row"><span className="feature-icon peach"><Sparkles size={23}/></span><div><h3>智能服务 · 演示模式</h3><p>录入、食谱与助手均使用可替换的本地规则服务，无需联网或 API Key。</p></div></div><div className="setting-row"><span className="feature-icon yellow"><RefreshCw size={23}/></span><div><h3>重置演示数据</h3><p>重新生成基于今天的示例物品，会清除当前物品、位置、采购清单和库存记录。</p></div><button className="button secondary" onClick={() => setModal(<Modal title="重新开始一份家的清单？" subtitle="所有当前数据将被清除并替换为新的演示数据，此操作无法撤销。" onClose={close}><div className="notice warning"><AlertTriangle size={18}/>示例日期会根据今天重新生成。</div><div className="modal-actions"><button className="button secondary" onClick={close}>保留当前数据</button><button className="button danger" onClick={() => { try {
        const next = seedData();
        saveStore(next);
        storeRef.current = next;
        setStore(next);
        setStorageError('');
        scheduleSync(next);
        setChat([{ id: uid(), role: 'assistant', text: '演示数据已经重置。我们重新把这个小家打理好吧。' }]);
        setDrafts([]);
        setEntry('');
        notify('演示数据已重置');
        close();
    }
    catch (e) {
        notify((e as Error).message, true);
    } }}>确认重置数据</button></div></Modal>)}>重置演示数据</button></div></section></>}
 </main><footer className="page-footer"><span>家物管家 <span>·</span> 好好收纳，好好生活</span><span><Leaf size={12}/>每一份家物，都值得被珍惜</span></footer></div><nav className="mobile-bottom">{nav.filter(n => ['overview', 'items', 'entry', 'shopping', 'assistant'].includes(n.id)).map(n => <button className={page === n.id ? 'active' : ''} key={n.id} onClick={() => go(n.id)}><n.icon size={21}/><span>{n.id === 'entry' ? '记一笔' : n.label.replace('家庭', '')}</span></button>)}</nav>{modal}{startupVisible&&<StartupReminder store={store} onDismiss={dismissStartup} onExpiry={mute=>{dismissStartup(mute);go('expiry');}} onItem={(item,mute)=>{dismissStartup(mute);viewItem(item);}} onShopping={(items,mute)=>{if(addSuggestions(items)){dismissStartup(mute);go('shopping');}}}/>}{toast && <div role="status" className={`toast ${toast.error ? 'error' : ''}`}>{toast.error ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>}<span>{toast.text}</span><button aria-label="关闭提示" onClick={() => setToast(null)}><X size={15}/></button></div>}</div>;
}
function ShoppingForm({ initial, onSave, onCancel }: {
    initial?: ShoppingItem;
    onSave: (d: Pick<ShoppingItem, 'name' | 'quantity' | 'unit' | 'category'>) => void;
    onCancel: () => void;
}) { const [d, setD] = useState({ name: initial?.name || '', quantity: initial?.quantity || 1, unit: initial?.unit || '个', category: initial?.category || '食品' }); return <form onSubmit={e => { e.preventDefault(); if (!d.name.trim() || !d.unit.trim() || !Number.isFinite(d.quantity) || d.quantity <= 0)
    return; onSave(d); }}><div className="form-grid"><label>采购物品<input autoFocus required maxLength={50} value={d.name} onChange={e => setD({ ...d, name: e.target.value })}/></label><label>类别<select value={d.category} onChange={e => setD({ ...d, category: e.target.value as Item['category'] })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>采购数量<input required type="number" min="0.001" step="0.001" value={d.quantity} onChange={e => setD({ ...d, quantity: e.target.valueAsNumber })}/></label><label>单位<input required value={d.unit} maxLength={12} onChange={e => setD({ ...d, unit: e.target.value })}/></label></div><div className="modal-actions"><button className="button secondary" type="button" onClick={onCancel}>取消</button><button className="button primary" type="submit">保存采购项</button></div></form>; }
function PurchaseForm({item,locations,onSave,onCancel}:{item:ShoppingItem;locations:string[];onSave:(q:number,l:string,e:string,estimate?:Item['expiryEstimate'])=>void;onCancel:()=>void}){
    const [q,setQ]=useState(item.quantity),[l,setL]=useState(''),[expiry,setExpiry]=useState('');
    const [estimate,setEstimate]=useState<Item['expiryEstimate']>();
    return <form onSubmit={e=>{e.preventDefault();onSave(q,l,expiry,estimate);}}><div className="stock-summary"><ItemPicture item={item}/><div><h3>{item.name}</h3><p>计划采购 {item.quantity} {item.unit}</p></div></div><div className="form-grid"><label className="span-2">实际购买数量（{item.unit}）<input autoFocus required type="number" min="0.001" step="0.001" value={q} onChange={e=>setQ(e.target.valueAsNumber)}/></label><label className="span-2">放在哪里（选填）<select value={l} onChange={e=>{setL(e.target.value);if(estimate){setEstimate(undefined);setExpiry('');}}}><option value="">位置未设置，稍后补充</option>{locations.map(loc=><option key={loc}>{loc}</option>)}</select></label><div className="span-2"><ExpiryField draft={{name:item.name,category:item.category,location:l,purchaseDate:today(),expiryDate:expiry,expiryEstimate:estimate}} label="到期日期（选填）" onChange={(date,estimated)=>{setExpiry(date);setEstimate(estimated);}}/></div></div><div className="modal-actions"><button className="button secondary" type="button" onClick={onCancel}>暂不入库</button><button className="button primary" type="submit"><Check size={16}/>确认购买并入库</button></div></form>;
}
function LocationForm({ onSave, onCancel }: {
    onSave: (room: string, name: string) => void;
    onCancel: () => void;
}) { const [room, setRoom] = useState('厨房'); const [name, setName] = useState(''); return <form onSubmit={e => { e.preventDefault(); if (name.trim())
    onSave(room, name); }}><div className="form-grid"><label>所属空间<select value={room} onChange={e => setRoom(e.target.value)}>{['厨房', '客厅', '卫生间', '阳台', '卧室', '其他'].map(r => <option key={r}>{r}</option>)}</select></label><label>位置名称<input autoFocus value={name} maxLength={30} onChange={e => setName(e.target.value)} required placeholder="例如：餐边柜"/></label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={onCancel}>取消</button><button type="submit" className="button primary">保存位置</button></div></form>; }
function IngredientList({ ingredients, store, compact = false }: {
    ingredients: Ingredient[];
    store: Store;
    compact?: boolean;
}) { return <div className={`ingredients ${compact ? 'compact' : ''}`}>{ingredients.map(ing => { const s = ingredientStatus(store, ing); return <div key={ing.name}><span>{s.missing === 0 ? <CheckCircle2 size={14} className="text-green"/> : <Plus size={14} className="text-orange"/>}<b>{ing.name}</b><small>{ing.quantity} {ing.unit}{ing.amountText&&<span className="unit-warning">原配方：{ing.amountText}，实际量需核对</span>}</small></span><span className={s.missing > 0 ? 'text-orange' : 'text-green'}>{s.missing > 0 ? `缺 ${s.missing} ${s.unit}` : '家里有'}{s.uncertain && <small className="unit-warning">{s.incompatible.join('、')}装需核对</small>}</span></div>; })}</div>; }
function FlexibleList({ingredients}:{ingredients:FlexibleIngredient[]}){return ingredients.length?<div className="flexible-list"><h3>按原食谱准备 · 用量待确认</h3>{ingredients.map(i=><div key={i.name}><b>{i.name}</b><span>{i.amountText}{i.role==='main'?' · 主要食材':''}</span></div>)}</div>:null;}
function CookForm({ingredients,flexible=[],store,onSave,onCancel}:{ingredients:Ingredient[];flexible?:FlexibleIngredient[];store:Store;onSave:(actual:Ingredient[])=>void;onCancel:()=>void}){
    const [actual,setActual]=useState(ingredients);
    const [extras,setExtras]=useState(flexible.map(i=>({...i,quantity:'',unit:store.items.find(item=>canonicalFoodName(item.name)===canonicalFoodName(i.name))?.unit||''})));
    return <form onSubmit={e=>{e.preventDefault();onSave([...actual,...extras.filter(i=>i.quantity!=='').map(i=>({name:i.name,quantity:Number(i.quantity),unit:i.unit.trim()}))]);}}><div className="notice">确认实际从家庭库存取用的数量。未取用可填 0；缺料需先入库。克、朵、瓣等无法换算时请按库存单位核对。</div><div className="cook-ingredients">{actual.map((i,index)=>{const status=ingredientStatus(store,i);return <label key={i.name}><span><b>{i.name}</b><small>可用 {status.available} {i.unit}{status.uncertain?' · 其他单位需核对':''}{i.amountText?' · 原配方：'+i.amountText:''}</small></span><input aria-label={i.name+'实际用量'} type="number" required min="0" max={status.available} step="0.001" value={i.quantity} onChange={e=>setActual(a=>a.map((ing,n)=>n===index?{...ing,quantity:e.target.valueAsNumber}:ing))}/><span>{i.unit}</span></label>;})}</div>{extras.length>0&&<div className="flexible-cook"><h3>其他食材与调味 · 选填实际用量</h3><p>原描述中的“少许”等不会自动扣减。填写数量与单位后才会校验并扣库存。</p>{extras.map((i,index)=><div key={i.name}><label>{i.name}<small>原配方：{i.amountText}</small><input aria-label={i.name+'补充实际用量'} type="number" min="0" step="0.001" value={i.quantity} placeholder="选填" onChange={e=>setExtras(es=>es.map((v,n)=>n===index?{...v,quantity:e.target.value}:v))}/></label><label>单位<input aria-label={i.name+'实际单位'} required={i.quantity!==''&&Number(i.quantity)>0} value={i.unit} placeholder="克／片…" onChange={e=>setExtras(es=>es.map((v,n)=>n===index?{...v,unit:e.target.value}:v))}/></label></div>)}</div>}<div className="modal-actions"><button className="button secondary" type="button" onClick={onCancel}>取消</button><button className="button primary" type="submit"><Check size={16}/>确认实际用量并扣减</button></div></form>;
}
