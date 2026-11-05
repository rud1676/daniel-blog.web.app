import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../lib/posts';

/** /cli 셸의 `get posts`·`describe post`용 발행 글 목록. 본문은 넣지 않는다. */
export const GET: APIRoute = async () => {
	const posts = (await getPublishedPosts()).map((p) => ({
		slug: p.id,
		title: p.data.title,
		layers: p.data.layers ?? [],
		stance: p.data.stance ?? p.data.description,
		pubDate: p.data.pubDate.toISOString(),
		updatedDate: p.data.updatedDate?.toISOString() ?? null,
		updatedReason: p.data.updatedReason ?? null,
		tags: p.data.tags,
	}));
	return new Response(JSON.stringify(posts), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
