import { execFileSync } from 'node:child_process';
import { REPO_URL } from '../consts';
import { LEGACY, type LegacyEntry } from '../data/gitlog-legacy';
import { getPublishedPosts, type Post } from './posts';

/**
 * 홈 히어로의 `git log --oneline`. 빌드 시점에 이 레포의 실제 기록을 읽어 정적 HTML로 만든다 (홈 JS 0).
 *
 * - 범위: 빌드한 커밋(HEAD)에서 닿는 기록만. 배포된 것만 보여야 "live" 기록이 거짓말을 안 한다.
 * - 종류: 커밋 제목 접두사(AGENTS.md 커밋 규칙) 또는 규칙 이전 커밋은 src/data/gitlog-legacy.ts.
 * - post·fix 줄은 그 커밋이 건드린 "발행" 글로 판정한다. 발행 글이 없으면 숨긴다 → draft는 어디에도 안 나온다.
 * - 날짜는 KST 작성일 (CI는 UTC라 TZ를 고정한다).
 * - `tag: live`는 배포 워크플로(GITLOG_LIVE=1)에서만 붙는다.
 * - CI(DENY_WORDS)에서는 비공개 금지어가 표시 문구에 있으면 빌드를 막는다. 단어 목록은 레포에 두지 않는다.
 */

export type GitKind = 'post' | 'fix' | 'site' | 'infra';

export type GitLine = {
	sha: string;
	short: string;
	date: string;
	kind: GitKind;
	text: string;
	/** post·fix → 글, site·infra → GitHub 커밋 */
	href: string;
	/** 꼬리표 `(HEAD -> main, tag: live)` — 맨 윗줄에만 */
	refs?: { head: string; live: boolean };
};

export type GitLog = {
	lines: GitLine[];
	/** 프롬프트 `git:(main)` 자리 */
	branch: string;
	/** 빌드한 커밋 (tag: live 검증용) */
	headSha: string | null;
	liveTag: string | null;
};

const MAX_READ = 300;
const RULE = /^(post|fix|site|infra|draft|docs|chore):\s*(.+)$/;
const POST_PATH = /^src\/content\/posts\/([^/]+?)(?:\.mdx?$|\/)/;

function git(args: string[]): string {
	return execFileSync('git', args, {
		encoding: 'utf8',
		env: { ...process.env, TZ: 'Asia/Seoul' },
		stdio: ['ignore', 'pipe', 'ignore'],
		maxBuffer: 16 * 1024 * 1024,
	}).trim();
}

function tryGit(args: string[]): string | null {
	try {
		return git(args);
	} catch {
		return null;
	}
}

type RawCommit = { sha: string; short: string; date: string; subject: string; files: Array<{ status: string; path: string }> };

function readCommits(): RawCommit[] {
	const out = git([
		'log',
		'--no-merges', // 레포 설정상 merge 커밋은 생기지 않는다. 혹시 생겨도 내용이 없으니 뺀다
		`-n${MAX_READ}`,
		'--date=format-local:%Y-%m-%d',
		'--format=%x1e%H%x1f%h%x1f%ad%x1f%s',
		'--name-status',
		'HEAD',
	]);
	return out
		.split('\x1e')
		.filter(Boolean)
		.map((rec) => {
			const [head, ...rest] = rec.split('\n');
			const [sha, short, date, subject] = head.split('\x1f');
			const files = rest
				.filter(Boolean)
				.map((line) => {
					const cols = line.split('\t');
					return { status: cols[0][0], path: cols[cols.length - 1] };
				});
			return { sha, short: sha.slice(0, 7), date, subject, files };
		});
}

function legacyFor(sha: string): LegacyEntry | undefined {
	return Object.hasOwn(LEGACY, sha) ? LEGACY[sha] : undefined;
}

/** 커밋이 건드린 발행 글. post면 새로 추가된(A) 글을 먼저 본다. */
function touchedPublished(c: RawCommit, published: Map<string, Post>): Post | undefined {
	const hits = c.files
		.map((f) => ({ status: f.status, slug: f.path.match(POST_PATH)?.[1] }))
		.filter((f): f is { status: string; slug: string } => !!f.slug && published.has(f.slug));
	const added = hits.find((h) => h.status === 'A');
	const pick = added ?? hits[0];
	return pick && published.get(pick.slug);
}

