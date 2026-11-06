/**
 * 시스템 명령 — uname · top · netstat · uptime · date · cal · df. 칠 때만 import()로 불러온다 (D6).
 * 값은 전부 방문자 브라우저·이 탭의 실제 값이고, 못 읽으면 `not supported`로 보인다 (K16). 지어낸 값은 없다.
 *
 * 전송 금지 (D7): 여기서 읽은 값은 화면에만 그린다. 어떤 요청에도 넣지 않는다.
 * 이 파일에는 fetch가 없다 — 리뷰 때 `fetch(` 개수(0)를 센다. (ping·neofetch는 2026-11-06에 뺐다, D19)
 */
import { relPath, runLink, pageOf } from './commands';
import type { PostMeta } from './fs';
import type { Shell } from './index';
import { openPager } from './pager';
import { el, human, kstParts, span, type Part } from './ui';

const ns = () => span('ns', 'not supported');
const val = (v: string | null | undefined): Part => (v ? v : ns());
const err = (sh: Shell, t: string) => sh.term.print(span('err', t));

/* ── 값 읽기 ────────────────────────────────────────── */

type UAData = {
	brands?: { brand: string; version: string }[];
	platform?: string;
	getHighEntropyValues?: (h: string[]) => Promise<Record<string, string>>;
};
type Nav = Navigator & {
	userAgentData?: UAData;
	deviceMemory?: number;
	getBattery?: () => Promise<{ level: number; charging: boolean }>;
	connection?: { effectiveType?: string; rtt?: number; downlink?: number };
};
const nav = navigator as Nav;

type UA = { kernel: string; os: string; browser: string; engine: string; arch: string | null };

/**
 * OS·브라우저·엔진. 버전은 정확할 때만 찍는다 — Safari·Firefox의 macOS 버전, Chrome의 Android 버전은 UA에 고정값이 들어 있다.
 * 그래서 OS 버전은 userAgentData.platformVersion(Chromium 계열)이 있을 때만 쓴다.
 */
