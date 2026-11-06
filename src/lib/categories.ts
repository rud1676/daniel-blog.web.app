/**
 * 글의 카테고리 = 글이 어디서 출발했나. 글당 정확히 1개 (레이어는 여러 개 — src/lib/layers.ts).
 * 이 배열이 유일한 목록이다. 스키마·/posts 탭·카테고리 페이지·posts.json(/cli 폴더)이 전부 여기서 만든다.
 * 하나 더할 땐 여기 한 줄만 추가한다 (색 토큰 없음). 순서 = 표시 순서.
 * 판정: 글이 구체적인 사건에서 출발하면 그 사건이 일어난 곳(work/side), 사건 없이 생각에서 출발하면 thinking,
 * 사건 없이 공부한 것을 정리했으면 study.
 * layered: 레이어(= 문제가 지나간 영역)를 다는 카테고리인가. false면 발행 글이어도 layers를 두지 않는다
 * — 정리 글엔 지나간 문제가 없고, 다 front로 달면 레이어 필터가 무의미해진다.
 */
export const CATEGORIES = [
	{ id: 'work', description: '일하며 겪은 경험을 기록합니다.', layered: true },
	{ id: 'side', description: '개인 프로젝트를 하며 경험하고 배운 것을 기록합니다.', layered: true },
	{ id: 'thinking', description: '일하며 굳어진 생각과 관점을 기록합니다.', layered: true },
	{ id: 'study', description: '따로 공부한 것을 정리해 머릿속에 함께 남깁니다.', layered: false },
] as const;

export type Category = (typeof CATEGORIES)[number]['id'];

/** z.enum용 튜플 */
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [Category, ...Category[]];

export function categoryOf(id: Category) {
	return CATEGORIES.find((c) => c.id === id)!;
}
