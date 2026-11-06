/**
 * /cli 터미널의 화면 조작. 출력은 전부 DOM 노드로 만든다(innerHTML 금지) —
 * dagent 답변처럼 밖에서 온 글자도 textContent로만 들어간다.
 */
export type Part = string | Node | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
	...children: Part[]
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
	for (const c of children) if (c) node.append(c);
	return node;
}

export const span = (cls: string, ...children: Part[]) => el('span', { class: cls }, ...children);
export const link = (href: string, text: string) =>
	el('a', href.startsWith('http') ? { href, target: '_blank', rel: 'noopener' } : { href }, text);
export const layerSpan = (layer: string) => el('span', { style: `color: var(--${layer})` }, layer);

export function route(layers: string[]): DocumentFragment {
	const f = document.createDocumentFragment();
	layers.forEach((l, i) => {
		if (i > 0) f.append(' → ');
		f.append(layerSpan(l));
	});
	return f;
}

/** 1.2K · 22K · 512 (ls -lh 꼴) */
export function human(bytes: number): string {
	if (bytes < 1024) return String(Math.round(bytes));
	const units = ['K', 'M', 'G', 'T'];
	let n = bytes;
	let u = -1;
	do {
		n /= 1024;
		u++;
	} while (n >= 1024 && u < units.length - 1);
	return `${n < 10 ? n.toFixed(1) : Math.round(n)}${units[u]}`;
}

/** 글 날짜는 KST 기준 (D17 — 홈 git log·글 상단과 같다) */
const kst = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
export function kstParts(iso: string): { y: string; m: string; d: string } {
	const p = Object.fromEntries(kst.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
	return { y: p.year, m: p.month, d: p.day };
}
export const mmdd = (iso: string | undefined) => (iso ? `${kstParts(iso).m}-${kstParts(iso).d}` : '');
export const ymd = (iso: string) => {
	const { y, m, d } = kstParts(iso);
	return `${y}-${m}-${d}`;
};

export type PromptState = { mode: 'sh' | 'agent'; ctx: string | null; cwd: string };

/** 셸 프롬프트 조각 `(infra) ~/work $`. 컨텍스트 색은 레이어 토큰 — 이름은 값으로만 받는다 */
export function promptParts({ ctx, cwd }: Omit<PromptState, 'mode'>): Part[] {
	return [
		ctx && el('span', { class: 'ctxp', style: `color: var(--${ctx})` }, `(${ctx})`),
		ctx && ' ',
		span('cwd', cwd),
		' ',
		span('p', '$'),
	];
}

/** 입력창 왼쪽 라벨을 매번 새로 그린다 (D15). dagent 모드면 `dagent ›` */
export function renderPrompt(term: Term, state: PromptState) {
	const agent = state.mode === 'agent';
	term.prompt.replaceChildren(...(agent ? ['dagent ›'] : promptParts(state)).filter((x): x is string | Node => !!x));
	term.prompt.classList.toggle('ai', agent);
}

export type Term = {
	out: HTMLElement;
	input: HTMLInputElement;
	prompt: HTMLElement;
	mode: HTMLElement;
	led: HTMLElement;
	/** 대체 화면 (glow·top) — pager.ts */
	alt: HTMLElement;
	/** 한 줄 출력. 마지막 줄 노드를 돌려준다(스트리밍으로 이어 붙일 때) */
	print: (...parts: Part[]) => HTMLParagraphElement;
	/** 이미 만든 노드(그리드 줄 등)를 그대로 붙인다 */
	block: (node: Node) => void;
	clear: () => void;
	scroll: () => void;
};

export function mount(root: HTMLElement): Term {
	const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
	const out = q<HTMLElement>('[data-out]');
	const scroll = () => {
		out.scrollTop = out.scrollHeight;
	};
	return {
		out,
		input: q<HTMLInputElement>('[data-input]'),
		prompt: q<HTMLElement>('[data-prompt]'),
		mode: q<HTMLElement>('[data-mode]'),
		led: q<HTMLElement>('[data-led]'),
		alt: q<HTMLElement>('[data-alt]'),
		print(...parts) {
			const p = el('p', {}, ...parts);
			out.append(p);
			scroll();
			return p;
		},
		block(node) {
			out.append(node);
			scroll();
		},
		clear() {
			out.replaceChildren();
		},
		scroll,
	};
}
