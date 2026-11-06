import { readFile } from 'node:fs/promises';
import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../lib/posts';

/** /cli 셸의 홈 디렉터리(ls·cd·tree·kubectx)용 발행 글 목록. 본문은 넣지 않는다. size = 원문 바이트(ls -l 크기 칸) */
export const GET: APIRoute = async () => {
	const published = await getPublishedPosts();
	const posts = await Promise.all(
		published.map(async (p) => ({
			slug: p.id,
			title: p.data.title,
			category: p.data.category,
			layers: p.data.layers ?? [],
			stance: p.data.stance ?? p.data.description,
			pubDate: p.data.pubDate.toISOString(),
			updatedDate: p.data.updatedDate?.toISOString() ?? null,
			updatedReason: p.data.updatedReason ?? null,
			tags: p.data.tags,
			size: (await readFile(p.filePath!)).byteLength,
		})),
	);
	return new Response(JSON.stringify(posts), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
