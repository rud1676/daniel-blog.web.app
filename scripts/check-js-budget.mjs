#!/usr/bin/env node
// 글 상세 JS 예산 검사 — `npm run build` 뒤에 돈다 (AGENTS.md: 글 상세 ≤ 10kB).
//
// 잰다: 글 상세 HTML(dist/posts/<slug>/index.html, 레이어 필터 페이지 제외)이
//       첫 로드에 실행하는 JS = 인라인 <script> + <script src>의 파일 + 그 파일이 정적으로 import하는 파일들.
// 안 잰다: 동적 import()로만 닿는 청크 (터미널처럼 "열 때 불러오는" 코드는 예산 밖이다).
// 단위: 압축 전 바이트. 넘는 글이 하나라도 있으면 exit 1.
//
// 같이 검사: "JS 0 페이지"(홈·글 목록·레이어·카테고리 필터·projects·about·404)에는 테마 인라인 스크립트 말고
//           실행되는 <script>가 없어야 한다. JS는 /cli 와 글 상세(예산 안)에만 둔다.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const BUDGET = 10 * 1024;
const DIST = resolve('dist');
const POSTS = join(DIST, 'posts');

/** /_astro/x.js 같은 사이트 경로 → dist 안 파일 경로 */
const toFile = (src, fromFile) =>
	src.startsWith('/') ? join(DIST, src) : resolve(dirname(fromFile), src);

/** 파일 + 정적 import 그래프의 총 바이트. 같은 파일은 한 번만 센다. */
function moduleBytes(file, seen) {
	if (seen.has(file) || !existsSync(file)) return 0;
	seen.add(file);
	const code = readFileSync(file, 'utf8');
	let total = Buffer.byteLength(code);
	// `import x from "./a.js"` · `import "./a.js"` · `export … from "./a.js"` (동적 import( ) 는 제외)
	const re = /(?:^|[;\s}])(?:import|export)\s*(?:[\w*{}\s,$]+from\s*)?["']([^"']+\.js)["']/g;
	for (const [, spec] of code.matchAll(re)) total += moduleBytes(toFile(spec, file), seen);
	return total;
}

function measure(htmlFile) {
	const html = readFileSync(htmlFile, 'utf8');
	const seen = new Set();
	let inline = 0;
	let external = 0;
	for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
		if (/type=["']application\/(ld\+)?json["']/.test(attrs)) continue; // 데이터, 실행 코드 아님
		const src = attrs.match(/\bsrc=["']([^"']+)["']/)?.[1];
		if (src) external += moduleBytes(toFile(src, htmlFile), seen);
		else inline += Buffer.byteLength(body);
	}
	return { inline, external, total: inline + external };
}

if (!existsSync(POSTS)) {
	console.error('dist/posts 가 없다. 먼저 `npm run build`.');
	process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(2)}kB`;
let failed = 0;

// /posts/<여기>/<id> 는 글이 아니라 목록 페이지다 (레이어·카테고리 필터)
const INDEX_DIRS = ['layer', 'category'];

// 1) 글 상세 ≤ 10kB
const pages = readdirSync(POSTS)
	.filter((name) => !INDEX_DIRS.includes(name) && statSync(join(POSTS, name)).isDirectory())
	.map((slug) => ({ slug, file: join(POSTS, slug, 'index.html') }))
	.filter(({ file }) => existsSync(file));

if (pages.length === 0) {
	console.log('JS 예산: 발행된 글 상세가 0편이라 잴 페이지가 없다.');
} else {
	let over = 0;
	for (const { slug, file } of pages) {
		const { inline, external, total } = measure(file);
		const ok = total <= BUDGET;
		if (!ok) over++;
		console.log(`${ok ? '✅' : '❌'} ${kb(total).padStart(8)}  (인라인 ${kb(inline)} + 파일 ${kb(external)})  ${slug}`);
	}
	console.log(`예산 ${kb(BUDGET)} · ${pages.length}편 중 초과 ${over}편\n`);
	failed += over;
}

// 2) JS 0 페이지: 테마 인라인 스크립트(window.__setTheme 정의) 외 실행 스크립트 금지
const isThemeScript = (attrs, body) => !/\bsrc=/.test(attrs) && body.includes('__setTheme=function');
const jsZero = [
	'index.html',
	'posts/index.html',
	'projects/index.html',
	'projects/list/index.html',
	'about/index.html',
	'404.html',
	...INDEX_DIRS.flatMap((dir) =>
		existsSync(join(POSTS, dir)) ? readdirSync(join(POSTS, dir)).map((id) => `posts/${dir}/${id}/index.html`) : [],
	),
].filter((f) => existsSync(join(DIST, f)));

for (const f of jsZero) {
	const html = readFileSync(join(DIST, f), 'utf8');
	const extra = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(
		([, attrs, body]) => !/type=["']application\/(ld\+)?json["']/.test(attrs) && !isThemeScript(attrs, body),
	);
	if (extra.length) {
		failed++;
		console.log(`❌ JS 0 페이지에 스크립트 ${extra.length}개  ${f}`);
	}
}
console.log(`JS 0 페이지 ${jsZero.length}개 검사`);

process.exit(failed ? 1 : 0);
