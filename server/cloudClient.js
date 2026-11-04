// Vercel 服务端（Serverless Function）使用的云服务客户端。
//
// 为什么需要它：WorkBuddy 云服务的安全策略会校验请求来源域名（Origin），
// 浏览器在 vercel.app 域名下直接调用会被拒绝（the request origin is not allowed）。
// 而服务端发起请求时不带 Origin，因此不受该限制——由服务端代理转发即可正常读写。
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk';

const config = {
    endpoint: 'https://homekeeper-52501.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_8opJDXNOySCPQqjVWFekV3_gjxqmGGqhwO5dcIvqxKnqM3MkVV9AbNp',
};

let instance = null;

export function cloudClient() {
    if (!instance) instance = createWorkBuddyCloud(config);
    return instance;
}

export const TABLE = 'household_state';
export const HOUSEHOLD_KEY = 'home';

export function errorMessage(error) {
    if (!error) return '';
    const detail = error?.error?.error_description || error?.error?.description || '';
    return error.message || detail || String(error);
}
