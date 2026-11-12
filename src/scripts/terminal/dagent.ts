/**
 * dagent — AI 버전의 Daniel. /cli 에서 `dagent`를 칠 때만 import()로 불러온다.
 * 서버(agent)는 별도 레포. 계약: GET /health · POST /v1/chat (SSE) · GET /v1/stats.
 * 서버 응답은 textContent로만 화면에 넣는다.
 *
 * 화면: glow·top처럼 대체 화면(pager)을 차지한다. 위 = 대화, 아래 = `dagent ›` 입력 줄.
 * 닫아도 대화는 이 페이지 메모리에 남아 다시 `dagent`를 치면 이어진다(페이지를 떠나면 사라진다).
 * 한 턴: `step`(에이전트가 하는 일)은 오는 대로 찍고, 답(`token`)은 타자기 큐로 한 글자씩 흘린다.
 * agent는 judge를 통과한 답만 token으로 보낸다 — 화면에 나간 글자는 되돌릴 수 없어서 (A안, 2026-11-08).
 */
import type { Shell } from './index';
import { openPager, type Pager } from './pager';
import { el, link, span, type Part } from './ui';

type Msg = { role: 'user' | 'assistant'; content: string };
type Source = { kind?: 'post' | 'project'; slug: string; title: string };
type Step = { kind?: string; text?: string; name?: string; arg?: string };

const MAX_TURNS = 10;
const SUGGESTED = ['어떤 문제를 가장 잘 푸나요?', '판단이 갈릴 때 어떻게 결정하나요?', '이 블로그 인프라는 어떻게 떠 있나요?'];
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const ONLINE = '● agent online';

/** 이 페이지에 사는 동안의 대화. 닫았다 다시 열면 그대로 이어진다 */
type Session = {
	post?: string;
	version: string;
	/** 대화 줄이 쌓이는 노드 — 열 때마다 새 pager 안에 다시 끼운다 */
	log: HTMLElement;
	history: Msg[];
	/** ↑↓로 다시 꺼낼 내 질문 */
	asked: string[];
	/** 답변 중이면 그 요청 */
	ctrl: AbortController | null;
};

let session: Session | null = null;
/** 지금 열린 화면. 닫히면 null */
let view: { sh: Shell; pager: Pager; input: HTMLInputElement } | null = null;

export async function runDagent(shell: Shell, post?: string) {
	const { term, agentUrl } = shell;
	const url = new URL(agentUrl);
	const port = url.port || (url.protocol === 'http:' ? '80' : '443');
	term.print(span('dim', `connecting to ${url.host} …`));

	let version = '';
	try {
		const r = await fetch(`${agentUrl}/health`, { signal: AbortSignal.timeout(3000) });
		if (!r.ok) throw new Error(String(r.status));
		version = ((await r.json()) as { version?: string }).version ?? '';
	} catch {
		shell.agent = 'down';
		term.led.classList.add('down');
		term.print(span('err', `dagent: dial tcp ${url.hostname}:${port}: connection refused`));
		term.print('agent가 꺼져 있습니다. 셸 명령어(help)는 그대로 쓸 수 있어요.');
		return;
	}
	shell.agent = 'up';
	term.led.classList.remove('down');

	// `--post`가 다른 글이면 범위가 달라지니 새 대화. 그 밖엔 이어서 연다
	const resume = !!session && (post === undefined || post === session.post);
	if (!resume) session = { post, version, log: el('div', { class: 'dlog' }), history: [], asked: [], ctrl: null };
	const s = session!;
	s.version = version || s.version;
	term.print(span('dim', resume ? `dagent: 이전 대화를 이어서 열어요 (${s.asked.length}개 질문)` : 'dagent: 새 대화를 열어요'));
	open(shell, s);
	if (!resume) intro(s);
}

