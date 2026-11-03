import { type CollectionEntry, getCollection } from 'astro:content';
import { LAYERS, type Layer } from './layers';

export type Post = CollectionEntry<'posts'>;

/** 홈 대표 글 상한. 넘으면 빌드를 막는다. */
const MAX_PINNED = 2;
/** 홈 표에 보이는 글 수 (대표 + 최신) */
const HOME_POSTS_COUNT = 3;

/**
 * 발행된 글만 최신순으로. draft는 어디에서도 노출되지 않는다.
 * 목록·상세·태그·RSS가 전부 이 함수를 거치게 해서 draft 누락 경로를 만들지 않는다.
 */
export async function getPublishedPosts(): Promise<Post[]> {
	const posts = await getCollection('posts', ({ data }) => data.draft !== true);
	const pinned = posts.filter((post) => post.data.pinned);
	if (pinned.length > MAX_PINNED) {
		throw new Error(
			`pinned: true인 발행 글은 최대 ${MAX_PINNED}편이다 (지금 ${pinned.length}편: ${pinned.map((p) => p.id).join(', ')})`,
		);
	}
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * 홈 표: 대표 글(최대 2) + 대표가 아닌 최신 글로 총 3편. 최신 글은 최소 1편 들어간다
 * — 대표만 있으면 갱신을 잊었을 때 "멈춘 블로그"로 보인다.
 */
export function getHomePosts(posts: Post[]): Post[] {
	const pinned = posts.filter((post) => post.data.pinned);
	const latest = posts.filter((post) => !post.data.pinned);
	const latestCount = Math.max(1, HOME_POSTS_COUNT - pinned.length);
	return [...pinned, ...latest.slice(0, latestCount)];
}

/** 레이어 → 글 수. 글이 0편인 레이어는 빠진다 (빈 필터 페이지를 만들지 않는다). LAYERS 순서를 따른다. */
export function getLayerCounts(posts: Post[]): Array<{ layer: Layer; count: number }> {
	return LAYERS.map((layer) => ({
		layer,
		count: posts.filter((post) => post.data.layers?.includes(layer)).length,
	})).filter(({ count }) => count > 0);
}

/** 같은 레이어를 거친 글. 점수 = 겹치는 레이어 수, 0점 제외, 동점은 최신순(입력이 최신순이라 stable sort로 유지). */
export function getRelatedPosts(posts: Post[], current: Post, limit = 3): Post[] {
	const mine = new Set(current.data.layers ?? []);
	return posts
		.filter((post) => post.id !== current.id)
		.map((post) => ({ post, score: (post.data.layers ?? []).filter((l) => mine.has(l)).length }))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map(({ post }) => post);
}

/** 읽는 시간(분). 한국어 기준 분당 500자, 코드 블록 포함 대략치. */
export function readingMinutes(body: string | undefined): number {
	const chars = (body ?? '').replace(/\s+/g, '').length;
	return Math.max(1, Math.ceil(chars / 500));
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
 * TODO(plan STEP 5): 글 끝 장치를 "같은 레이어 글"만 두기로 해서 글 상세 개편 때 지운다.
 */
export function getAdjacentPosts(posts: Post[], id: string) {
	const index = posts.findIndex((post) => post.id === id);
	if (index === -1) return { newer: undefined, older: undefined };
	return {
		newer: posts[index - 1],
		older: posts[index + 1],
	};
}
