/**
 * /cli 명령 표. 레이어·카테고리 이름은 sh.layers·sh.fs(=data-layers·data-categories·posts.json)에서만 가져온다.
 * help 줄은 HELP에 — 그 STEP까지 만든 명령만 적는다 (plan D13).
 */
import { fileName, type FsErr, type Hit, type PostMeta } from './fs';
import type { Shell } from './index';
import { el, human, layerSpan, link, mmdd, span, type Part } from './ui';

export type Cmd = (args: string[], sh: Shell) => void | Promise<void>;

/** help 표 한 줄 = 명령 한 묶음 */
const HELP: Array<[Part, string]> = [
	['ls [-l] [-a] · pwd · tree', '~/<카테고리>/<글>.md — -l 레이어·날짜·제목, -a는 . ..'],
	['cd ./<폴더> · cd ..', '폴더 이동 (상대 경로만)'],
	['cat <글>.md', '원문 마크다운 그대로'],
	['glow <글>.md', '렌더링해서 읽기 · q 닫기'],
	['open <글>.md | /about | /posts', '페이지로 열기'],
	['kubectx [<레이어> | -]', '레이어 컨텍스트 — ls·tree가 그 레이어만'],
	['neofetch · top · netstat · ping', '이 브라우저·이 탭의 실제 값 (어디로도 보내지 않는다)'],
	['uname · uptime · date · cal · df -h', '못 읽는 값은 not supported'],
	['git log [-n N]', '이 블로그의 변경 이력'],
	['theme dark | light · clear', '테마 · 화면 지우기 (Ctrl+L · ⌘K)'],
	['Tab · Tab Tab', '명령·파일·폴더·레이어 완성 · 후보 목록'],
	['Ctrl+U · Ctrl+L · Ctrl+C', '줄 지우기 · 화면 지우기 · 멈춤'],
	['↑↓ · Ctrl+R · history · !!', '기록 (이 페이지에서만)'],
];

/** Tab 완성 — 명령 이름 후보 (help에 보이는 명령만. 재미 반응은 숨은 명령이라 뺀다) */
export const COMMAND_NAMES = [
	'cal',
	'cat',
	'cd',
	'clear',
	'dagent',
	'date',
	'df',
	'git',
	'glow',
	'help',
	'history',
	'kubectx',
	'ls',
	'neofetch',
	'netstat',
	'open',
	'ping',
	'pwd',
	'theme',
	'top',
	'tree',
	'uname',
	'uptime',
];
/** Tab 완성 — 명령 뒤 인자 종류 */
export const COMPLETE: Record<string, 'dir' | 'path' | 'layer'> = {
	cd: 'dir',
	tree: 'dir',
	ls: 'path',
	cat: 'path',
	glow: 'path',
	open: 'path',
	kubectx: 'layer',
};

/** 페이지로 열 수 있는 주소. ~ = 홈. /projects는 입구를 숨겨 둔 상태라 뺀다 */
const PAGES = ['/', '/posts', '/about', '/cli'];

type GitLine = { short: string; date: string; kind: string; text: string; href: string };

const err = (sh: Shell, text: string) => sh.term.print(span('err', text));
export const pageOf = (p: PostMeta) => `/posts/${p.slug}/`;

/** 지금 위치에서 그 글을 가리키는 상대 경로 */
export function relPath(sh: Shell, p: PostMeta): string {
	const cwd = sh.fs.cwd;
	if (cwd.length === 1 && cwd[0] === p.category) return fileName(p);
	return `${cwd.length ? '..' : '.'}/${p.category}/${fileName(p)}`;
}

/** 셸 안에서 한 줄을 친 것처럼 실행하는 링크 (cal·ls 파일명·cat 끝줄). 새 탭(⌘·Ctrl·가운데 클릭)은 href 그대로 */
export function runLink(sh: Shell, href: string, text: string, line: () => string) {
	const a = link(href, text);
	a.addEventListener('click', (e) => {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		void sh.run(line());
	});
	return a;
}

/** 파일 이름 — 누르면 glow (K6). 새 탭으로 열면 글 페이지 */
const fileLink = (sh: Shell, p: PostMeta) => runLink(sh, pageOf(p), fileName(p), () => `glow ${relPath(sh, p)}`);

