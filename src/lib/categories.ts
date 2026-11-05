/**
 * 글의 카테고리 = 글이 어디서 출발했나. 글당 정확히 1개 (레이어는 여러 개 — src/lib/layers.ts).
 * 이 배열이 유일한 목록이다. 스키마·/posts 탭·카테고리 페이지·posts.json(/cli 폴더)이 전부 여기서 만든다.
 * 하나 더할 땐 여기 한 줄만 추가한다 (색 토큰 없음). 순서 = 표시 순서.
 * 판정: 글이 구체적인 사건에서 출발하면 그 사건이 일어난 곳(work/side), 사건 없이 생각에서 출발하면 thinking.
 */
export const CATEGORIES = [
	{ id: 'work', description: '회사에서 겪은 일을 일반화해 쓴 글' },
	{ id: 'side', description: '사이드 프로젝트에서 겪은 일' },
	{ id: 'thinking', description: '사건 없이 생각에서 출발한 글' },
] as const;

export type Category = (typeof CATEGORIES)[number]['id'];

/** z.enum용 튜플 */
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [Category, ...Category[]];

export function categoryOf(id: Category) {
	return CATEGORIES.find((c) => c.id === id)!;
}
