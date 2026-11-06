/**
 * "대체 화면(alt screen)" — glow·top이 터미널 창을 잠깐 차지했다가 돌려준다.
 * 열면 지금까지의 출력이 가려지고(지워지지 않는다), 닫으면 그대로 돌아온다. 진짜 터미널의 less·top처럼.
 * 키: q · Esc · Ctrl+C 닫기, j/k · ↑↓ 한 줄, Space · PageDown / b · PageUp 한 쪽, g · G 처음/끝.
 */
import type { Shell } from './index';
import { el, span, type Part } from './ui';

export type Pager = {
	/** 스크롤되는 본문 칸 */
	body: HTMLElement;
	/** 아래 줄 오른쪽 (진행률 등) */
	setStatus: (text: string) => void;
	close: () => void;
};

export type PagerOpts = {
	badge: string;
	title: string;
	body: Node;
	footer: Part;
	/** 기본 키 말고 더 받을 키. 처리했으면 true */
	onKey?: (e: KeyboardEvent) => boolean;
	onClose?: () => void;
	/** 스크롤 진행률을 오른쪽 아래에 */
	progress?: boolean;
};

const LINE = 40;

export function openPager(sh: Shell, opts: PagerOpts): Pager {
	sh.pager?.close();
	const { term } = sh;
	const z = term.out.closest<HTMLElement>('.z')!;
	const alt = term.alt;

	const status = span('gr', '');
	const scroller = el('div', { class: 'gscroll', tabindex: '0' }, opts.body);
	const closeBtn = el('button', { type: 'button', class: 'gr gq' }, 'q 닫기');
	alt.replaceChildren(
		el('div', { class: 'gtop' }, span('badge', opts.badge), ' ', el('span', { class: 'gt' }, opts.title), closeBtn),
		scroller,
		el('div', { class: 'gbar' }, el('span', {}, opts.footer), status),
	);
	alt.hidden = false;
	z.classList.add('alt-on');

	const updateProgress = () => {
		const max = scroller.scrollHeight - scroller.clientHeight;
		status.textContent = max <= 0 ? '100%' : `${Math.round((scroller.scrollTop / max) * 100)}%`;
	};
	if (opts.progress) {
		scroller.addEventListener('scroll', updateProgress, { passive: true });
		requestAnimationFrame(updateProgress);
	}

	function onKey(e: KeyboardEvent) {
		const page = scroller.clientHeight - LINE;
		const by = (y: number) => scroller.scrollBy({ top: y });
		if (e.key === 'q' || e.key === 'Escape' || (e.ctrlKey && e.key.toLowerCase() === 'c')) pager.close();
		else if (e.key === 'j' || e.key === 'ArrowDown') by(LINE);
		else if (e.key === 'k' || e.key === 'ArrowUp') by(-LINE);
		else if (e.key === ' ' || e.key === 'PageDown') by(e.shiftKey ? -page : page);
		else if (e.key === 'b' || e.key === 'PageUp') by(-page);
		else if (e.key === 'g' || e.key === 'Home') scroller.scrollTop = 0;
		else if (e.key === 'G' || e.key === 'End') scroller.scrollTop = scroller.scrollHeight;
		else if (!(e.metaKey || e.altKey) && opts.onKey?.(e)) {
			// 처리됨
		} else return; // 그 밖의 키는 브라우저에 (Tab 이동 등)
		e.preventDefault();
	}
	alt.addEventListener('keydown', onKey);
	closeBtn.addEventListener('click', () => pager.close());

	const pager: Pager = {
		body: scroller,
		setStatus: (t) => {
			status.textContent = t;
		},
		close() {
			if (sh.pager !== pager) return;
			sh.pager = null;
			alt.removeEventListener('keydown', onKey);
			alt.replaceChildren();
			alt.hidden = true;
			z.classList.remove('alt-on');
			opts.onClose?.();
			term.scroll();
			term.input.focus();
		},
	};
	sh.pager = pager;
	scroller.focus();
	return pager;
}