/** 경로 에러 → 명령별 문구 */
function fsError(cmd: string, path: string, e: FsErr): string {
	if (cmd === 'cd') {
		if (e === 'denied') return `cd: permission denied: ${path}`;
		if (e === 'notdir') return `cd: not a directory: ${path}`;
		return `cd: no such file or directory: ${path}`;
	}
	if (e === 'denied') return `${cmd}: ${path}: Permission denied`;
	if (e === 'notdir') return `${cmd}: ${path}: Not a directory`;
	return `${cmd}: ${path}: No such file or directory`;
}

/* ── ls ─────────────────────────────────────────────── */

const newest = (posts: PostMeta[]) => posts.reduce<string | undefined>((a, p) => (!a || p.pubDate > a ? p.pubDate : a), undefined);

/** ls -l 한 줄. 6칸 그리드(cli.astro .ls) — 모바일은 마지막 칸(이름·제목)만 */
function lsRow(perm: string, group: Part, size: string, date: string, name: Part, title?: string) {
	return el(
		'div',
		{ class: 'ls' },
		span('dim', perm),
		span('dim', 'daniel'),
		el('span', {}, group),
		span('dim', size),
		span('dim', date),
		el('span', {}, name, title && span('dim ttl', `  # ${title}`)),
	);
}

function layerList(layers: string[]): DocumentFragment {
	const f = document.createDocumentFragment();
	layers.forEach((l, i) => f.append(...(i ? [',', layerSpan(l)] : [layerSpan(l)])));
	return f;
}

/** 폴더 줄 그룹 칸 = 폴더 이름 (목업: `.`이 ~/work면 work, 홈이면 daniel) */
const dirGroup = (dir: string[]) => span('dim', dir.length ? dir[dir.length - 1] : 'daniel');

function listDir(sh: Shell, dir: string[], long: boolean, all: boolean) {
	const { fs, term } = sh;
	const subdirs = dir.length === 0 ? fs.dirs() : [];
	const files = dir.length === 1 ? fs.filesIn(dir[0]) : [];

	if (!long) {
		const names: Part[] = [
			...(all ? [span('pa', '.'), span('pa', '..')] : []),
			...subdirs.map((d) => span('pa', `${d}/`)),
			...files.map((p) => fileLink(sh, p)),
		];
		if (names.length) term.print(...names.flatMap((n, i) => (i ? ['  ', n] : [n])));
		return;
	}

	term.print(span('dim', `total ${files.length}`));
	if (all) {
		const parent = dir.slice(0, -1);
		term.block(lsRow('dr-xr-xr-x', dirGroup(dir), '', mmdd(newest(fs.postsUnder(dir))), span('pa', '.')));
		// 홈의 ..은 /home — 보이기만 하고 cd ..은 막힌다
		term.block(
			lsRow('dr-xr-xr-x', dir.length ? dirGroup(parent) : span('dim', 'home'), '', mmdd(newest(fs.postsUnder(parent))), span('pa', '..')),
		);
	}
	for (const d of subdirs) term.block(lsRow('dr-xr-xr-x', dirGroup([d]), '', mmdd(newest(fs.filesIn(d))), span('pa', `${d}/`)));
	for (const p of files) term.block(lsRow('-r--r--r--', layerList(p.layers), human(p.size), mmdd(p.pubDate), fileLink(sh, p), p.title));
	if (files.length) term.print(span('dim', '이름을 누르면 glow'));
}

function ls(args: string[], sh: Shell) {
	const flags = new Set<string>();
	const paths: string[] = [];
	for (const a of args) {
		if (a.startsWith('-') && a.length > 1) {
			for (const ch of a.slice(1)) {
				if (ch !== 'l' && ch !== 'a') return void err(sh, `ls: invalid option -- '${ch}'`);
				flags.add(ch);
			}
		} else paths.push(a);
	}
	const long = flags.has('l');
	const all = flags.has('a');
	const targets = paths.length ? paths : ['.'];
	targets.forEach((path, i) => {
		const hit = sh.fs.resolve(path);
		if (typeof hit === 'string') return void err(sh, fsError('ls', path, hit));
		if (hit.file) {
			const p = hit.file;
			if (long) sh.term.block(lsRow('-r--r--r--', layerList(p.layers), human(p.size), mmdd(p.pubDate), fileLink(sh, p), p.title));
			else sh.term.print(fileLink(sh, p));
			return;
		}
		if (targets.length > 1) sh.term.print(span('pa', `${path}:`));
		listDir(sh, hit.dir, long, all);
		if (targets.length > 1 && i < targets.length - 1) sh.term.print('');
	});
}