function open(sh: Shell, s: Session) {
	const input = el('input', {
		type: 'text',
		class: 'din',
		spellcheck: 'false',
		autocapitalize: 'off',
		autocomplete: 'off',
		'aria-label': 'dagent에게 질문',
		placeholder: '궁금한 걸 물어보세요',
	});
	const form = el('form', { class: 'dform' }, el('label', { class: 'dpr' }, 'dagent ›'), input);

	const pager = openPager(sh, {
		badge: 'dagent',
		title: `v${s.version || '0.1'} · scope: ${s.post ? `글 ${s.post}` : '글 · 이력서 · 프로젝트 기록'}`,
		body: s.log,
		input: form,
		footer: 'Enter 보내기 · Esc 답변 중단 · /clear 새 대화 · /exit 닫기',
		onClose() {
			s.ctrl?.abort();
			view = null;
			sh.term.print(span('dim', 'dagent를 닫았어요. 다시 '), span('hi', 'dagent'), span('dim', '를 치면 이어져요. 페이지를 떠나면 사라져요.'));
		},
	});
	view = { sh, pager, input };
	pager.setStatus(s.ctrl ? `${SPIN[0]} 답변 중 · Esc 중단` : ONLINE);

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const line = input.value.trim();
		input.value = '';
		if (!line) return;
		if (line === '/exit' || line === 'exit') return pager.close();
		if (line === '/clear') return clear(s);
		void ask(s, line);
	});

	let cursor = s.asked.length;
	input.addEventListener('keydown', (e) => {
		// pager의 q·j·k·Esc(닫기)가 타이핑을 가로채지 않게 입력 줄에서 끝낸다
		e.stopPropagation();
		if (e.isComposing) return; // 한글 조합 중
		const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
		const key = e.key.toLowerCase();
		if (e.key === 'Escape') {
			// 답변 중일 때만 중단. 대기 중 Esc로 대화를 날리지 않는다
			e.preventDefault();
			s.ctrl?.abort();
		} else if (ctrl && key === 'c') {
			if (input.selectionStart !== input.selectionEnd) return; // 복사
			e.preventDefault();
			if (s.ctrl) s.ctrl.abort();
			else input.value = '';
		} else if (ctrl && key === 'd') {
			if (input.value) return;
			e.preventDefault();
			pager.close();
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			if (s.asked.length === 0) return;
			e.preventDefault();
			cursor = Math.max(0, Math.min(s.asked.length, cursor + (e.key === 'ArrowUp' ? -1 : 1)));
			input.value = s.asked[cursor] ?? '';
		} else if (e.key === 'PageUp' || e.key === 'PageDown') {
			e.preventDefault();
			const page = pager.body.clientHeight - 40;
			pager.body.scrollBy({ top: e.key === 'PageUp' ? -page : page });
		}
	});

	// 대화 영역을 눌러도 입력으로 (링크·버튼·글자 선택은 제외) — 셸과 같다
	pager.body.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).closest('a, button') || getSelection()?.toString()) return;
		input.focus();
	});

	scroll();
	input.focus();
}

function intro(s: Session) {
	put(s, span('hi', 'dagent'), span('dim', ` v${s.version || '0.1'} · scope: ${s.post ? `글 ${s.post}` : '글 · 이력서 · 프로젝트 기록'}`));
	put(s, '제 글·이력서·프로젝트 기록으로 답하는 ', span('hi', 'AI 버전의 Daniel'), '이에요. 틀릴 수 있으니 중요한 건 원문 링크로 확인해 주세요.');
	put(s, span('dim', '추천 질문 — '), ...chips(s, SUGGESTED));
}

function clear(s: Session) {
	s.ctrl?.abort();
	s.log.replaceChildren();
	s.history = [];
	intro(s);
}

/** 대화 영역에 한 줄 */
function put(s: Session, ...parts: Part[]): HTMLParagraphElement {
	const p = el('p', {}, ...parts);
	s.log.append(p);
	scroll();
	return p;
}

function scroll() {
	const b = view?.pager.body;
	if (b) b.scrollTop = b.scrollHeight;
}

function chips(s: Session, list: string[]) {
	return list.map((q) => {
		const b = el('button', { type: 'button', class: 'q' }, `› ${q}`);
		b.addEventListener('click', () => {
			void ask(s, q);
			view?.input.focus();
		});
		return b;
	});
}

