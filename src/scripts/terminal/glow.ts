/**
 * glow — 글을 터미널 창 안에서 렌더링해서 읽는다. `glow`를 칠 때만 import()로 불러온다 (D6).
 * 본문 = 이미 빌드된 글 페이지(/posts/<slug>/)의 `article .body` (D2). 마크다운을 브라우저에서 다시 변환하지 않는다.
 * DOMParser 문서는 비활성이라 스크립트가 돌지 않고 이미지도 받지 않는다. 그 안에서 정리·그림 자리 표시를 끝낸 뒤 옮긴다.
 * innerHTML은 쓰지 않는다 (D3).
 */
import type { PostMeta } from './fs';
import type { Shell } from './index';
import { openPager } from './pager';
import { el, route, span, ymd } from './ui';

/** 글 HTML에서 지울 것 (D3) */
const DROP = 'script, style, iframe, noscript, object, embed, link, meta, form, [data-giscus]';
/** 그림 자리 표시에 옮겨 적는 속성 */
const IMG_ATTRS = ['src', 'srcset', 'sizes', 'alt', 'width', 'height'] as const;

export async function runGlow(sh: Shell, post: PostMeta, label: string) {
	const page = `/posts/${post.slug}/`;
	const r = await fetch(page);
	if (!r.ok) throw new Error(String(r.status));
	const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
	const src = doc.querySelector('article .body');
	if (!src) {
		sh.term.print(span('err', `glow: cannot render ${label}`), span('dim', ' — '), span('dim', `open ${label}`), span('dim', '으로 보기'));
		return;
	}

	// 1) 정리 — 실행될 수 있는 것·이벤트 속성·javascript: 링크
	for (const n of src.querySelectorAll(DROP)) n.remove();
	for (const n of src.querySelectorAll('*')) {
		for (const a of [...n.attributes]) {
			if (a.name.startsWith('on')) n.removeAttribute(a.name);
			else if ((a.name === 'href' || a.name === 'src') && /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
		}
	}

	// 2) 제목 앞에 # 표시 (진짜 glow처럼 기호를 남긴다)
	for (const h of src.querySelectorAll('h1, h2, h3, h4')) {
		const mark = doc.createElement('span');
		mark.className = 'gh';
		mark.textContent = `${'#'.repeat(Number(h.tagName[1]))} `;
		h.prepend(mark);
	}

	// 3) 그림 → 자리 표시 (K12). 비활성 문서 안에서 바꿔야 옮긴 뒤에도 이미지 요청이 0이다
	for (const img of src.querySelectorAll('img')) {
		const ph = doc.createElement('span');
		ph.className = 'gph';
		for (const a of IMG_ATTRS) {
			const v = img.getAttribute(a);
			if (v) ph.dataset[a] = v;
		}
		ph.append(`[image: ${img.getAttribute('alt') || '그림'}] `);
		const btn = doc.createElement('button');
		btn.type = 'button';
		btn.className = 'gx';
		btn.textContent = '▸ 펼치기';
		ph.append(btn);
		(img.closest('picture') ?? img).replaceWith(ph);
	}

	// 4) 머리말 — 제목, 카테고리 · 레이어 경로 · 날짜, 관점, 정정 사유 (K13: describe post가 하던 일)
	const head = el(
		'header',
		{ class: 'ghead' },
		el('h1', {}, span('gh', '# '), post.title),
		el('p', { class: 'gmeta' }, `${post.category} · `, ...(post.layers.length ? [route(post.layers), ' · '] : []), ymd(post.pubDate)),
		post.stance && el('p', { class: 'gmeta' }, span('pa', 'stance: '), post.stance),
		post.updatedReason && post.updatedDate && el('p', { class: 'gmeta' }, span('warn', `updated ${ymd(post.updatedDate)} — ${post.updatedReason}`)),
	);

	const body = el('div', { class: 'gbody' }, head);
	body.append(...[...document.adoptNode(src).childNodes]);
	body.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest('button.gx');
		if (!btn) return;
		const box = btn.parentElement!;
		if (box.classList.contains('gph')) expand(box);
		else collapse(box);
	});

	sh.term.print(span('dim', `glow: ${label} — q 닫기`));
	openPager(sh, {
		badge: 'glow',
		title: label,
		body,
		progress: true,
		footer: '▲▼ 스크롤 · q 닫기 · o 페이지로 열기',
		onKey(e) {
			if (e.key !== 'o') return false;
			location.href = page;
			return true;
		},
	});
}

/** 자리 표시 → 그림. 여기서 처음 img를 만든다 (이때 처음 요청이 나간다) */
function expand(ph: HTMLElement) {
	const d = ph.dataset;
	const attrs: Record<string, string> = { decoding: 'async' };
	for (const a of IMG_ATTRS) if (d[a]) attrs[a] = d[a]!;
	const fig = el(
		'figure',
		{ class: 'gimg' },
		el('img', attrs),
		el('figcaption', {}, `${d.alt || '그림'} `, el('button', { type: 'button', class: 'gx' }, '▾ 접기')),
	);
	// 접을 때 되돌릴 수 있게 자리 표시를 그대로 들고 있는다
	(fig as HTMLElement & { _ph?: HTMLElement })._ph = ph;
	ph.replaceWith(fig);
}

function collapse(cap: HTMLElement) {
	const fig = cap.closest('figure') as (HTMLElement & { _ph?: HTMLElement }) | null;
	if (fig?._ph) fig.replaceWith(fig._ph);
}
