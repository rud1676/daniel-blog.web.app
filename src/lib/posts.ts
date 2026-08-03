import { type CollectionEntry, getCollection } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/**
 * 발행된 글만 최신순으로. draft는 어디에서도 노출되지 않는다 (DESIGN.md §5.2).
 * 목록·상세·태그·RSS가 전부 이 함수를 거치게 해서 draft 누락 경로를 만들지 않는다.
 */
export async function getPublishedPosts(): Promise<Post[]> {
	const posts = await getCollection('posts', ({ data }) => data.draft !== true);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 태그 → 글 수. 많이 쓴 태그부터. */
export async function getTagCounts(): Promise<Array<{ tag: string; count: number }>> {
	const posts = await getPublishedPosts();
	const counts = new Map<string, number>();
	for (const post of posts) {
		for (const tag of post.data.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * 앞뒤 글. posts는 최신순이므로 index-1이 더 최신, index+1이 더 예전 글이다.
 * "이전/다음"은 읽는 사람마다 반대로 해석해서, 이름을 newer/older로 고정한다.
 */
export function getAdjacentPosts(posts: Post[], id: string) {
	const index = posts.findIndex((post) => post.id === id);
	if (index === -1) return { newer: undefined, older: undefined };
	return {
		newer: posts[index - 1],
		older: posts[index + 1],
	};
}
