/**
 * /cli 셸. LLM 없이 /posts.json · /gitlog.json 으로 동작한다.
 * `dagent`를 치면 ./dagent.ts 를 import()로 불러와 AI 모드로 바뀐다.
 * 터미널 확장(ls·cat·vim·sudo 등)은 별도 기획(blog-cli) 몫 — 여기는 골격만.
 */
import { el, link, mount, route, span, type Term } from './ui';

type PostMeta = {
	slug: string;
	title: string;
	layers: string[];
	stance: string;
	pubDate: string;
	updatedDate: string | null;
	updatedReason: string | null;
};
type GitLine = { short: string; date: string; kind: string; text: string; href: string };

export type Shell = {
	term: Term;
	agentUrl: string;
	setPrompt: (mode: 'sh' | 'agent') => void;
	/** dagent 모드일 때 입력을 가로챈다. null이면 셸 */
	handler: ((line: string) => void | Promise<void>) | null;
	/** 진행 중인 dagent 요청 취소 (Esc) */
	abort: (() => void) | null;
};

const root = document.querySelector<HTMLElement>('[data-term]');
if (root) start(root);

function start(root: HTMLElement) {
	const term = mount(root);
	const layers = (root.dataset.layers ?? '').split(' ');
	const agentUrl = (import.meta.env.PUBLIC_AGENT_URL as string | undefined) ?? 'https://ask.kyungjin.dev';
	const history: string[] = [];
	let cursor = 0;

	const shell: Shell = {
		term,
		agentUrl,
		handler: null,
		abort: null,
		setPrompt(mode) {
			term.prompt.textContent = mode === 'agent' ? 'dagent ›' : '$';
			term.prompt.classList.toggle('ai', mode === 'agent');
			term.input.placeholder = mode === 'agent' ? '궁금한 걸 물어보세요' : 'help';
			term.mode.replaceChildren(
				...(mode === 'agent' ? [' ', span('badge', 'AI'), ' dagent 실행 중 · /exit로 나가기'] : [' sh · help로 명령어 보기']),
			);
		},
	};

	// 첫 줄: 지난 7일 dagent 집계. agent가 꺼져 있으면 줄 없이 지나간다 (빌드는 agent를 부르지 않는다)
	answered(term, agentUrl);

	let posts: Promise<PostMeta[]> | undefined;
	const getPosts = () => (posts ??= fetch('/posts.json').then((r) => r.json()));

	const commands: Record<string, (args: string[]) => void | Promise<void>> = {
		help() {
			const rows: Array<[string | Node, string]> = [
				[`get posts [-l layer=<레이어>]`, `글 목록 (${layers.join(' ')})`],
				['describe post <slug>', '글 정보 · 정정 사유'],
				['git log [-n N]', '이 블로그의 변경 이력 (홈과 같은 데이터)'],
				['cd ~ | /posts | /about', '이동'], // /projects는 임시로 help에서 숨김 (cd는 그대로 된다)
				['theme dark | light · clear', '테마 · 화면 지우기 (⌘K)'],
				[el('span', {}, span('hi', 'dagent'), ' [--post <slug>]'), 'AI 챗봇 실행 (나가기: /exit)'],
			];
			for (const [cmd, desc] of rows) term.block(el('div', { class: 'hl' }, el('span', {}, cmd), span('dim', desc)));
		},
		async get(args) {
			if (args[0] !== 'posts') return notFound(['get', ...args]);
			const filter = args.join(' ').match(/-l\s+layer=(\S+)/)?.[1];
			if (filter && !layers.includes(filter)) {
				term.print(span('err', `error: 없는 레이어 "${filter}" — ${layers.join(' ')}`));
				return;
			}
			const list = (await getPosts()).filter((p) => !filter || p.layers.includes(filter));
			if (list.length === 0) {
				term.print(span('dim', 'No resources found.'));
				return;
			}
			term.block(el('div', { class: 'row dim' }, el('span', {}, 'NAME'), el('span', {}, 'LAYERS'), el('span', {}, 'AGE')));
			for (const p of list)
				term.block(
					el('div', { class: 'row' }, el('span', {}, link(`/posts/${p.slug}/`, p.title)), el('span', {}, route(p.layers)), el('span', {}, age(p.pubDate))),
				);
			term.print(span('dim', `${list.length} posts · 제목을 클릭하면 이동`));
		},
		async describe(args) {
			if (args[0] !== 'post') return notFound(['describe', ...args]);
			if (!args[1]) {
				term.print(span('err', 'error: slug가 필요해요 — get posts로 목록 보기'));
				return;
			}
			const p = (await getPosts()).find((x) => x.slug === args[1]);
			if (!p) {
				term.print(span('err', `Error from server (NotFound): posts "${args[1]}" not found`));
				return;
			}
			const kv = (k: string, ...v: (string | Node)[]) => term.print(span('pa', k.padEnd(10)), ...v);
			kv('Name:', link(`/posts/${p.slug}/`, p.title));
			kv('Layers:', route(p.layers));
			kv('Date:', p.pubDate.slice(0, 10));
			kv('Stance:', p.stance);
			if (p.updatedReason && p.updatedDate) kv('Updated:', span('warn', `${p.updatedDate.slice(0, 10)} — ${p.updatedReason}`));
		},
		async git(args) {
			if (args[0] !== 'log') return notFound(['git', ...args]);
			const n = Number(args.join(' ').match(/-n\s*(\d+)/)?.[1] ?? 10);
			const data: { lines: GitLine[] } = await fetch('/gitlog.json').then((r) => r.json());
			for (const l of data.lines.slice(0, Math.max(1, n)))
				term.print(span('err', '*'), ' ', el('span', { style: 'color: var(--tooling)' }, l.short), ' ', span('dim', l.date), ' ', span('pa', l.kind.padEnd(5)), ' ', link(l.href, l.text));
		},
		cd(args) {
			const to = (args[0] ?? '~').replace(/^~?\/?/, '/').replace(/\/$/, '') || '/';
			const ok = ['/', '/posts', '/projects', '/about', '/cli'];
			if (!ok.includes(to)) {
				term.print(span('err', `cd: no such file or directory: ${args[0]}`));
				return;
			}
			location.href = to;
		},
		theme(args) {
			const t = args[0];
			const set = (window as unknown as { __setTheme?: (t: string) => void }).__setTheme;
			if ((t === 'dark' || t === 'light') && set) {
				set(t);
				term.print(span('dim', `theme: ${t}`));
			} else term.print(span('err', 'usage: theme dark | light'));
		},
		clear() {
			term.clear();
		},
		async dagent(args) {
			const { runDagent } = await import('./dagent');
			const i = args.indexOf('--post');
			await runDagent(shell, i >= 0 ? args[i + 1] : undefined);
		},
	};

	function notFound(words: string[]) {
		term.print(span('err', `command not found: ${words.join(' ')}`), span('dim', ' — help로 명령어 보기'));
	}

	async function run(line: string) {
		if (shell.handler) return shell.handler(line);
		term.print(span('p', '$'), ` ${line}`).className = 'cmd';
		const [cmd, ...args] = line.split(/\s+/);
		const fn = Object.hasOwn(commands, cmd) ? commands[cmd] : undefined;
		try {
			await (fn ? fn(args) : notFound([cmd, ...args]));
		} catch {
			term.print(span('err', 'error: 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.'));
		}
	}

	root.querySelector('[data-form]')!.addEventListener('submit', (e) => {
		e.preventDefault();
		const line = term.input.value.trim();
		term.input.value = '';
		if (!line) return;
		history.push(line);
		cursor = history.length;
		void run(line);
	});

	term.input.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			if (history.length === 0) return;
			e.preventDefault();
			cursor = Math.max(0, Math.min(history.length, cursor + (e.key === 'ArrowUp' ? -1 : 1)));
			term.input.value = history[cursor] ?? '';
		} else if (e.key === 'Escape') shell.abort?.();
	});

	document.addEventListener('keydown', (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			term.clear();
			term.input.focus();
		}
	});

	// 출력 영역을 눌러도 입력으로 (링크·버튼·글자 선택은 제외)
	term.out.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).closest('a, button') || getSelection()?.toString()) return;
		term.input.focus();
	});

	// 모바일은 자동 포커스하지 않는다 — 키보드가 화면을 가린다
	if (matchMedia('(pointer: fine)').matches) term.input.focus();
}

function age(iso: string): string {
	const m = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

async function answered(term: Term, agentUrl: string) {
	try {
		const r = await fetch(`${agentUrl}/v1/stats?window=7d`, { signal: AbortSignal.timeout(3000) });
		if (!r.ok) return;
		const s: { questions: number; refused: number } = await r.json();
		if (typeof s.questions !== 'number') return;
		term.out.prepend(
			el('p', {}, span('p', 'Normal '), 'Answered ', span('dim', `· 지난 7일 dagent 질문 ${s.questions}개 · 범위 밖 ${s.refused}개 거절`)),
		);
	} catch {
		// agent 꺼짐 — 줄 없음
	}
}