/* ── cat ──────────────────────────────────────────── */

/** 원문 캐시 (이 페이지 안에서만) */
const rawCache = new Map<string, Promise<string>>();
function fetchRaw(slug: string): Promise<string> {
	let p = rawCache.get(slug);
	if (!p) {
		p = fetch(`/posts/${slug}.md`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))));
		p.catch(() => rawCache.delete(slug)); // 실패는 캐시하지 않는다
		rawCache.set(slug, p);
	}
	return p;
}

async function cat(args: string[], sh: Shell) {
	const path = args[0];
	if (!path) return void err(sh, 'usage: cat <글>.md');
	const hit = sh.fs.resolve(path);
	if (typeof hit === 'string') return void err(sh, fsError('cat', path, hit));
	if (!hit.file) return void err(sh, `cat: ${path}: Is a directory`);
	const post = hit.file;

	const lines = (await fetchRaw(post.slug)).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
	// 줄을 한 번에 붙인다 (큰 글도 스크롤 한 번). frontmatter 안의 `key:`만 색을 입힌다
	const frag = document.createDocumentFragment();
	const inFront = lines[0] === '---';
	let front = inFront;
	lines.forEach((line, i) => {
		if (inFront && line === '---') {
			frag.append(el('p', { class: 'dim' }, line));
			if (i > 0) front = false;
			return;
		}
		const key = front ? line.match(/^([A-Za-z_][\w-]*:)(.*)$/) : null;
		frag.append(key ? el('p', {}, span('pa', key[1]), key[2]) : el('p', {}, line));
	});
	sh.term.block(frag);
	sh.term.print(
		span('dim', `EOF · ${lines.length} lines · `),
		runLink(sh, pageOf(post), 'glow', () => `glow ${path}`),
		span('dim', '로 렌더링해서 읽기 · '),
		link(pageOf(post), 'open'),
		span('dim', '으로 페이지 열기'),
	);
}

/* ── glow ─────────────────────────────────────────── */

async function glow(args: string[], sh: Shell) {
	const path = args[0];
	if (!path) return void err(sh, 'usage: glow <글>.md');
	const hit = sh.fs.resolve(path);
	if (typeof hit === 'string') return void err(sh, fsError('glow', path, hit));
	if (!hit.file) return void err(sh, `glow: ${path}: Is a directory`);
	const { runGlow } = await import('./glow');
	await runGlow(sh, hit.file, `${sh.fs.label(hit.dir)}/${fileName(hit.file)}`);
}

/* ── tree ───────────────────────────────────────────── */

function tree(args: string[], sh: Shell) {
	const { fs, term } = sh;
	const path = args[0] ?? '.';
	const hit = fs.resolve(path);
	if (typeof hit === 'string') return void err(sh, fsError('tree', path, hit));
	if (hit.file) return void term.print(fileLink(sh, hit.file));

	const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	let nDirs = 0;
	let nFiles = 0;
	term.print(args[0] ?? '.');
	const fileLines = (files: PostMeta[], indent: string) =>
		files.forEach((p, i) => {
			nFiles++;
			term.print(`${indent}${i === files.length - 1 ? '└── ' : '├── '}`, fileLink(sh, p));
		});

	if (hit.dir.length === 0) {
		const ds = fs.dirs();
		ds.forEach((d, i) => {
			const last = i === ds.length - 1;
			nDirs++;
			term.print(last ? '└── ' : '├── ', span('pa', `${d}/`));
			fileLines(fs.filesIn(d), last ? '    ' : '│   ');
		});
	} else fileLines(fs.filesIn(hit.dir[0]), '');

	term.print('');
	term.print(`${count(nDirs, 'directory', 'directories')}, ${count(nFiles, 'file', 'files')}`);
	if (fs.ctx && nFiles === 0) term.print(span('dim', `# ${fs.ctx} 컨텍스트엔 아직 글이 없어요 · kubectx -로 전체`));
}