function parseUA(hi: Record<string, string> | undefined): UA {
	const ua = navigator.userAgent;
	const major = hi?.platformVersion ? Number(hi.platformVersion.split('.')[0]) : NaN;
	let os = nav.userAgentData?.platform || 'unknown';
	let kernel = 'unknown';
	let ver = '';
	if (/iPhone|iPad|iPod/.test(ua)) [os, kernel] = [/iPad/.test(ua) ? 'iPadOS' : 'iOS', 'Darwin'];
	else if (/Android/.test(ua)) [os, kernel, ver] = ['Android', 'Linux', Number.isNaN(major) ? '' : String(major)];
	else if (/Macintosh|Mac OS X/.test(ua)) [os, kernel, ver] = ['macOS', 'Darwin', Number.isNaN(major) ? '' : String(major)];
	else if (/Windows/.test(ua)) [os, kernel, ver] = ['Windows', 'Windows_NT', Number.isNaN(major) ? '' : major >= 13 ? '11' : '10'];
	else if (/CrOS/.test(ua)) [os, kernel] = ['ChromeOS', 'Linux'];
	else if (/Linux/.test(ua)) [os, kernel] = ['Linux', 'Linux'];

	let browser = '';
	const brands = (nav.userAgentData?.brands ?? []).filter((b) => !/not.?a.?brand/i.test(b.brand));
	const pick = brands.find((b) => b.brand !== 'Chromium') ?? brands[0];
	if (pick) browser = `${pick.brand.replace(/^(Google|Microsoft) /, '')} ${pick.version}`;
	else {
		const m =
			ua.match(/(Firefox|FxiOS|EdgiOS|Edg|OPR|SamsungBrowser|CriOS|Chrome)\/(\d+)/) ??
			(/Safari\//.test(ua) ? ua.match(/(Version)\/(\d+)/) : null);
		const names: Record<string, string> = { FxiOS: 'Firefox', EdgiOS: 'Edge', Edg: 'Edge', OPR: 'Opera', CriOS: 'Chrome', Version: 'Safari' };
		browser = m ? `${names[m[1]] ?? m[1]} ${m[2]}` : 'unknown';
	}
	const ios = os === 'iOS' || os === 'iPadOS';
	const engine = /Firefox\//.test(ua) && !ios ? 'Gecko' : ios || /^Safari/.test(browser) ? 'WebKit' : 'Blink';

	let arch: string | null = null;
	if (hi?.architecture) {
		const b64 = hi.bitness === '64';
		arch = hi.architecture === 'arm' ? (b64 ? 'arm64' : 'arm') : hi.architecture === 'x86' ? (b64 ? 'x86_64' : 'x86') : hi.architecture;
	}
	return { kernel, os: ver ? `${os} ${ver}` : os, browser, engine, arch };
}

async function probe() {
	const hi = await nav.userAgentData
		?.getHighEntropyValues?.(['platformVersion', 'architecture', 'bitness'])
		.catch(() => undefined);
	const bat = await nav.getBattery?.().catch(() => undefined);
	return {
		...parseUA(hi),
		cores: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : null,
		memory: nav.deviceMemory ? `${nav.deviceMemory} GB (approx)` : null,
		battery: bat ? `${Math.round(bat.level * 100)}%${bat.charging ? ' (charging)' : ''}` : null,
		resolution: `${screen.width}x${screen.height} @${Math.round(devicePixelRatio * 100) / 100}x`,
		theme: document.documentElement.dataset.theme ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
		locale: `${navigator.language} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
	};
}

/** 3 secs · 12 mins · 1 hour, 5 mins */
function dur(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s} sec${s === 1 ? '' : 's'}`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m} min${m === 1 ? '' : 's'}`;
	const h = Math.floor(m / 60);
	return `${h} hour${h === 1 ? '' : 's'}, ${m % 60} min${m % 60 === 1 ? '' : 's'}`;
}

/** 블로그 나이(일) — 첫 커밋 KST 날짜부터 */
const blogDays = (born: string) => Math.max(0, Math.floor((Date.now() - Date.parse(`${born}T00:00:00+09:00`)) / 86_400_000));

const hhmm = (d = new Date(), sec = false) =>
	d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...(sec ? { second: '2-digit' } : {}), hour12: false });

/* ── uname ────────────────────────────────────────── */

export async function uname(sh: Shell, args: string[]) {
	const p = await probe();
	if (!args.some((a) => a.startsWith('-') && a.includes('a'))) return void sh.term.print(p.kernel);
	sh.term.print(`${p.kernel} ${p.os} · ${p.browser} · ${p.engine} · arch `, val(p.arch));
}

/* ── 이 탭의 연결 (top·netstat) ─────────────────────── */

type Conn = { proto: string; host: string; path: string; recv: string; ms: string; refused: boolean };

/** Resource Timing의 실제 항목 (D9). 캐시에서 온 건 transferSize 0 → cache */
function connections(sh: Shell): Conn[] {
	const agentHost = new URL(sh.agentUrl).host;
	const entries = [
		...(performance.getEntriesByType('navigation') as PerformanceResourceTiming[]),
		...(performance.getEntriesByType('resource') as PerformanceResourceTiming[]),
	];
	const rows = entries.map((e) => {
		const u = new URL(e.name, location.href);
		const port = u.port || (u.protocol === 'http:' ? '80' : '443');
		const refused = sh.agent === 'down' && u.host === agentHost;
		const recv = refused ? '—' : e.transferSize === 0 && e.decodedBodySize > 0 ? 'cache' : e.transferSize ? human(e.transferSize) : '—';
		return { proto: (e.nextHopProtocol || '—').replace(/^http\/1\.[01]$/, 'h1'), host: `${u.hostname}:${port}`, path: u.pathname + (u.pathname === '/favicon.ico' ? u.search : ''), recv, ms: `${Math.round(e.duration)}ms`, refused };
	});
	// dagent 서버가 꺼져 있는데 요청 기록이 안 남았으면(브라우저마다 다르다) 한 줄 더한다
	if (sh.agent === 'down' && !rows.some((r) => r.refused))
		rows.push({ proto: '—', host: `${agentHost}:443`, path: '/v1/stats', recv: '—', ms: '—', refused: true });
	return rows;
}

const row = (cls: string, cells: Part[]) => el('div', { class: cls }, ...cells.map((c) => el('span', {}, c)));

export function netstat(sh: Shell) {
	const { term } = sh;
	term.print('Active Internet connections (this tab)');
	term.block(row('ns-row th', ['Proto', 'Foreign Address', 'State', 'Recv', 'Time', 'Path']));
	for (const c of connections(sh))
		term.block(
			row('ns-row', [c.proto, c.host, c.refused ? span('err', 'REFUSED') : 'ESTABLISHED', c.recv, c.ms, span('dim', c.refused ? `${c.path}  (dagent 꺼짐)` : c.path)]),
		);
	const cn = nav.connection;
	term.print(
		'connection: ',
		cn?.effectiveType ? `${cn.effectiveType}${cn.rtt !== undefined ? ` · rtt ≈ ${cn.rtt}ms` : ''}` : ns(),
	);
}

export function top(sh: Shell) {
	const body = el('div', { class: 'topv' });
	let frames = 0;
	let fps = 0;
	let raf = 0;
	const tick = () => {
		frames++;
		raf = requestAnimationFrame(tick);
	};
	raf = requestAnimationFrame(tick);

	const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
	const draw = () => {
		const conns = connections(sh);
		const dagent = sh.handler ? '실행 중' : sh.agent === 'down' ? '꺼짐' : '실행 전';
		const total = conns.length + 1;
		body.replaceChildren(
			el('p', {}, `top - ${hhmm(new Date(), true)} up ${dur(performance.now())},  1 user,  `, span('hi', `${fps} fps`)),
			el('p', {}, 'Tasks: ', el('b', {}, String(total)), ' total, ', el('b', {}, '1'), ' running, ', el('b', {}, String(total - 1)), ' sleeping   CPU: ', val(navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : null)),
			el('p', {}, 'Mem: ', val(nav.deviceMemory ? `${nav.deviceMemory} GB (approx)` : null), '   JS heap: ', mem ? el('b', {}, `${human(mem.usedJSHeapSize)} used / ${human(mem.jsHeapSizeLimit)} limit`) : ns()),
			el('p', {}, ' '),
			row('tp th', ['PID', 'USER', 'S', 'SIZE', 'TIME', 'COMMAND']),
			...conns.map((c, i) => row('tp', [String(i + 1), 'guest', i === 0 ? 'R' : 'S', c.recv, c.ms, i === 0 ? `shell  ${c.path}` : c.path])),
			row('tp', [String(total), 'guest', sh.handler ? 'R' : 'S', '—', '—', `dagent  (${dagent})`]),
		);
	};
	draw();
	const iv = setInterval(() => {
		fps = frames;
		frames = 0;
		draw();
	}, 1000);

	sh.term.print(span('dim', 'top — q 종료'));
	openPager(sh, {
		badge: 'top',
		title: '이 탭의 프로세스',
		body,
		footer: '1초마다 갱신 · q 종료 · 프로세스 = 이 탭이 불러온 파일 (Resource Timing)',
		onClose() {
			cancelAnimationFrame(raf);
			clearInterval(iv);
		},
	});
}

/* ── uptime · date · cal · df ───────────────────────── */

export function uptime(sh: Shell) {
	const parts = [` ${hhmm()}  up ${dur(performance.now())} (this tab)`];
	if (sh.born) parts.push(`blog up ${blogDays(sh.born)} days (since ${sh.born})`);
	parts.push(`${sh.fs.all().length} posts`);
	sh.term.print(parts.join(' · '));
}

/** Thu Nov  5 21:14:03 GMT+9 2026 — 방문자 시간대 */
export function date(sh: Shell) {
	const p = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
			timeZoneName: 'short',
		})
			.formatToParts(new Date())
			.map((x) => [x.type, x.value]),
	);
	sh.term.print(`${p.weekday} ${p.month} ${p.day.padStart(2)} ${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second} ${p.timeZoneName} ${p.year}`);
}

/** 이번 달 달력. 오늘 + 글 쓴 날(KST, D17) — 누르면 그 글을 glow로 */
export function cal(sh: Shell) {
	const now = new Date();
	const y = now.getFullYear();
	const m = now.getMonth();
	const byDay = new Map<number, PostMeta>();
	for (const p of sh.fs.all()) {
		const k = kstParts(p.pubDate);
		if (Number(k.y) === y && Number(k.m) === m + 1 && !byDay.has(Number(k.d))) byDay.set(Number(k.d), p);
	}
	const title = `${now.toLocaleString('en-US', { month: 'long' })} ${y}`;
	const pre = el('pre', { class: 'cal' }, `${' '.repeat(Math.floor((20 - title.length) / 2))}${title}\nSu Mo Tu We Th Fr Sa\n`);
	const first = new Date(y, m, 1).getDay();
	const days = new Date(y, m + 1, 0).getDate();
	pre.append('   '.repeat(first));
	for (let d = 1; d <= days; d++) {
		const col = (first + d - 1) % 7;
		const post = byDay.get(d);
		if (d < 10) pre.append(' '); // 두 칸 맞춤 — 밑줄·배경이 빈칸까지 번지지 않게 밖에 둔다
		if (post) {
			const a = runLink(sh, pageOf(post), String(d), () => `glow ${relPath(sh, post)}`);
			a.classList.add('post');
			pre.append(a);
		} else if (d === now.getDate()) pre.append(span('today', String(d)));
		else pre.append(String(d));
		if (col === 6 && d < days) pre.append('\n');
		else if (d < days) pre.append(' ');
	}
	sh.term.block(pre);
	sh.term.print(span('post', '■'), span('dim', ' 글 쓴 날 (누르면 그 글) · '), span('today-mark', '■'), span('dim', ' 오늘'));
}

/** 이 사이트가 쓰는 브라우저 저장소 (navigator.storage.estimate) */
export async function df(sh: Shell) {
	const est = await navigator.storage?.estimate?.().catch(() => undefined);
	if (!est?.quota) return void sh.term.print('df: ', ns());
	const used = est.usage ?? 0;
	sh.term.block(row('ns-row df th', ['Filesystem', 'Size', 'Used', 'Avail', 'Use%', 'Mounted on']));
	sh.term.block(
		row('ns-row df', ['browser', human(est.quota), human(used), human(est.quota - used), `${Math.round((used / est.quota) * 100)}%`, `/storage/${location.hostname}`]),
	);
}
