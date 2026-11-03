/**
 * 글 상세 오른쪽 목차: 지금 읽는 절(h2)에 .on, 아래에 `35% · 약 5분 남음`.
 * 읽기 보조라 글 상세 JS 예산(≤ 10kB) 안에서 허용된다. 목차가 없는 글(h2 < 2)이면 아무것도 안 한다.
 * 960px 이하에선 목차가 CSS로 숨겨지지만 스크립트는 가벼워서 그대로 둔다.
 */
const box = document.querySelector<HTMLElement>('[data-toc]');

if (box) {
	const links = [...box.querySelectorAll<HTMLAnchorElement>('a[data-slug]')];
	const heads = links
		.map((a) => document.getElementById(a.dataset.slug!))
		.filter((h): h is HTMLElement => h !== null);
	const pct = box.querySelector<HTMLElement>('[data-readpct]');
	const minutes = Number(box.dataset.minutes) || 1;

	const update = () => {
		// 화면 위쪽 1/3 선을 지난 마지막 h2 = 지금 읽는 절
		const line = window.innerHeight / 3;
		let current = 0;
		heads.forEach((h, i) => {
			if (h.getBoundingClientRect().top <= line) current = i;
		});
		links.forEach((a, i) => a.classList.toggle('on', i === current));

		const max = document.documentElement.scrollHeight - window.innerHeight;
		const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
		const left = Math.ceil(minutes * (1 - p));
		if (pct) pct.textContent = left > 0 ? `${Math.round(p * 100)}% · 약 ${left}분 남음` : '다 읽었어요';
	};

	let queued = false;
	const onScroll = () => {
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			update();
		});
	};
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll);
	update();
}
