/**
 * /cli의 가상 파일시스템. 순수 로직(DOM 없음).
 * 홈 = /home/daniel (~). 폴더 = 카테고리 id, 파일 = <slug>.md (발행 글만 — posts.json이 draft를 이미 뺐다).
 * 카테고리 목록은 cli.astro의 data-categories에서 받는다 — 여기서 이름을 다시 쓰지 않는다 (AGENTS.md 분류 규칙).
 * 위치·컨텍스트는 변수에만 둔다. 새로고침하면 ~ · 전체로 돌아간다.
 */

export type PostMeta = {
	slug: string;
	title: string;
	category: string;
	layers: string[];
	description: string;
	pubDate: string;
	updatedDate: string | null;
	updatedReason: string | null;
	/** 원문 바이트 (ls -l 크기 칸) */
	size: number;
};

export type FsErr = 'denied' | 'noent' | 'notdir';
/** dir = 홈에서부터의 경로 ([] = ~, ['work'] = ~/work). file이 있으면 그 폴더 안의 글 */
export type Hit = { dir: string[]; file?: PostMeta };

export const HOME = '/home/daniel';
export const fileName = (p: PostMeta) => `${p.slug}.md`;

export type Fs = ReturnType<typeof createFs>;

export function createFs(posts: PostMeta[], categories: string[]) {
	let cwd: string[] = [];
	let ctx: string | null = null;

	/** 컨텍스트(kubectx)가 걸려 있으면 그 레이어를 거친 글만 보인다 */
	const shown = (p: PostMeta) => !ctx || p.layers.includes(ctx);
	const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

	/**
	 * 경로 → 위치. 상대 경로만 된다 — `~`·`/`로 시작하면 denied (K10).
	 * `..`이 홈 위로 가면 denied. 깊이 0 = 카테고리 폴더, 깊이 1 = <slug>.md.
	 */
	function resolve(path = '.'): Hit | FsErr {
		if (path.startsWith('~') || path.startsWith('/')) return 'denied';
		const parts = [...cwd];
		const segs = path.split('/').filter((s) => s && s !== '.');
		for (const [i, seg] of segs.entries()) {
			if (seg === '..') {
				if (parts.length === 0) return 'denied';
				parts.pop();
				continue;
			}
			if (parts.length === 0 && categories.includes(seg)) {
				parts.push(seg);
				continue;
			}
			if (parts.length === 1) {
				const post = posts.find((p) => p.category === parts[0] && fileName(p) === seg && shown(p));
				if (post) return i === segs.length - 1 ? { dir: parts, file: post } : 'notdir';
			}
			return 'noent';
		}
		return { dir: parts };
	}

	/** 폴더 안 글 (컨텍스트 적용, 이름순) */
	function filesIn(category: string): PostMeta[] {
		return posts.filter((p) => p.category === category && shown(p)).sort((a, b) => byName(fileName(a), fileName(b)));
	}

	/** 홈의 폴더는 항상 전부 보인다 — 빈 폴더 포함 (PRD C7). 이름순 = 진짜 ls처럼 */
	function dirs(): string[] {
		return [...categories].sort(byName);
	}

	/** 그 위치 아래에서 보이는 글 전부 (날짜 칸·tree용) */
	function postsUnder(dir: string[]): PostMeta[] {
		return dir.length === 0 ? dirs().flatMap(filesIn) : filesIn(dir[0]);
	}

	/** 인자 없음 = 홈 (D16). 에러면 그 종류를, 옮겼으면 null */
	function cd(path?: string): FsErr | null {
		if (path === undefined) {
			cwd = [];
			return null;
		}
		const hit = resolve(path);
		if (typeof hit === 'string') return hit;
		if (hit.file) return 'notdir';
		cwd = hit.dir;
		return null;
	}

	return {
		resolve,
		cd,
		dirs,
		filesIn,
		postsUnder,
		get cwd(): readonly string[] {
			return cwd;
		},
		get ctx() {
			return ctx;
		},
		setCtx(layer: string | null) {
			ctx = layer;
		},
		/** 프롬프트용: ~ · ~/work */
		label: (dir: readonly string[] = cwd) => (dir.length ? `~/${dir.join('/')}` : '~'),
		pwd: () => (cwd.length ? `${HOME}/${cwd.join('/')}` : HOME),
		/** 공개 글 전부 (컨텍스트와 무관) */
		all: (): readonly PostMeta[] => posts,
		/** 레이어별 공개 글 수 (컨텍스트와 무관) */
		layerCount: (layer: string) => posts.filter((p) => p.layers.includes(layer)).length,
	};
}
