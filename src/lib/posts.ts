import { type CollectionEntry, getCollection } from 'astro:content';
import { CATEGORIES, type Category } from './categories';
import { LAYERS, type Layer } from './layers';

export type Post = CollectionEntry<'posts'>;

/** 홈 대표 글 상한. 넘으면 빌드를 막는다. */
const MAX_PINNED = 2;
/** 홈 "최근 글" 섹션에 보이는 글 수 */
const HOME_LATEST_COUNT = 4;

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
 * 홈은 두 섹션: 대표 글(pinned, 수동 선정 최대 2) / 최근 글(대표 제외 최신 4).
 * 대표 글을 최근 글에서 빼는 건 같은 글이 홈에 두 번 보이지 않게 하려고.
 */
export function getHomePosts(posts: Post[]): { pinned: Post[]; latest: Post[] } {
	return {
		pinned: posts.filter((post) => post.data.pinned),
		latest: posts.filter((post) => !post.data.pinned).slice(0, HOME_LATEST_COUNT),
	};
}

/** 레이어 → 글 수. 글이 0편인 레이어는 빠진다 (빈 필터 페이지를 만들지 않는다). LAYERS 순서를 따른다. */
export function getLayerCounts(posts: Post[]): Array<{ layer: Layer; count: number }> {
	return LAYERS.map((layer) => ({
		layer,
		count: posts.filter((post) => post.data.layers?.includes(layer)).length,
	})).filter(({ count }) => count > 0);
}

/** 카테고리 → 글 수. 글이 0편인 카테고리는 빠진다 (탭·페이지를 만들지 않는다). CATEGORIES 순서를 따른다. */
export function getCategoryCounts(posts: Post[]): Array<{ category: Category; count: number }> {
	return CATEGORIES.map(({ id }) => ({
		category: id,
		count: posts.filter((post) => post.data.category === id).length,
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
