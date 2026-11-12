/**
 * /search — 빌드 때 그려 둔 전체 글 목록(PostTable)을 입력값으로 거른다.
 * - 대상: 제목 · 전체 태그 · description (search.astro가 data-search-index JSON으로 넘긴다)
 * - 매칭: 공백으로 나눈 단어가 모두 들어 있으면 맞음(AND), 대소문자 무시, 부분 일치
 * - 검색어는 주소 ?q= 에 남긴다. 입력 중엔 기록을 쌓지 않고 replaceState로 바꾼다
 * - Esc = 비우기. 맞은 글자는 목록에 보이는 텍스트(제목·태그 2개)에 <mark>
 */
const form = document.querySelector<HTMLFormElement>('[data-search-form]');
const input = document.querySelector<HTMLInputElement>('[data-search-input]');
const idle = document.querySelector<HTMLElement>('[data-idle]');
const count = document.querySelector<HTMLElement>('[data-count]');
const empty = document.querySelector<HTMLElement>('[data-empty]');
const emptyMsg = document.querySelector<HTMLElement>('[data-empty-msg]');
const results = document.querySelector<HTMLElement>('[data-results]');
const indexEl = document.querySelector('[data-search-index]');

if (form && input && idle && count && empty && emptyMsg && results && indexEl) {
	const index: Record<string, string> = JSON.parse(indexEl.textContent || '{}');
	const rows = [...results.querySelectorAll<HTMLAnchorElement>('a.tr')].map((row) => {
		// 강조할 칸: 제목·태그 줄 (description은 목록에 안 보여 검색만 된다). 원래 HTML을 기억해 두고 매번 거기서 다시 칠한다
		const cells = [...row.querySelectorAll<HTMLElement>('.name, .tagline')];
		return {
			row,
			text: (index[row.getAttribute('href') ?? ''] ?? row.textContent ?? '').toLowerCase(),
			cells: cells.map((el) => ({ el, html: el.innerHTML })),
		};
	});

	const baseTitle = document.title;
	const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	/** el 안의 텍스트 노드에서 terms를 <mark>로 감싼다 (.pin 배지는 건너뜀) */
	const highlight = (el: HTMLElement, re: RegExp) => {
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
			acceptNode: (n) => (n.parentElement?.closest('.pin') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
		});
		const nodes: Text[] = [];
		while (walker.nextNode()) nodes.push(walker.currentNode as Text);
		for (const node of nodes) {
			const parts = node.data.split(re);
			if (parts.length < 2) continue;
			const frag = document.createDocumentFragment();
			parts.forEach((part, i) => {
				if (!part) return;
				if (i % 2 === 1) {
					const m = document.createElement('mark');
					m.textContent = part;
					frag.append(m);
				} else frag.append(part);
			});
			node.replaceWith(frag);
		}
	};

	const render = (raw: string) => {
		const q = raw.trim();
		const terms = q.toLowerCase().split(/\s+/).filter(Boolean);

		// 주소 ?q= 갱신 (기록은 쌓지 않는다)
		const url = new URL(location.href);
		if (q) url.searchParams.set('q', q);
		else url.searchParams.delete('q');
		history.replaceState(null, '', url);
		document.title = q ? `"${q}" ${baseTitle}` : baseTitle;

		const re = terms.length ? new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi') : null;
		let shown = 0;
		for (const { row, text, cells } of rows) {
			for (const c of cells) c.el.innerHTML = c.html;
			const hit = re !== null && terms.every((t) => text.includes(t));
			row.hidden = !hit;
			if (hit) {
				shown++;
				for (const c of cells) highlight(c.el, re);
			}
		}

		idle.hidden = terms.length > 0;
		results.hidden = shown === 0;
		count.hidden = shown === 0;
		empty.hidden = terms.length === 0 || shown > 0;
		if (shown > 0) {
			count.innerHTML = '';
			const b = document.createElement('b');
			b.textContent = String(shown);
			const dim = document.createElement('span');
			dim.className = 'dim';
			dim.textContent = ` · "${q}"`;
			count.append(b, '편', dim);
		} else if (terms.length) {
			emptyMsg.textContent = `"${q}"에 맞는 글이 없습니다.`;
		}
	};

	const fromUrl = () => {
		input.value = new URLSearchParams(location.search).get('q') ?? '';
		render(input.value);
	};

	input.addEventListener('input', () => render(input.value));
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			input.value = '';
			render('');
		}
	});
	// Enter로 페이지를 다시 불러오지 않는다 (JS 없을 땐 action=/search?q= 로 그냥 이동)
	form.addEventListener('submit', (e) => e.preventDefault());
	// bfcache로 돌아왔을 때도 주소와 화면을 맞춘다
	window.addEventListener('pageshow', (e) => e.persisted && fromUrl());

	fromUrl();
	input.focus();
}
