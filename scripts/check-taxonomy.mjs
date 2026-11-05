// 레이어·카테고리 목록이 한 곳(src/lib/layers.ts · src/lib/categories.ts)에서만 관리되는지 검사한다.
// 값을 하나 더할 때 "그 파일 + (레이어면) 색 토큰"만 고치면 사이트·/cli가 따라오게 하려는 장치다.
//   1) LAYERS의 값마다 src/styles/tokens.css에 `--<레이어>:` 정의가 3개(다크·라이트·OS 라이트) 있는가
//   2) 화면 코드(components·pages·layouts·scripts)가 특정 id에 기대지 않는가
//      — `x === 'infra'` · `case 'work':` 같은 비교, `['front', 'server']` 같은 목록 재작성.
//        이런 코드는 값이 바뀌거나 빠질 때 조용히 틀어진다.
//      CSS 클래스(`class="side"`)나 색 토큰(`var(--tooling)`)은 잡지 않는다.
//      일부러 고른 부분 목록은 ALLOW에 파일 단위로 둔다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** 배열 리터럴에서 id 뽑기 — layers.ts는 문자열 배열, categories.ts는 { id: '…' } 배열 */
const LAYERS = [...read('src/lib/layers.ts').match(/LAYERS = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const CATEGORIES = [...read('src/lib/categories.ts').matchAll(/id: '([^']+)'/g)].map((m) => m[1]);

/** 홈 히어로 장식용 heroLayers는 일부러 고른 부분 목록이다 (context: taxonomy 지침 예외) */
const ALLOW = ['src/components/Hero.astro'];
const SCAN = ['src/components', 'src/pages', 'src/layouts', 'src/scripts'];

let failed = 0;
const fail = (msg) => {
	failed++;
	console.log(`❌ ${msg}`);
};

if (LAYERS.length === 0) fail('src/lib/layers.ts에서 LAYERS를 읽지 못했다');
if (CATEGORIES.length === 0) fail('src/lib/categories.ts에서 CATEGORIES를 읽지 못했다');

// 1) 색 토큰
const tokens = read('src/styles/tokens.css');
for (const layer of LAYERS) {
	const n = (tokens.match(new RegExp(`--${layer}\\s*:`, 'g')) ?? []).length;
	if (n !== 3) fail(`tokens.css에 --${layer} 정의가 ${n}개 (다크·라이트·OS 라이트 3개여야 한다)`);
}

// 2) 하드코딩된 id
const ids = [...LAYERS, ...CATEGORIES];
const alt = ids.join('|');
const id = `(?:'(?:${alt})'|"(?:${alt})"|\`(?:${alt})\`)`;
const re = new RegExp(`[=!]==?\\s*${id}|${id}\\s*[=!]==?|\\bcase\\s+${id}|${id}\\s*,\\s*${id}`, 'g');
const files = (dir) =>
	readdirSync(join(ROOT, dir)).flatMap((name) => {
		const p = join(dir, name);
		return statSync(join(ROOT, p)).isDirectory() ? files(p) : /\.(astro|ts|tsx|js|mjs)$/.test(name) ? [p] : [];
	});
for (const file of SCAN.flatMap(files)) {
	if (ALLOW.includes(file)) continue;
	read(file)
		.split('\n')
		.forEach((line, i) => {
			for (const m of line.matchAll(re)) fail(`${relative(ROOT, join(ROOT, file))}:${i + 1}  ${m[0]} — 목록은 layers.ts·categories.ts에서 가져온다`);
		});
}

console.log(`레이어 ${LAYERS.length}개 · 카테고리 ${CATEGORIES.length}개 · ${failed === 0 ? '✅ 통과' : `❌ ${failed}건`}`);
process.exit(failed === 0 ? 0 : 1);
