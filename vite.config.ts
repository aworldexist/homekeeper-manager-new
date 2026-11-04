import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host + allowedHosts：云端发布时通过反向代理域名访问，未允许的主机会被 Vite 拒绝
// （Blocked request. This host is not allowed.），因此这里放开主机校验。
const server = { host: '0.0.0.0', allowedHosts: true as const, port: 5173 };

export default defineConfig({ plugins: [react()], server, preview: { ...server, port: 4173 } });
