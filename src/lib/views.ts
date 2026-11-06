import { execFileSync } from 'node:child_process';

/**
 * 글 조회수 (prd/post-views). 빌드 시점에 BigQuery 호스팅 로그를 세어 정적 HTML에 박는다 — 브라우저 JS 0.
 *
 * - 1회 = (글, KST 날짜, IP+UA). 같은 사람이 하루에 여러 번 와도 1. 내 방문도 센다(일부러 안 뺀다).
 * - 사람만: GET 200 + 봇 UA 제외. 필터는 blog-analytics 스킬의 `pv` 조각과 같다.
 * - 켜는 법: VIEWS_BQ=1 (배포 워크플로가 켠다. 로컬도 `bq` 로그인이 돼 있으면 켜서 볼 수 있다).
 *   꺼져 있으면 빈 값 → VIEWS 줄·views 표시가 아예 안 나온다.
 * - 조회 실패해도 빌드는 깨지지 않는다: 라이브의 /views.json(지난 빌드 값)을 쓰고, 그것도 없으면 빈 값.
 * - 숫자는 매일 06:00(KST) cron 재빌드 때 갱신된다.
 */

export type Views = {
	/** 글 id(slug) → 누적 고유 방문 */
	counts: Record<string, number>;
	/** 집계한 시각 (ISO). 빈 값이면 null */
	updatedAt: string | null;
};

const TABLE = 'daniel-blog-1676.hosting_logs.firebasehosting_googleapis_com_webrequests';
const SITE = 'https://kyungjin.dev';
const BOT = '(?i)bot|crawl|spider|slurp|preview|monitor|curl|wget|python|go-http|headless|lighthouse';

const QUERY = `
SELECT slug, COUNT(DISTINCT CONCAT(day, '|', ip, '|', ua)) AS n
FROM (
  SELECT
    REGEXP_EXTRACT(httpRequest.requestUrl, r'^https?://[^/]+/posts/([a-z0-9-]+)/?(?:[?#].*)?$') AS slug,
    FORMAT_DATE('%F', DATE(timestamp, 'Asia/Seoul')) AS day,
    IFNULL(httpRequest.remoteIp, '') AS ip,
    IFNULL(httpRequest.userAgent, '') AS ua
  FROM \`${TABLE}\`
  WHERE httpRequest.requestMethod = 'GET'
    AND httpRequest.status = 200
    AND NOT REGEXP_CONTAINS(IFNULL(httpRequest.userAgent, ''), r'${BOT}')
)
WHERE slug IS NOT NULL
GROUP BY slug`;

const EMPTY: Views = { counts: {}, updatedAt: null };

function fromBigQuery(): Views {
	const out = execFileSync(
		'bq',
		['query', '--quiet', '--project_id=daniel-blog-1676', '--use_legacy_sql=false', '--format=json', '--max_rows=10000', '--maximum_bytes_billed=1000000000', QUERY],
		{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
	);
	const rows = JSON.parse(out || '[]') as { slug: string; n: string }[];
	const counts: Record<string, number> = {};
	for (const r of rows) counts[r.slug] = Number(r.n);
	return { counts, updatedAt: new Date().toISOString() };
}

async function fromLive(): Promise<Views> {
	const res = await fetch(`${SITE}/views.json`, { signal: AbortSignal.timeout(10_000) });
	if (!res.ok) throw new Error(`live views.json ${res.status}`);
	const v = (await res.json()) as Views;
	return v && typeof v.counts === 'object' ? v : EMPTY;
}

async function load(): Promise<Views> {
	if (process.env.VIEWS_BQ !== '1') return EMPTY;
	try {
		return fromBigQuery();
	} catch (e) {
		console.warn(`[views] BigQuery 조회 실패 → 라이브 /views.json 사용: ${(e as Error).message.split('\n')[0]}`);
	}
	try {
		return await fromLive();
	} catch (e) {
		console.warn(`[views] 라이브 /views.json도 못 읽음 → views 숨김: ${(e as Error).message}`);
		return EMPTY;
	}
}

let cached: Promise<Views> | undefined;
/** 빌드 한 번에 한 번만 조회한다 (페이지마다 부르면 안 된다) */
export function getViews(): Promise<Views> {
	return (cached ??= load());
}

/** 1284 → "1,284" */
export const formatViews = (n: number) => n.toLocaleString('en-US');
