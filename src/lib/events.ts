import { formatAge } from './age';
import type { Post } from './posts';

/**
 * 홈 히어로 `Events:` 줄. 모두 빌드 시점에 채운다 (홈 JS 0).
 * 지금은 글 데이터만으로 만들 수 있는 Posted · Updated 두 줄.
 * TODO(plan STEP 10): Deployed(커밋 SHA) · Answered(챗봇 7일 집계)와 /events.json 캐시를 붙인다.
 */
export type EventRow = {
	type: 'Normal' | 'Warning';
	reason: 'Posted' | 'Updated' | 'Deployed' | 'Answered';
	age: string;
	message: string;
	/** 메시지를 누르면 갈 곳 (글 제목일 때) */
	href?: string;
};

export function getEvents(posts: Post[]): EventRow[] {
	const rows: EventRow[] = [];

	// 가장 최근 발행 글. posts는 최신순이다.
	const latest = posts[0];
	if (latest) {
		rows.push({
			type: 'Normal',
			reason: 'Posted',
			age: formatAge(latest.data.pubDate),
			message: latest.data.title,
			href: `/posts/${latest.id}/`,
		});
	}

	// 정정 사유가 있는 글 중 가장 최근에 고친 1편. 사유 없는 단순 수정은 Events에 올리지 않는다.
	const updated = posts
		.filter((post) => post.data.updatedReason && post.data.updatedDate)
		.sort((a, b) => b.data.updatedDate!.valueOf() - a.data.updatedDate!.valueOf())[0];
	if (updated) {
		rows.push({
			type: 'Warning',
			reason: 'Updated',
			age: formatAge(updated.data.updatedDate!),
			message: `${updated.data.title} — ${updated.data.updatedReason}`,
			href: `/posts/${updated.id}/`,
		});
	}

	return rows;
}
