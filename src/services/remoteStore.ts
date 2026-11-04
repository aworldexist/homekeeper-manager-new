import { cloud } from './cloud';
import { isStore } from '../storage';
import { activeBackend } from './remoteConfig';
import type { Store } from '../types';

// 云端唯一的家庭数据集。任何设备打开同一个网址，读写的都是这一份数据。
const TABLE = 'household_state';
const HOUSEHOLD_KEY = 'home';
// SDK 的 database 客户端在未生成表类型时把写入参数推断为 never，这里按 supabase 风格放开类型。
const db = cloud.database as any;

function toMessage(e: unknown): string {
    const err = e as { message?: string; error?: { error_description?: string; description?: string } };
    const detail = err?.error?.error_description || err?.error?.description || '';
    if (/origin is not allowed/i.test(detail)) return '当前网址不在云服务的允许名单内，数据无法保存。';
    return err?.message || detail || '云端保存失败，请检查网络后重试。';
}

/* ---------- 直连云数据库（localhost / WorkBuddy 域名） ---------- */

async function cloudFetch(): Promise<Store | null> {
    const { data, error } = await db
        .from(TABLE)
        .select('state, updated_at')
        .eq('household_key', HOUSEHOLD_KEY)
        .maybeSingle();
    if (error) throw new Error(toMessage(error));
    if (!data) return null;
    const state = (data as { state: unknown }).state;
    return isStore(state) ? state : null;
}

async function cloudPush(store: Store): Promise<void> {
    const { data, error } = await db
        .from(TABLE)
        .update({ state: store, updated_at: new Date().toISOString() })
        .eq('household_key', HOUSEHOLD_KEY)
        .select('household_key');
    if (error) throw new Error(toMessage(error));
    if (Array.isArray(data) && data.length > 0) return;
    // 首次使用：云端还没有这一行，插入初始数据。
    const inserted = await db
        .from(TABLE)
        .insert({ household_key: HOUSEHOLD_KEY, state: store })
        .select('household_key');
    if (inserted.error) throw new Error(toMessage(inserted.error));
}

/* ---------- 服务端代理（Vercel 等外部域名） ---------- */

async function proxyFetch(): Promise<Store | null> {
    const res = await fetch('/api/state', { headers: { Accept: 'application/json' } });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || `云端读取失败（HTTP ${res.status}）`);
    return isStore(payload?.state) ? payload.state : null;
}

async function proxyPush(store: Store): Promise<void> {
    const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: store }),
    });
    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `云端保存失败（HTTP ${res.status}）`);
    }
}

/* ---------- 对外统一接口 ---------- */

export async function fetchRemoteStore(): Promise<Store | null> {
    return activeBackend() === 'proxy' ? proxyFetch() : cloudFetch();
}

export async function pushRemoteStore(store: Store): Promise<void> {
    return activeBackend() === 'proxy' ? proxyPush(store) : cloudPush(store);
}
