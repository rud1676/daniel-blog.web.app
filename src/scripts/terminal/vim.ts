/**
 * vim — 원문 마크다운을 읽기 전용 vim 화면으로 (D21). 칠 때만 import()로 불러온다.
 * 대체 화면(pager) 위에 줄 번호 · 상태 줄 · `:` 명령 줄을 얹는다. 고치는 키는 전부 막고 vim 문구로 답한다.
 * 키: j/k ↑↓ 한 줄 · Ctrl+D/U 반 쪽 · Ctrl+F/B 한 쪽 · gg/G 처음/끝 · :<n> 그 줄로 · :q · :q! · ZZ 닫기.
 */
import { fetchRaw } from './commands';
import type { PostMeta } from './fs';
import type { Shell } from './index';
import { openPager } from './pager';
import { el, span } from './ui';

/** 고치는 키 → 읽기 전용 경고 (vim: E21) */
const EDIT_KEYS = new Set(['i', 'I', 'a', 'A', 'o', 'O', 'x', 'X', 's', 'S', 'c', 'C', 'd', 'D', 'p', 'P', 'r', 'R', 'u']);
const E21 = "E21: Cannot make changes, 'modifiable' is off";

export async function runVim(sh: Shell, post: PostMeta, label: string, cmd: string) {
	const raw = (await fetchRaw(post.slug)).replace(/\r\n/g, '\n').replace(/\n$/, '');
	const lines = raw.split('\n');
	const width = String(lines.length).length;

	// 줄 = 번호 칸 + 본문. frontmatter 키 · 제목 줄 · 코드 펜스만 살짝 색을 입힌다
	const rows: HTMLElement[] = [];
	let front = lines[0] === '---';
	let fence = false;
	lines.forEach((line, i) => {
		let text: Node | string = line || ' ';
		if (front && i > 0 && line === '---') front = false;
		const key = front ? line.match(/^([A-Za-z_][\w-]*:)(.*)$/) : null;
		if (/^(```|~~~)/.test(line)) fence = !fence;
		if (key) text = el('span', {}, span('pa', key[1]), key[2]);
		else if (line === '---' && (i === 0 || !fence)) text = span('dim', line);
		else if (!fence && /^#{1,6}\s/.test(line)) text = span('vh', line);
		else if (/^(```|~~~)/.test(line)) text = span('dim', line);
		rows.push(el('p', { class: 'vl' }, span('vn', String(i + 1).padStart(width)), el('span', { class: 'vt' }, text)));
	});
	const body = el('div', { class: 'vbody' }, ...rows, ...Array.from({ length: 3 }, () => el('p', { class: 'vl vtil' }, span('vn', '~'))));

	// 아래 줄 = 명령 줄. 처음엔 vim처럼 파일 정보
	const cmdline = el('span', { class: 'vcmd' }, `"${label}" [readonly] ${lines.length}L, ${post.size}B`);
	const say = (text: string, error = false) => {
		cmdline.className = error ? 'vcmd err' : 'vcmd';
		cmdline.textContent = text;
	};
	let typing: string | null = null; // `:` 뒤에 친 글자
	let pending = ''; // gg · ZZ 같은 두 글자 키

	sh.term.print(span('dim', `${cmd}: ${label} — :q 닫기`));
	const pager = openPager(sh, {
		badge: cmd,
		title: `${label} [readonly]`,
		body,
		footer: cmdline,
		intercept: true,
		onKey(e) {
			const ctrl = e.ctrlKey && !e.metaKey;
			// ── `:` 명령 줄 ──
			if (typing !== null) {
				if (e.key === 'Escape' || (ctrl && e.key.toLowerCase() === 'c')) {
					typing = null;
					say('');
				} else if (e.key === 'Backspace') {
					if (typing === '') {
						typing = null;
						say('');
					} else say(`:${(typing = typing.slice(0, -1))}`);
				} else if (e.key === 'Enter') {
					const c = typing.trim();
					typing = null;
					run(c);
				} else if (e.key.length === 1 && !ctrl) say(`:${(typing += e.key)}`);
				return true;
			}
			// ── 일반 모드 ──
			const k = e.key;
			const two = pending + k;
			pending = '';
			if (k === ':') {
				typing = '';
				say(':');
			} else if (two === 'gg') goLine(1);
			else if (two === 'ZZ' || two === 'ZQ') pager.close();
			else if (k === 'g' || k === 'Z') pending = k;
			else if (k === 'G') goLine(lines.length);
			else if (ctrl && (k === 'd' || k === 'u')) scrollBy((k === 'd' ? 0.5 : -0.5) * view());
			else if (ctrl && (k === 'f' || k === 'b')) scrollBy((k === 'f' ? 1 : -1) * view());
			else if (ctrl && k === 'c') say('Type  :qa!  and press <Enter> to exit Vim');
			else if (k === 'Escape') say('');
			else if (k === 'q') say('recording는 안 돼요 — :q 로 닫기');
			else if (!ctrl && !e.altKey && EDIT_KEYS.has(k)) say(E21, true);
			else return false; // j/k ↑↓ Space 등은 pager 기본 키로
			return true;
		},
	});
	const scroller = pager.body;

	const view = () => scroller.clientHeight;
	const scrollBy = (y: number) => scroller.scrollBy({ top: y });
	function goLine(n: number) {
		const row = rows[Math.max(1, Math.min(lines.length, n)) - 1];
		scroller.scrollTop = row.offsetTop; // .vbody가 position: relative라 offsetTop = 본문 안 위치
	}

	function run(c: string) {
		if (/^(q|q!|qa|qa!|quit|wq|wq!|x|x!)$/.test(c)) {
			// 고친 게 없으니 :wq · :x도 그냥 닫힌다 (vim과 같다)
			pager.close();
		} else if (/^w!?(\s|$)/.test(c)) say(c.startsWith('w!') ? `"${label}" E212: Can't open file for writing` : "E45: 'readonly' option is set (add ! to override)", true);
		else if (/^\d+$/.test(c)) {
			goLine(Number(c));
			say('');
		} else if (c === '$') {
			goLine(lines.length);
			say('');
		} else if (c === '') say('');
		else say(`E492: Not an editor command: ${c}`, true);
	}

	// 오른쪽 아래 = 맨 위에 보이는 줄 번호 · 위치 (Top · Bot · NN%)
	function where() {
		const top = scroller.scrollTop;
		let lo = 0;
		let hi = rows.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (rows[mid].offsetTop <= top + 1) lo = mid;
			else hi = mid - 1;
		}
		const max = scroller.scrollHeight - scroller.clientHeight;
		const pos = max <= 0 ? 'All' : scroller.scrollTop <= 0 ? 'Top' : scroller.scrollTop >= max - 1 ? 'Bot' : `${Math.round((scroller.scrollTop / max) * 100)}%`;
		pager.setStatus(`${lo + 1},1    ${pos}`);
	}
	scroller.addEventListener('scroll', where, { passive: true });
	requestAnimationFrame(where);
}