function classify(c: RawCommit, published: Map<string, Post>, unknown: string[]): Omit<GitLine, 'refs'> | null {
	const base = { sha: c.sha, short: c.short, date: c.date };
	const commitUrl = `${REPO_URL}/commit/${c.sha}`;
	const legacy = legacyFor(c.sha);

	if (legacy !== undefined) {
		if (legacy === null) return null;
		if (legacy.kind === 'site' || legacy.kind === 'infra') return { ...base, kind: legacy.kind, text: legacy.title, href: commitUrl };
		const post = published.get(legacy.slug);
		if (!post) return null; // 그 글이 draft로 돌아갔으면 숨긴다
		const text = legacy.kind === 'fix' ? `${post.data.title} — ${legacy.reason}` : post.data.title;
		return { ...base, kind: legacy.kind, text, href: `/posts/${post.id}/` };
	}

	const m = c.subject.match(RULE);
	if (!m) {
		unknown.push(c.short);
		return null;
	}
	const [, kind, rest] = m;
	if (kind === 'site' || kind === 'infra') return { ...base, kind, text: rest, href: commitUrl };
	if (kind === 'post' || kind === 'fix') {
		const post = touchedPublished(c, published);
		if (!post) return null; // 발행 글을 안 건드렸다 → draft만 건드린 것. 숨긴다
		const text = kind === 'fix' ? `${post.data.title} — ${rest}` : post.data.title;
		return { ...base, kind, text, href: `/posts/${post.id}/` };
	}
	return null; // draft · docs · chore
}

function checkDenyWords(lines: GitLine[]) {
	const words = (process.env.DENY_WORDS ?? '')
		.split(',')
		.map((w) => w.trim().toLowerCase())
		.filter(Boolean);
	if (words.length === 0) return;
	const bad = lines.filter((l) => words.some((w) => l.text.toLowerCase().includes(w)));
	// 어떤 단어인지는 로그에 남기지 않는다 (CI 로그도 public)
	if (bad.length) throw new Error(`git log 표시 문구에 금지어가 있다. 커밋: ${bad.map((l) => l.short).join(', ')}`);
}

let cache: Promise<GitLog> | undefined;

/** 빌드당 한 번만 계산한다 (홈 히어로와 /gitlog.json 이 같은 값을 쓴다). */
export function getGitLog(): Promise<GitLog> {
	cache ??= build();
	return cache;
}

async function build(): Promise<GitLog> {
	const empty: GitLog = { lines: [], branch: 'main', headSha: null, liveTag: null };
	if (tryGit(['rev-parse', '--is-inside-work-tree']) !== 'true') {
		console.warn('[gitlog] git 저장소가 아니다 — 홈 git log를 비운다.');
		return empty;
	}
	if (tryGit(['rev-parse', '--is-shallow-repository']) === 'true') {
		const msg = '[gitlog] shallow clone이다. CI는 actions/checkout 에 fetch-depth: 0 이 필요하다.';
		if (process.env.CI) throw new Error(msg);
		console.warn(msg);
	}

	const published = new Map((await getPublishedPosts()).map((p) => [p.id, p] as const));
	const unknown: string[] = [];
	const lines = readCommits()
		.map((c) => classify(c, published, unknown))
		.filter((l): l is GitLine => l !== null);
	if (unknown.length) console.warn(`[gitlog] 규칙에 맞지 않아 숨긴 커밋 ${unknown.length}개: ${unknown.join(', ')}`);
	checkDenyWords(lines);

	const headSha = tryGit(['rev-parse', 'HEAD']);
	const current = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);
	const mainSha = tryGit(['rev-parse', '--verify', '-q', 'origin/main']);
	// 태그를 checkout한 CI는 detached HEAD다 → main 끝과 같을 때만 `HEAD -> main`
	const branch = current && current !== 'HEAD' ? current : headSha && headSha === mainSha ? 'main' : 'HEAD';
	const live = process.env.GITLOG_LIVE === '1';
	if (lines[0]) lines[0].refs = { head: branch === 'HEAD' ? 'HEAD' : `HEAD -> ${branch}`, live };

	return { lines, branch: branch === 'HEAD' ? 'main' : branch, headSha, liveTag: live ? (process.env.GITLOG_TAG ?? null) : null };
}
