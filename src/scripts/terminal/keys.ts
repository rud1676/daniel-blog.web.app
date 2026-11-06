/**
 * 입력창 키 — Tab 완성 · Ctrl+U/L/C/R · ↑↓ 기록 · Esc. (K17)
 * 빈 입력의 Tab은 막지 않는다 — 키보드 사용자가 입력창에 갇히지 않게 (D10).
 * Ctrl 계열은 `ctrlKey && !metaKey`로만 잡는다. Mac의 ⌘ 단축키와 겹치지 않는다.
 * Windows/Linux에서 Ctrl+U(소스 보기)·Ctrl+L(주소창)은 브라우저가 먼저 잡을 수 있다 → help에 clear 명령도 같이 안내한다.
 */
import { COMMAND_NAMES, COMPLETE } from './commands';
import type { Shell } from './index';
import { promptParts, span } from './ui';

/** Tab 두 번으로 볼 시간 */
const DOUBLE_TAB_MS = 600;

export function attachKeys(sh: Shell) {
	const { term } = sh;
	const input = term.input;
	let cursor = 0;
	let seen = 0; // 기록이 늘면 커서를 맨 끝으로
	let lastTab = 0;
	let search: { q: string; at: number; saved: string } | null = null;

	const echo = (text: string) => {
		term.print(...promptParts({ ctx: sh.fs.ctx, cwd: sh.fs.label() }), ` ${text}`).className = 'cmd';
	};

	/* ── Tab 완성 ── */

	/** 단어 하나 → 후보. kind는 그 명령이 받는 인자 종류 */
	function candidates(word: string, kind: 'cmd' | 'dir' | 'path' | 'layer'): { base: string; names: string[] } {
		if (kind === 'cmd') return { base: '', names: COMMAND_NAMES.filter((n) => n.startsWith(word)) };
		if (kind === 'layer') return { base: '', names: [...sh.layers, '-'].filter((n) => n.startsWith(word)) };
		const cut = word.lastIndexOf('/') + 1;
		const base = word.slice(0, cut);
		const prefix = word.slice(cut);
		const hit = sh.fs.resolve(base || '.');
		if (typeof hit === 'string' || hit.file) return { base, names: [] };
		const names =
			hit.dir.length === 0
				? sh.fs.dirs().map((d) => `${d}/`)
				: kind === 'dir'
					? []
					: sh.fs.filesIn(hit.dir[0]).map((p) => `${p.slug}.md`);
		return { base, names: names.filter((n) => n.startsWith(prefix)) };
	}

	const commonPrefix = (xs: string[]) =>
		xs.reduce((a, b) => {
			let i = 0;
			while (i < a.length && a[i] === b[i]) i++;
			return a.slice(0, i);
		});

	function complete() {
		const pos = input.selectionStart ?? input.value.length;
		const before = input.value.slice(0, pos);
		const after = input.value.slice(input.selectionEnd ?? pos);
		const m = before.match(/(\S*)$/)!;
		const word = m[1];
		const head = before.slice(0, before.length - word.length);
		const first = head.trim() === '';
		const cmd = head.trim().split(/\s+/)[0];
		const kind = first ? 'cmd' : COMPLETE[cmd];
		if (!kind) return;

		const { base, names } = candidates(word, kind);
		if (names.length === 0) return; // 후보 없음 → 조용히 (진짜 셸처럼)
		const put = (rest: string) => {
			const v = head + base + rest;
			input.value = v + after;
			input.setSelectionRange(v.length, v.length);
		};
		if (names.length === 1) {
			const n = names[0];
			put(n.endsWith('/') ? n : `${n} `);
			return;
		}
		const common = commonPrefix(names);
		const typed = word.slice(base.length);
		if (common.length > typed.length) {
			put(common);
			lastTab = 0;
			return;
		}
		// 더 못 늘린다 → 두 번째 Tab에 후보 목록 (zsh처럼)
		const now = Date.now();
		if (now - lastTab < DOUBLE_TAB_MS) {
			echo(input.value);
			term.print(...names.flatMap((n, i) => [i ? '  ' : '', n.endsWith('/') ? span('pa', n) : n]));
			lastTab = 0;
		} else lastTab = now;
	}

	/* ── Ctrl+R 기록 검색 ── */

	function findBack(q: string, from: number): number {
		for (let i = Math.min(from, sh.history.length - 1); i >= 0; i--) if (sh.history[i].includes(q)) return i;
		return -1;
	}
	function renderSearch() {
		if (!search) return;
		term.prompt.replaceChildren(span('dim', `(reverse-i-search)'${search.q}':`));
		term.prompt.classList.remove('ai');
	}
	function endSearch(keep: boolean) {
		if (!search) return;
		if (!keep) input.value = search.saved;
		search = null;
		sh.setPrompt(sh.handler ? 'agent' : 'sh');
	}
	function searchKey(e: KeyboardEvent): boolean {
		const s = search!;
		const ctrl = e.ctrlKey && !e.metaKey;
		if (ctrl && e.key.toLowerCase() === 'r') {
			const i = findBack(s.q, s.at - 1);
			if (i >= 0) {
				s.at = i;
				input.value = sh.history[i];
			}
		} else if (e.key === 'Escape' || (ctrl && e.key.toLowerCase() === 'g')) endSearch(false);
		else if (e.key === 'Enter') {
			endSearch(true);
			return false; // 폼 제출은 그대로
		} else if (e.key === 'Backspace') {
			s.q = s.q.slice(0, -1);
			const i = findBack(s.q, sh.history.length - 1);
			s.at = i >= 0 ? i : sh.history.length;
			input.value = i >= 0 ? sh.history[i] : '';
		} else if (e.key.length === 1 && !ctrl && !e.metaKey && !e.altKey) {
			s.q += e.key;
			const i = findBack(s.q, s.at);
			if (i >= 0) {
				s.at = i;
				input.value = sh.history[i];
			}
		} else if (e.key.startsWith('Arrow') || e.key === 'Tab') {
			endSearch(true);
			return false;
		} else return false;
		renderSearch();
		return true;
	}

	input.addEventListener('keydown', (e) => {
		if (e.isComposing) return; // 한글 조합 중
		if (search && searchKey(e)) return void e.preventDefault();
		const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
		const key = e.key.toLowerCase();

		if (e.key === 'Tab' && !e.shiftKey) {
			if (input.value.trim() === '') return; // D10 — 포커스 이동
			e.preventDefault();
			complete();
		} else if (ctrl && key === 'u') {
			e.preventDefault();
			input.setRangeText('', 0, input.selectionStart ?? 0, 'start');
		} else if (ctrl && key === 'l') {
			e.preventDefault();
			term.clear();
		} else if (ctrl && key === 'c') {
			// 글자를 고른 상태면 복사로 둔다
			if (input.selectionStart !== input.selectionEnd) return;
			e.preventDefault();
			if (sh.abort) sh.abort();
			else {
				echo(`${input.value}^C`);
				input.value = '';
			}
		} else if (ctrl && key === 'r') {
			e.preventDefault();
			if (sh.history.length === 0) return;
			search = { q: '', at: sh.history.length, saved: input.value };
			renderSearch();
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			const h = sh.history;
			if (h.length === 0) return;
			if (h.length !== seen) cursor = seen = h.length;
			e.preventDefault();
			cursor = Math.max(0, Math.min(h.length, cursor + (e.key === 'ArrowUp' ? -1 : 1)));
			input.value = h[cursor] ?? '';
		} else if (e.key === 'Escape') sh.abort?.();
	});
}
