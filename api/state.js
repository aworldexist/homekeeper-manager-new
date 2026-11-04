// 家庭数据读写接口：GET 读取，POST 保存。
// 前端（部署在 Vercel）只与本接口通信，由服务端转发到云数据库，从而绕开域名白名单限制。
import { cloudClient, TABLE, HOUSEHOLD_KEY, errorMessage } from '../server/cloudClient.js';

const db = () => cloudClient().database;

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
        if (req.method === 'GET') {
            const { data, error } = await db()
                .from(TABLE)
                .select('state, updated_at')
                .eq('household_key', HOUSEHOLD_KEY)
                .maybeSingle();
            if (error) return res.status(500).json({ error: errorMessage(error) });
            if (!data) return res.status(200).json({ state: null });
            return res.status(200).json({ state: data.state, updatedAt: data.updated_at });
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const state = body?.state;
            if (!state || typeof state !== 'object') return res.status(400).json({ error: '缺少待保存的数据' });

            const updated = await db()
                .from(TABLE)
                .update({ state, updated_at: new Date().toISOString() })
                .eq('household_key', HOUSEHOLD_KEY)
                .select('household_key');
            if (updated.error) return res.status(500).json({ error: errorMessage(updated.error) });

            if (Array.isArray(updated.data) && updated.data.length > 0) return res.status(200).json({ ok: true });

            const inserted = await db()
                .from(TABLE)
                .insert({ household_key: HOUSEHOLD_KEY, state })
                .select('household_key');
            if (inserted.error) return res.status(500).json({ error: errorMessage(inserted.error) });
            return res.status(200).json({ ok: true });
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (e) {
        return res.status(500).json({ error: errorMessage(e) });
    }
}
