/**
 * 빌드 시각. 이 블로그는 정적 사이트라 "며칠 전"은 방문 시각이 아니라 빌드 시각 기준이다.
 * 그래서 매일 cron으로 마지막 live 태그를 다시 빌드해 Age를 갱신한다 (.github/workflows/deploy.yml).
 */
export const BUILD_TIME = new Date();

/** kubectl AGE 열처럼 짧게: 45m · 5h · 14d (1년이 넘어도 d로 센다) */
export function formatAge(from: Date, now: Date = BUILD_TIME): string {
	const minutes = Math.max(0, Math.floor((now.valueOf() - from.valueOf()) / 60_000));
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}