async function ask(s: Session, text: string) {
	if (s.ctrl) return; // 답변 중
	const sh = view?.sh;
	if (!sh) return;
	put(s, span('pa', '›'), ` ${text}`).className = 'cmd';
	s.asked.push(text);
	s.history.push({ role: 'user', content: text });

	const steps = el('div', { class: 'steps' });
	const ans = el('p', { class: 'ans' });
	s.log.append(steps, ans);
	const spin = spinner(steps);
	const tw = typewriter(ans);

	const ctrl = new AbortController();
	s.ctrl = ctrl;
	sh.abort = () => ctrl.abort();
	ctrl.signal.addEventListener('abort', () => tw.stop());
	view?.pager.setStatus(`${SPIN[0]} 답변 중 · Esc 중단`);

	let sources: Source[] = [];
	let finished = false;
	try {
		const r = await fetch(`${sh.agentUrl}/v1/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messages: s.history.slice(-MAX_TURNS * 2), ...(s.post ? { post: s.post } : {}) }),
			signal: ctrl.signal,
		});
		if (r.status === 429) {
			const sec = r.headers.get('Retry-After');
			ans.replaceChildren(span('warn', `잠시 뒤에 다시 물어보세요${sec ? ` (${sec}초)` : ''}`));
			s.history.pop();
			return;
		}
		if (!r.ok || !r.body) throw new Error(String(r.status));
		for await (const ev of sse(r.body)) {
			if (ev.event === 'step') {
				steps.insertBefore(stepLine(ev.data as Step), spin.line);
				scroll();
			} else if (ev.event === 'token') {
				spin.stop();
				tw.push(String(ev.data.text ?? ''));
			} else if (ev.event === 'sources') {
				sources = (ev.data.items ?? []) as Source[];
			} else if (ev.event === 'refused') {
				spin.stop();
				tw.stop();
				ans.textContent =
					ev.data.reason === 'sensitive' ? '그 질문엔 답하지 않을게요.' : '그건 제 글·이력서·프로젝트 기록 밖이라 답하기 어려워요.';
				if (Array.isArray(ev.data.chips) && ev.data.chips.length) put(s, span('dim', '대신 — '), ...chips(s, ev.data.chips));
			} else if (ev.event === 'error') {
				put(s, span('err', `error: ${String(ev.data.message ?? '알 수 없는 오류')}`));
			} else if (ev.event === 'done') {
				finished = true;
				break;
			}
			// 모르는 이벤트는 건너뛴다 — agent가 먼저 새 이벤트를 보내도 깨지지 않게
		}
		if (!finished) throw new Error('stream ended');
		await tw.done(); // 다 흘린 뒤에 출처
		if (ctrl.signal.aborted) throw new Error('aborted');
		const items = sources.map(toLink).filter((x): x is HTMLAnchorElement => !!x);
		if (items.length) put(s, span('dim', '  sources › '), ...items.flatMap((a, i) => (i ? [' · ', a] : [a])));
		s.history.push({ role: 'assistant', content: tw.text() || ans.textContent || '' });
	} catch {
		if (!s.log.contains(ans)) return; // /clear로 지운 대화 — 남길 게 없다
		if (ctrl.signal.aborted) put(s, span('dim', '^C 중단했어요'));
		else put(s, span('err', 'connection lost — 다시 물어보세요'));
		const shown = tw.text();
		if (shown) s.history.push({ role: 'assistant', content: shown });
		else s.history.pop();
	} finally {
		spin.stop();
		s.ctrl = null;
		sh.abort = null;
		view?.pager.setStatus(ONLINE);
	}
}

/** `→ read  post/<slug>` 같은 과정 한 줄. 밖에서 온 글자는 textContent로만 */
function stepLine(d: Step): HTMLElement {
	const cut = (x: unknown) => String(x ?? '').slice(0, 80);
	if (d.kind === 'tool') {
		const [verb, target] =
			d.name === 'read_post'
				? ['read', `post/${cut(d.arg)}`]
				: d.name === 'read_decision'
					? ['read', `decision/${cut(d.arg)}`]
					: d.name === 'list_posts'
						? ['list', 'posts']
						: [cut(d.name), cut(d.arg)];
		return el('p', { class: 'step' }, span('pa', '  → '), span('sk', verb.padEnd(6)), target);
	}
	if (d.kind === 'check') return el('p', { class: 'step' }, span('p', '  ✓ '), span('sk', 'check '), cut(d.text));
	return el('p', { class: 'step' }, span('dim', '  · '), span('sk', `${cut(d.kind) || 'plan'}`.padEnd(6)), cut(d.text));
}

/** 첫 글자가 올 때까지 도는 `⠋ thinking` 줄. step은 이 줄 위에 쌓인다 */
function spinner(parent: HTMLElement) {
	const glyph = span('pa', SPIN[0]);
	const line = el('p', { class: 'step' }, '  ', glyph, span('dim', ' thinking'));
	parent.append(line);
	let i = 0;
	const t = setInterval(() => {
		glyph.textContent = SPIN[(i = (i + 1) % SPIN.length)];
		view?.pager.setStatus(`${SPIN[i]} 답변 중 · Esc 중단`);
	}, 80);
	return {
		line,
		stop() {
			clearInterval(t);
			line.remove();
		},
	};
}

/**
 * 타자기 큐 — 받은 조각은 쌓아 두고, 화면은 프레임마다 조금씩만 늘린다.
 * agent가 답을 한 번에 보내도 한 글자씩 떨어지고, 밀려 있으면 그만큼 빨라진다.
 */
function typewriter(node: HTMLElement) {
	const instant = matchMedia('(prefers-reduced-motion: reduce)').matches;
	let full = '';
	let shown = 0;
	let raf = 0;
	let stopped = false;
	let idle: (() => void) | null = null;
	let waiting: Promise<void> = Promise.resolve();

	const finish = () => {
		raf = 0;
		idle?.();
		idle = null;
	};
	const tick = () => {
		let n = shown + Math.max(1, Math.ceil((full.length - shown) / 12));
		if (n < full.length && /[\uD800-\uDBFF]/.test(full[n - 1])) n++; // 이모지 반쪽(서로게이트)을 찍지 않게
		shown = Math.min(n, full.length);
		node.textContent = full.slice(0, shown);
		scroll();
		if (shown < full.length) raf = requestAnimationFrame(tick);
		else finish();
	};
	return {
		push(t: string) {
			if (stopped || !t) return;
			full += t;
			if (instant) {
				shown = full.length;
				node.textContent = full;
				return scroll();
			}
			if (!raf) {
				waiting = new Promise((r) => (idle = r));
				raf = requestAnimationFrame(tick);
			}
		},
		done: () => (raf ? waiting : Promise.resolve()),
		stop() {
			stopped = true;
			cancelAnimationFrame(raf);
			finish();
		},
		/** 화면에 실제로 나간 만큼 */
		text: () => full.slice(0, shown),
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
