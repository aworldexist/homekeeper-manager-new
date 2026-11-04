// 部署环境判断与数据后端选择。
//
// 背景：WorkBuddy 云服务的安全策略会校验请求来源域名（Origin），只允许它自己分配的域名。
// 因此部署到 vercel.app 等外部域名时，浏览器直接调用云数据库 / 大模型接口会被拒绝。
//
// 处理方式：外部域名下改走本站自己的服务端接口（/api/state、/api/ai），
// 由服务端转发到云服务——服务端请求不带 Origin，不受该策略限制，数据仍然存在同一个云数据库。
//   · localhost / WorkBuddy 域名  → 浏览器直连云服务（少一跳，更快）
//   · 其他域名（如 Vercel）        → 走 /api 服务端代理
export function isCloudDomain(): boolean {
    if (typeof location === 'undefined') return true;
    const host = location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('app.workbuddy.host') || host.endsWith('workbuddy.link');
}

export function activeBackend(): 'cloud' | 'proxy' {
    return isCloudDomain() ? 'cloud' : 'proxy';
}

// 当前页面能否直接调用云服务（数据库 + 大模型）。
export function cloudServiceUsable(): boolean {
    return isCloudDomain();
}
