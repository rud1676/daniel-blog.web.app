/**
 * 빌드 시각. 이 블로그는 정적 사이트라 "며칠 전"은 방문 시각이 아니라 빌드 시각 기준이다.
 * 그래서 매일 cron으로 마지막 live 태그를 다시 빌드해 Age를 갱신한다 (.github/workflows/deploy.yml).
 */
export const BUILD_TIME = new Date();

/** 짧은 경과 표기: 45m · 5h · 14d (1년이 넘어도 d로 센다) */
export function formatAge(from: Date, now: Date = BUILD_TIME): string {
	const minutes = Math.max(0, Math.floor((now.valueOf() - from.valueOf()) / 60_000));
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}

/** 이 기간 안의 글만 상대 표기(45m · 5h · 3d)로, 그보다 오래된 글은 발행일로 보인다 */
const RECENT_DAYS = 7;

const kstDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

/** 글 목록의 날짜 칸: 일주일 안이면 `3d`, 넘으면 `2024-05-12` (KST — 빌드는 UTC 러너에서 돈다) */
export function formatPubDate(pub: Date, now: Date = BUILD_TIME): string {
	const days = (now.valueOf() - pub.valueOf()) / 86_400_000;
	return days < RECENT_DAYS ? formatAge(pub, now) : kstDate.format(pub);
}
