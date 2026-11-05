import type { APIRoute } from 'astro';
import { getGitLog } from '../lib/gitlog';

/** /cli 의 `git log` 명령용. 홈 히어로와 같은 값 (최근 30줄). */
export const GET: APIRoute = async () => {
	const log = await getGitLog();
	return new Response(JSON.stringify({ branch: log.branch, lines: log.lines.slice(0, 30) }), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
};
