/**
 * /cli 셸 부팅. LLM 없이 /posts.json · /gitlog.json 으로 동작한다.
 * 홈 디렉터리(~/<카테고리>/<글>.md)는 ./fs.ts, 명령은 ./commands.ts.
 * `dagent`를 치면 ./dagent.ts 를 import()로 불러와 AI 모드로 바뀐다.
 */
import { COMMANDS, redirect } from './commands';
import { createFs, type Fs, type PostMeta } from './fs';
import { attachKeys } from './keys';
import type { Pager } from './pager';
import { el, mount, promptParts, renderPrompt, span, type Term } from './ui';

export type Shell = {
	term: Term;
	/** 위치·컨텍스트·글 목록 */
	fs: Fs;
	/** data-layers — 레이어 이름을 코드에 쓰지 않는다 (AGENTS.md 분류 규칙) */
	layers: string[];
	/** data-categories */
	categories: string[];
	/** data-born — 첫 커밋 날짜 YYYY-MM-DD (git 없는 빌드면 null) */
	born: string | null;
	agentUrl: string;
	/** 이번 페이지의 입력 기록 (저장하지 않는다, K7) */
	history: string[];
	/** 'sh'면 `(ctx) ~/work $`, 'agent'면 `dagent ›`. cd·kubectx 뒤에도 'sh'로 불러 다시 그린다 */
	setPrompt: (mode: 'sh' | 'agent') => void;
	/** 한 줄 실행 — 입력창 Enter와 (이후 STEP의) 칩·링크가 같이 쓴다 */
	/** record: false면 ↑·history에 남기지 않는다 (첫 화면의 자동 help) */
	run: (line: string, opts?: { record?: boolean }) => Promise<void>;
	notFound: (words: string[]) => void;
	/** dagent 모드일 때 입력을 가로챈다. null이면 셸 */
	handler: ((line: string) => void | Promise<void>) | null;
	/** 진행 중인 dagent 요청 취소 (Esc) */
	abort: (() => void) | null;
	/** glow·top이 창을 차지하고 있으면 그 화면 */
	pager: Pager | null;
	/** dagent 서버 상태 — 첫 집계 요청(/v1/stats) 결과. netstat·top이 쓴다 */
	agent: 'unknown' | 'up' | 'down';
};

const root = document.querySelector<HTMLElement>('[data-term]');
if (root) start(root);

function start(root: HTMLElement) {
	const term = mount(root);
	const words = (s: string | undefined) => (s ?? '').split(' ').filter(Boolean);
	const layers = words(root.dataset.layers);
	const categories = words(root.dataset.categories);
	const agentUrl = (import.meta.env.PUBLIC_AGENT_URL as string | undefined) ?? 'https://ask.kyungjin.dev';
	const history: string[] = [];

	// 글 목록이 오기 전에도 셸은 뜬다 (빈 폴더). 명령은 목록이 온 뒤에 실행한다
	const loaded: Promise<void> = fetch('/posts.json')
		.then((r) => (r.ok ? (r.json() as Promise<PostMeta[]>) : Promise.reject(new Error(String(r.status)))))
		.then((posts) => {
			shell.fs = createFs(posts, categories);
		})
		.catch(() => {
			term.print(span('err', 'error: 글 목록을 불러오지 못했어요. 새로고침해 주세요.'));
		});

	let mode: 'sh' | 'agent' = 'sh';
	const shell: Shell = {
		term,
		fs: createFs([], categories),
		layers,
		categories,
		born: root.dataset.born || null,
		agentUrl,
		history,
		handler: null,
		abort: null,
		pager: null,
		agent: 'unknown',
		setPrompt(m) {
			mode = m;
			renderPrompt(term, { mode, ctx: shell.fs.ctx, cwd: shell.fs.label() });
			term.input.placeholder = mode === 'agent' ? '궁금한 걸 물어보세요' : 'help';
			term.mode.replaceChildren(
				...(mode === 'agent' ? [' ', span('badge', 'AI'), ' dagent 실행 중 · /exit로 나가기'] : [' sh · help로 명령어 보기']),
			);
		},
		notFound(w) {
			term.print(span('err', `zsh: command not found: ${w[0]}`), span('dim', ' — help로 명령어 보기'));
		},
		async run(typed, { record = true } = {}) {
			if (shell.handler) {
				history.push(typed);
				return shell.handler(typed);
			}
			await loaded;
			const echo = term.print(...promptParts({ ctx: shell.fs.ctx, cwd: shell.fs.label() }), ` ${typed}`);
			echo.className = 'cmd';
			// `!!` = 직전 명령 (bash처럼 바뀐 줄을 한 번 보여 준다)
			let line = typed;
			if (line.includes('!!')) {
				const last = history[history.length - 1];
				if (!last) return void term.print(span('err', 'zsh: no such event: !!'));
				line = line.replaceAll('!!', last);
				term.print(line);
			}
			if (record) history.push(line);
			if (redirect(line, shell)) return;
			const [cmd, ...args] = line.split(/\s+/);
			const fn = Object.hasOwn(COMMANDS, cmd) ? COMMANDS[cmd] : undefined;
			try {
				await (fn ? fn(args, shell) : shell.notFound([cmd, ...args]));
			} catch {
				term.print(span('err', 'error: 불러오지 못했어요. 잠시 뒤에 다시 해 주세요.'));
			}
		},
	};
	shell.setPrompt('sh');
	// 들어오면 help가 이미 쳐진 화면 — 무엇을 칠 수 있는지 먼저 보인다 (D19). 기록엔 안 남긴다
	void shell.run('help', { record: false });

	// 첫 줄: 지난 7일 dagent 집계. agent가 꺼져 있으면 줄 없이 지나간다 (빌드는 agent를 부르지 않는다)
	void answered(term, agentUrl).then((up) => {
		shell.agent = up ? 'up' : 'down';
	});

	root.querySelector('[data-form]')!.addEventListener('submit', (e) => {
		e.preventDefault();
		const line = term.input.value.trim();
		term.input.value = '';
		if (!line) return;
		void shell.run(line);
	});

	attachKeys(shell);

	// 모바일 명령 칩 (720px 이하에서만 보인다) — 누르면 그 줄을 친 것처럼
	for (const b of root.querySelectorAll<HTMLButtonElement>('[data-cmd]'))
		b.addEventListener('click', () => void shell.run(b.dataset.cmd!));

	// 출력 영역을 눌러도 입력으로 (링크·버튼·글자 선택은 제외)
	term.out.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).closest('a, button') || getSelection()?.toString()) return;
		term.input.focus();
	});

	// 모바일은 자동 포커스하지 않는다 — 키보드가 화면을 가린다
	if (matchMedia('(pointer: fine)').matches) term.input.focus();
}

/** 지난 7일 dagent 집계 한 줄. 서버가 응답했으면 true */
async function answered(term: Term, agentUrl: string): Promise<boolean> {
	try {
		const r = await fetch(`${agentUrl}/v1/stats?window=7d`, { signal: AbortSignal.timeout(3000) });
		if (!r.ok) return false;
		const s: { questions: number; refused: number } = await r.json();
		if (typeof s.questions !== 'number') return true;
		term.out.prepend(
			el('p', {}, span('p', 'Normal '), 'Answered ', span('dim', `· 지난 7일 dagent 질문 ${s.questions}개 · 범위 밖 ${s.refused}개 거절`)),
		);
		return true;
	} catch {
		return false; // agent 꺼짐 — 줄 없음
	}
}
