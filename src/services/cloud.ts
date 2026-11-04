import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk';
import { publicConfig } from './cloudConfig';
import { activeBackend } from './remoteConfig';
import type { StorageMode } from '../types';

export const cloud = createWorkBuddyCloud({
    endpoint: publicConfig.endpoint,
    oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
    publishableKey: publicConfig.publishableKey,
});

const MODEL_CACHE_KEY = 'homekeeper.ai.model.v2';
const REQUEST_TIMEOUT_MS = 45000;

function cachedModelId(): string | null {
    try { return localStorage.getItem(MODEL_CACHE_KEY); } catch { return null; }
}
function saveModelId(id: string): void {
    try { localStorage.setItem(MODEL_CACHE_KEY, id); } catch { /* 忽略存储失败，下次重新查询 */ }
}

async function resolveModel(): Promise<string> {
    const cached = cachedModelId();
    if (cached) return cached;
    const models = await cloud.llm.models.list();
    const usable = models.filter(m => m.disabled !== true);
    // 实测排序：hunyuan-chat 首字约 1.7s；default 首字 80s+；推理模型（auto 等）慢且易被输出上限截断。
    const preferred = ['hunyuan-chat', 'default'];
    const model = preferred.map(id => usable.find(m => m.id === id)).find(Boolean)
        ?? usable.find(m => m.supportsReasoning !== true && m.onlyReasoning !== true)
        ?? usable.find(m => m.onlyReasoning !== true)
        ?? usable[0];
    if (!model) throw new Error('当前没有可用的大模型，请稍后再试或手动填写日期。');
    saveModelId(model.id);
    return model.id;
}

// 通过本站服务端接口估算（Vercel 等外部域名使用）。
async function aiEstimateViaProxy(name: string, storage: StorageMode, todayStr: string): Promise<AiEstimate> {
    let res: Response;
    try {
        res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, storage, today: todayStr }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS + 15000),
        });
    } catch (e) {
        if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') {
            throw new Error('AI 估算超时，请重试一次或手动填写日期。');
        }
        throw new Error('无法连接 AI 估算服务，请检查网络后重试。');
    }
    const payload = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) throw new Error((payload as { error?: string }).error || 'AI 估算暂时失败，请重试或手动填写日期。');
    return parseAiAnswer(JSON.stringify(payload));
}

export interface AiEstimate { minDays: number; maxDays: number; note: string; }

const storageText: Record<StorageMode, string> = { room: '常温阴凉处', fridge: '冷藏（0—4°C）', freezer: '冷冻（−18°C）' };

function parseAiAnswer(answer: string): AiEstimate {
    let parsed: AiEstimate;
    try {
        parsed = JSON.parse(answer) as AiEstimate;
    } catch {
        throw new Error('AI 返回的内容无法解析，请重试或手动填写日期。');
    }
    if (!Number.isFinite(parsed.minDays) || !Number.isFinite(parsed.maxDays) || typeof parsed.note !== 'string' || parsed.minDays < 0 || parsed.maxDays < parsed.minDays) {
        throw new Error('AI 返回的估算数值无效，请重试或手动填写日期。');
    }
    return parsed;
}

// AI 兜底估算：仅用于参考表没有覆盖的食品。已知食品仍以参考表为准。
export async function aiEstimateExpiry(name: string, storage: StorageMode, todayStr: string): Promise<AiEstimate> {
    if (!name.trim()) throw new Error('请先填写食品名称。');
    // 外部域名（如 Vercel）走本站服务端代理，绕开云服务的来源域名校验。
    if (activeBackend() === 'proxy') return aiEstimateViaProxy(name.trim(), storage, todayStr);
    const model = await resolveModel();
    let answer = '';
    try {
        for await (const chunk of cloud.llm.chat.completions.create({
            model,
            stream: true,
            response_format: { type: 'json_object' },
            temperature: 0.2,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            messages: [
                { role: 'system', content: '你是家庭食品储存与食品安全助手。只依据通用的家庭食品安全常识估算保存期限，输出保守（偏短）的数值，不要编造精确数据。只输出 JSON，不要输出任何其他文字。' },
                { role: 'user', content: `请估算「${name}」在${storageText[storage]}下的保存期限。今天是 ${todayStr}。输出 JSON：{"minDays":整数,"maxDays":整数,"note":"不超过60字的依据说明"}。minDays/maxDays 是从今天起算的天数，maxDays 不超过 365。若该物品不适合此储存方式，输出 {"minDays":0,"maxDays":0,"note":"说明原因"}。` },
            ],
        })) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) answer += delta.content;
        }
    } catch (e) {
        if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') {
            throw new Error('AI 估算超时（45 秒无响应），网络或模型服务可能较慢，请重试一次或手动填写日期。');
        }
        const code = (e as { error?: { code?: string } }).error?.code || '';
        if (code.startsWith('quota_')) throw new Error('AI 估算额度已用完，请手动填写日期。');
        if (code.startsWith('auth_')) throw new Error('AI 服务暂不可用（鉴权失败），请手动填写日期。');
        if (code.startsWith('request_')) {
            // 单个模型参数不兼容时清除缓存，下次重新选择模型。
            try { localStorage.removeItem(MODEL_CACHE_KEY); } catch { /* 忽略 */ }
            throw new Error('AI 请求参数有误，请再试一次或手动填写日期。');
        }
        throw new Error('AI 估算暂时失败，请重试或手动填写日期。');
    }
    if (!answer.trim()) throw new Error('AI 没有返回内容，请重试或手动填写日期。');
    return parseAiAnswer(answer);
}
