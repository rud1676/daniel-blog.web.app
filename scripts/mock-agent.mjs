#!/usr/bin/env node
// /cli dagent 개발용 가짜 agent. 실제 서버(별도 레포)와 같은 계약을 흉내 낸다.
//   node scripts/mock-agent.mjs [ok|down|429|refused|statsfail]   (기본 ok, 포트 8787)
//   PUBLIC_AGENT_URL=http://localhost:8787 npm run dev  → http://localhost:4321/cli
// down: 모든 엔드포인트 503 · 429: /v1/chat 429 · refused: refused 이벤트 · statsfail: /v1/stats 500
import { createServer } from 'node:http';

const mode = process.argv[2] ?? 'ok';
const PORT = Number(process.env.PORT ?? 8787);
const ORIGINS = ['https://kyungjin.dev', 'http://localhost:4321']; // 개발 편의상 localhost는 포트 무관 허용

const cors = (req) => {
	const o = req.headers.origin;
	return ORIGINS.includes(o) || /^http:\/\/localhost:\d+$/.test(o ?? '')
		? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', 'Access-Control-Expose-Headers': 'Retry-After', Vary: 'Origin' }
		: {};
};
const json = (res, status, body, h) => {
	res.writeHead(status, { 'Content-Type': 'application/json', ...h });
	res.end(JSON.stringify(body));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

createServer(async (req, res) => {
	const h = cors(req);
	const path = new URL(req.url, 'http://x').pathname;
	if (req.method === 'OPTIONS') return res.writeHead(204, h).end();
	if (mode === 'down') return json(res, 503, { status: 'down' }, h); // 꺼짐: 모든 엔드포인트 실패
	if (path === '/health') return mode === 'down' ? json(res, 503, { status: 'down' }, h) : json(res, 200, { status: 'ok', version: '0.1.0' }, h);
	if (path === '/v1/stats')
		return mode === 'statsfail'
			? json(res, 500, {}, h)
			: json(res, 200, { window: '7d', questions: 23, refused: 4, generatedAt: new Date().toISOString() }, h);
	if (path === '/v1/chat' && req.method === 'POST') {
		if (mode === '429') return json(res, 429, {}, { ...h, 'Retry-After': '30' });
		res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...h });
		const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
		if (mode === 'refused') {
			send('refused', { reason: 'out_of_scope', chips: ['어떤 문제를 가장 잘 푸나요?'] });
		} else {
			for (const t of '정적 사이트(Astro)를 Firebase Hosting에 올리고, 프로젝트·호스팅·도메인은 Terraform으로 관리해요. (mock 답변)'.split(/(?<= )/)) {
				send('token', { text: t });
				await sleep(40);
			}
			send('sources', { items: [{ kind: 'project', slug: 'daniel-blog', title: '이 블로그' }, { kind: 'post', slug: 'pod-rolling-update-email-code', title: '파드 글' }] });
		}
		send('done', {});
		return res.end();
	}
	json(res, 404, {}, h);
}).listen(PORT, () => console.log(`mock agent (${mode}) → http://localhost:${PORT}`));
