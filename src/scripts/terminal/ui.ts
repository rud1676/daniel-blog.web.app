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

export type Term = {
	out: HTMLElement;
	input: HTMLInputElement;
	prompt: HTMLElement;
	mode: HTMLElement;
	led: HTMLElement;
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