/* ── 재미 반응 (help에 없는 숨은 명령) ───────────── */

/** 쓰기 명령 → 진짜 coreutils 문구. 이 홈은 읽기 전용이다 */
const WRITE: Record<string, (a: string, b?: string) => string> = {
	rm: (a) => `rm: cannot remove '${a}': Permission denied`,
	rmdir: (a) => `rmdir: failed to remove '${a}': Permission denied`,
	mv: (a, b) => `mv: cannot move '${a}' to '${b ?? a}': Permission denied`,
	cp: (a, b) => `cp: cannot create regular file '${b ?? a}': Permission denied`,
	touch: (a) => `touch: cannot touch '${a}': Permission denied`,
	mkdir: (a) => `mkdir: cannot create directory '${a}': Permission denied`,
	chmod: (a, b) => `chmod: changing permissions of '${b ?? a}': Operation not permitted`,
	chown: (a, b) => `chown: changing ownership of '${b ?? a}': Operation not permitted`,
};

function writeCmd(cmd: string): Cmd {
	return (args, sh) => {
		const ops = args.filter((a) => !a.startsWith('-'));
		if (ops.length === 0) return void err(sh, `${cmd}: missing operand`);
		err(sh, WRITE[cmd](ops[0], ops[1]));
	};
}

const editor = (cmd: string): Cmd => (args, sh) => {
	const file = args.find((a) => !a.startsWith('-'));
	sh.term.print(span('err', `${cmd}: read-only file system`), file ? span('dim', ` — glow ${file}로 읽기`) : null);
};

const FUN: Record<string, Cmd> = {
	sudo: (_a, sh) => void err(sh, 'daniel is not in the sudoers file. This incident will be reported.'),
	whoami: (_a, sh) => void sh.term.print('guest', span('dim', '  # 여기 주인은 daniel · open /about')),
	exit: (_a, sh) => void sh.term.print(span('dim', 'logout — 나가려면 위 메뉴를 눌러 주세요')),
	logout: (_a, sh) => void sh.term.print(span('dim', 'logout — 나가려면 위 메뉴를 눌러 주세요')),
	vi: editor('vi'),
	vim: editor('vim'),
	nvim: editor('nvim'),
	nano: editor('nano'),
	...Object.fromEntries(Object.keys(WRITE).map((c) => [c, writeCmd(c)])),
};

/** 줄에 `>`·`>>`가 있으면 리다이렉트 — 실행하지 않고 zsh 문구. 처리했으면 true */
export function redirect(line: string, sh: Shell): boolean {
	const m = line.match(/>>?\s*(\S*)/);
	if (!m) return false;
	if (!m[1]) err(sh, "zsh: parse error near `\\n'");
	else err(sh, `zsh: permission denied: ${m[1]}`);
	return true;
}

/* ── 명령 표 ────────────────────────────────────────── */

