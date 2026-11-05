/**
 * dagent — AI 버전의 Daniel. /cli 에서 `dagent`를 칠 때만 import()로 불러온다.
 * 서버(agent)는 별도 레포. 계약: GET /health · POST /v1/chat (SSE) · GET /v1/stats.
 * 서버 응답은 textContent로만 화면에 넣는다.
 */
import type { Shell } from './index';
import { el, link, span } from './ui';

type Msg = { role: 'user' | 'assistant'; content: string };
type Source = { kind?: 'post' | 'project'; slug: string; title: string };

const MAX_TURNS = 10;
const SUGGESTED = ['어떤 문제를 가장 잘 푸나요?', '판단이 갈릴 때 어떻게 결정하나요?', '이 블로그 인프라는 어떻게 떠 있나요?'];

export async function runDagent(shell: Shell, post?: string) {
	const { term, agentUrl } = shell;
	const url = new URL(agentUrl);
	const host = url.host;
	const port = url.port || (url.protocol === 'http:' ? '80' : '443');
	term.print(span('dim', `connecting to ${host} …`));

	let version = '';
	try {
		const r = await fetch(`${agentUrl}/health`, { signal: AbortSignal.timeout(3000) });
		if (!r.ok) throw new Error(String(r.status));
		version = ((await r.json()) as { version?: string }).version ?? '';
	} catch {
		term.led.classList.add('down');
		term.print(span('err', `dagent: dial tcp ${url.hostname}:${port}: connection refused`));
		term.print('agent가 꺼져 있습니다. 셸 명령어(help)는 그대로 쓸 수 있어요.');
		return;
	}
	term.led.classList.remove('down');

	const history: Msg[] = [];
	shell.setPrompt('agent');
	term.print(span('hi', 'dagent'), span('dim', ` v${version || '0.1'} · scope: ${post ? `글 ${post}` : '글 · 이력서 · 프로젝트 기록'}`));
	term.print('제 글·이력서·프로젝트 기록으로 답하는 ', span('hi', 'AI 버전의 Daniel'), '이에요. 틀릴 수 있으니 중요한 건 원문 링크로 확인해 주세요.');
	term.print(span('dim', '추천 질문 — '), ...chips(SUGGESTED));

	function chips(list: string[]) {
		return list.map((q) => {
			const b = el('button', { type: 'button', class: 'q' }, `› ${q}`);
			b.addEventListener('click', () => void ask(q));
			return b;
		});
	}

	async function ask(text: string) {
		if (shell.abort) return; // 답변 중
		term.print(span('pa', 'dagent ›'), ` ${text}`).className = 'cmd';
		history.push({ role: 'user', content: text });
		const ans = term.print();
		ans.className = 'ans';
		const ctrl = new AbortController();
		shell.abort = () => ctrl.abort();
		let reply = '';
		let finished = false;
		try {
			const r = await fetch(`${agentUrl}/v1/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages: history.slice(-MAX_TURNS * 2), ...(post ? { post } : {}) }),
				signal: ctrl.signal,
			});
			if (r.status === 429) {
				const sec = r.headers.get('Retry-After');
				ans.replaceWith(el('p', {}, span('warn', `잠시 뒤에 다시 물어보세요${sec ? ` (${sec}초)` : ''}`)));
				history.pop();
				return;
			}
			if (!r.ok || !r.body) throw new Error(String(r.status));
			for await (const ev of sse(r.body)) {
				if (ev.event === 'token') {
					reply += ev.data.text ?? '';
					ans.textContent = reply;
					term.scroll();
				} else if (ev.event === 'sources') {
					const items = ((ev.data.items ?? []) as Source[]).map(toLink).filter((x): x is HTMLAnchorElement => !!x);
					if (items.length) term.print(span('dim', '  sources › '), ...items.flatMap((a, i) => (i ? [' · ', a] : [a])));
				} else if (ev.event === 'refused') {
					ans.textContent =
						ev.data.reason === 'sensitive' ? '그 질문엔 답하지 않을게요.' : '그건 제 글·이력서·프로젝트 기록 밖이라 답하기 어려워요.';
					if (Array.isArray(ev.data.chips) && ev.data.chips.length) term.print(span('dim', '대신 — '), ...chips(ev.data.chips));
				} else if (ev.event === 'error') {
					term.print(span('err', `error: ${String(ev.data.message ?? '알 수 없는 오류')}`));
				} else if (ev.event === 'done') {
					finished = true;
					break;
				}
			}
			if (!finished) throw new Error('stream ended');
			history.push({ role: 'assistant', content: reply });
		} catch {
			if (ctrl.signal.aborted) term.print(span('dim', '^C 중단했어요'));
			else term.print(span('err', 'connection lost — 다시 물어보세요'));
			if (reply) history.push({ role: 'assistant', content: reply });
			else history.pop();
		} finally {
			shell.abort = null;
		}
	}

	shell.handler = async (line) => {
		if (line === '/exit' || line === 'exit') {
			shell.abort?.();
			shell.handler = null;
			shell.setPrompt('sh');
			term.print(span('pa', 'dagent ›'), ' /exit');
			term.print(span('dim', 'dagent를 종료했어요. 대화는 저장되지 않아요.'));
			return;
		}
		await ask(line);
	};
}

function toLink(s: Source): HTMLAnchorElement | null {
	if (!/^[a-z0-9-]+$/.test(s.slug)) return null; // 블로그에 없는 형식은 버린다
	return s.kind === 'project' ? link(`/projects#${s.slug}`, `projects/${s.slug}`) : link(`/posts/${s.slug}/`, s.title || s.slug);
}

/** text/event-stream 파서: `event:` + `data:`(JSON) 블록을 빈 줄로 나눈다. */
async function* sse(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: Record<string, any> }> {
	const reader = body.pipeThrough(new TextDecoderStream()).getReader();
	let buf = '';
	for (;;) {
		const { value, done } = await reader.read();
		if (done) return;
		buf += value;
		let idx;
		while ((idx = buf.search(/\r?\n\r?\n/)) >= 0) {
			const block = buf.slice(0, idx);
			buf = buf.slice(idx).replace(/^\r?\n\r?\n/, '');
			let event = 'message';
			const data: string[] = [];
			for (const line of block.split(/\r?\n/)) {
				if (line.startsWith('event:')) event = line.slice(6).trim();
				else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
			}
			try {
				yield { event, data: data.length ? JSON.parse(data.join('\n')) : {} };
			} catch {
				// 깨진 블록은 건너뛴다
			}
		}
	}
}
