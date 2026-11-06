import { readFile } from 'node:fs/promises';
import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../../lib/posts';

/**
 * /cli의 `cat`용 원문 — /posts/<slug>.md. 발행 글만(draft는 getPublishedPosts가 뺀다), frontmatter까지 파일 그대로.
 * 정적 호스팅이라 런타임에 레포 파일을 읽을 서버가 없다 → 빌드 때 같이 내보낸다. 배포된 글과 원문이 늘 같은 커밋에서 나온다.
 * 응답 헤더(Content-Type)는 배포 뒤엔 firebase.json이 정한다.
 */
export async function getStaticPaths() {
	const posts = await getPublishedPosts();
	return posts.map((post) => ({ params: { slug: post.id }, props: { file: post.filePath! } }));
}

export const GET: APIRoute = async ({ props }) =>
	new Response(await readFile(props.file as string, 'utf8'), {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
	});
