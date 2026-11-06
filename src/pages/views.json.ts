import type { APIRoute } from 'astro';
import { getViews } from '../lib/views';

/**
 * 글별 조회수 (빌드 때 집계한 값 그대로). 다음 빌드에서 BigQuery 조회가 실패하면 이 파일을 대신 읽는다
 * → "실패하면 마지막 값 유지". 브라우저에서 부르는 곳은 없다.
 */
export const GET: APIRoute = async () => new Response(JSON.stringify(await getViews()), {
	headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