export const COMMANDS: Record<string, Cmd> = {
	help(_args, sh) {
		for (const [usage, desc] of HELP) sh.term.block(el('div', { class: 'hl' }, el('span', {}, usage), span('dim', desc)));
		sh.term.block(el('div', { class: 'hl' }, el('span', {}, span('hi', 'dagent'), ' [--post <slug>]'), span('dim', 'AI 챗봇 실행 (나가기: /exit)')));
	},

	ls,
	tree,
	cat,
	glow,

	pwd(_args, sh) {
		sh.term.print(sh.fs.pwd());
	},

	cd(args, sh) {
		const path = args[0];
		const e = sh.fs.cd(path);
		if (e) {
			err(sh, fsError('cd', path ?? '', e));
			// 옛 `cd /about` 손버릇 — 페이지 이동은 open으로 옮겼다 (K10)
			if (e === 'denied' && path?.startsWith('/')) sh.term.print(span('dim', `페이지로 가려면 open ${path}`));
			return;
		}
		sh.setPrompt('sh');
	},

	open(args, sh) {
		const path = args[0];
		if (!path) return void err(sh, 'usage: open <글>.md | ~ | /posts | /about');
		let to: string | null = null;
		if (path.startsWith('~') || path.startsWith('/')) {
			const norm = path.replace(/^~\/?/, '/').replace(/\/+$/, '') || '/';
			if (PAGES.includes(norm)) to = norm;
		} else {
			const hit: Hit | FsErr = sh.fs.resolve(path);
			if (typeof hit === 'string') return void err(sh, fsError('open', path, hit));
			if (!hit.file) return void err(sh, `open: ${path}: Is a directory`);
			to = pageOf(hit.file);
		}
		if (!to) return void err(sh, `open: ${path}: No such file or directory`);
		sh.term.print(span('dim', `Opening ${to} …`));
		location.href = to;
	},

	kubectx(args, sh) {
		const { fs, layers, term } = sh;
		const name = args[0];
		if (!name) {
			const items = layers.flatMap((l) => {
				const label = l === fs.ctx ? el('b', {}, layerSpan(l)) : layerSpan(l);
				return ['  ', label, span('dim', `(${fs.layerCount(l)})`)];
			});
			term.print(...items);
			term.print(span('dim', `현재: ${fs.ctx ?? '없음 (전체)'} · 괄호 = 공개 글 수 · kubectx <레이어>로 고르기`));
			return;
		}
		if (name === '-') {
			fs.setCtx(null);
			term.print('Switched to context "', span('dim', '(전체)'), '".');
		} else if (layers.includes(name)) {
			fs.setCtx(name);
			term.print('Switched to context "', layerSpan(name), '".');
		} else {
			term.print(span('err', `error: no context exists with the name: "${name}"`), span('dim', ` — ${layers.join(' ')}`));
			return;
		}
		sh.setPrompt('sh');
	},

	async git(args, sh) {
		if (args[0] !== 'log') return sh.notFound(['git', ...args]);
		const n = Number(args.join(' ').match(/-n\s*(\d+)/)?.[1] ?? 10);
		const data: { lines: GitLine[] } = await fetch('/gitlog.json').then((r) => r.json());
		for (const l of data.lines.slice(0, Math.max(1, n)))
			sh.term.print(
				span('err', '*'),
				' ',
				el('span', { style: 'color: var(--tooling)' }, l.short),
				' ',
				span('dim', l.date),
				' ',
				span('pa', l.kind.padEnd(5)),
				' ',
				link(l.href, l.text),
			);
	},

	theme(args, sh) {
		const t = args[0];
		const set = (window as unknown as { __setTheme?: (t: string) => void }).__setTheme;
		if ((t === 'dark' || t === 'light') && set) {
			set(t);
			sh.term.print(span('dim', `theme: ${t}`));
		} else err(sh, 'usage: theme dark | light');
	},

	clear(_args, sh) {
		sh.term.clear();
	},

	// 시스템 명령 — sys.ts를 칠 때만 불러온다 (D6)
	neofetch: async (_a, sh) => (await import('./sys')).neofetch(sh),
	uname: async (a, sh) => (await import('./sys')).uname(sh, a),
	top: async (_a, sh) => (await import('./sys')).top(sh),
	netstat: async (_a, sh) => (await import('./sys')).netstat(sh),
	ping: async (a, sh) => (await import('./sys')).ping(sh, a),
	uptime: async (_a, sh) => (await import('./sys')).uptime(sh),
	date: async (_a, sh) => (await import('./sys')).date(sh),
	cal: async (_a, sh) => (await import('./sys')).cal(sh),
	df: async (_a, sh) => (await import('./sys')).df(sh),

	history(_args, sh) {
		const w = String(sh.history.length).length;
		sh.history.forEach((line, i) => sh.term.print(`  ${String(i + 1).padStart(w)}  ${line}`));
	},

	async dagent(args, sh) {
		const { runDagent } = await import('./dagent');
		const i = args.indexOf('--post');
		await runDagent(sh, i >= 0 ? args[i + 1] : undefined);
	},

	...FUN,
};
