// 사이트 전역 상수. 여기만 고치면 메타/RSS/푸터가 전부 따라간다.

// TODO(docs/DESIGN.md §15 Q1): 도메인 확정 후 astro.config.mjs의 `site`와 함께 교체할 것.
export const SITE_TITLE = 'Daniel';
export const SITE_DESCRIPTION =
	'프론트엔드 개발자 Daniel. 어떤 판단을 왜 그렇게 내렸는지, 뒤집힌 과정까지 남기는 기록.';

export const AUTHOR = 'Daniel';
export const GITHUB_URL = 'https://github.com/rud1676';

/** /about 에서 가리킬 이력서 링크. 준비되면 채운다. (DESIGN.md §15 Q2) */
export const RESUME_URL = '';

/** 홈에서 보여줄 최근 글 수 (DESIGN.md §6) */
export const RECENT_POSTS_COUNT = 5;
