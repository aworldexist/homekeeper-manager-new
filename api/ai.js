// AI 保质期估算接口（服务端代理）。仅在参考表未覆盖该物品时由前端调用。
import { cloudClient } from '../server/cloudClient.js';

// 大模型首字延迟波动较大，给足函数执行时间（Vercel 上限 60 秒）。
export const config = { maxDuration: 60 };

const storageText = {
    room: '常温阴凉处',
    fridge: '冷藏（0—4°C）',
    freezer: '冷冻（−18°C）',
};

const PREFERRED_MODELS = ['hunyuan-chat', 'default'];
const TIMEOUT_MS = 45000;

let cachedModel = '';

// 实测：hunyuan-chat 首字约 1.7 秒；default 首字 80 秒以上；推理模型（auto 路由）会被思考过程吃光输出额度。
async function resolveModel() {
    if (cachedModel) return cachedModel;
    const models = await cloudClient().llm.models.list();
    const usable = models.filter(m => m.disabled !== true);
    const model = PREFERRED_MODELS.map(id => usable.find(m => m.id === id)).find(Boolean)
        ?? usable.find(m => m.supportsReasoning !== true && m.onlyReasoning !== true)
        ?? usable.find(m => m.onlyReasoning !== true)
        ?? usable[0];
    if (!model) throw new Error('当前没有可用的大模型');
    cachedModel = model.id;
    return cachedModel;
}

function valid(answer) {
    try {
        const parsed = JSON.parse(answer);
        if (!Number.isFinite(parsed.minDays) || !Number.isFinite(parsed.maxDays)) return null;
        if (parsed.minDays < 0 || parsed.maxDays < parsed.minDays) return null;
        if (typeof parsed.note !== 'string') return null;
        return parsed;
    } catch {
        return null;
    }
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const name = String(body?.name || '').trim();
        const storage = body?.storage === 'fridge' || body?.storage === 'freezer' ? body.storage : 'room';
        const todayStr = String(body?.today || new Date().toISOString().slice(0, 10));
        if (!name) return res.status(400).json({ error: '请先填写食品名称。' });

        const model = await resolveModel();
        let answer = '';
        for await (const chunk of cloudClient().llm.chat.completions.create({
            model,
            stream: true,
            response_format: { type: 'json_object' },
            temperature: 0.2,
            signal: AbortSignal.timeout(TIMEOUT_MS),
            messages: [
                { role: 'system', content: '你是家庭食品储存与食品安全助手。只依据通用的家庭食品安全常识估算保存期限，输出保守（偏短）的数值，不要编造精确数据。只输出 JSON，不要输出任何其他文字。' },
                { role: 'user', content: `请估算「${name}」在${storageText[storage]}下的保存期限。今天是 ${todayStr}。输出 JSON：{"minDays":整数,"maxDays":整数,"note":"不超过60字的依据说明"}。minDays/maxDays 是从今天起算的天数，maxDays 不超过 365。若该物品不适合此储存方式，输出 {"minDays":0,"maxDays":0,"note":"说明原因"}。` },
            ],
        })) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) answer += delta.content;
        }

        const parsed = valid(answer);
        if (!parsed) {
            cachedModel = ''; // 换一个模型重试更可靠
            return res.status(502).json({ error: 'AI 返回的内容无法解析，请重试或手动填写日期。' });
        }
        return res.status(200).json(parsed);
    } catch (e) {
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
            return res.status(504).json({ error: 'AI 估算超时（45 秒无响应），请重试一次或手动填写日期。' });
        }
        const code = e?.error?.code || '';
        if (String(code).startsWith('quota_')) return res.status(429).json({ error: 'AI 估算额度已用完，请手动填写日期。' });
        cachedModel = '';
        return res.status(500).json({ error: e?.message || 'AI 估算暂时失败，请重试或手动填写日期。' });
    }
}
