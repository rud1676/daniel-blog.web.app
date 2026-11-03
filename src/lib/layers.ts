/**
 * 글의 문제가 지나간 영역. 스키마·필터 경로·칩 색·터미널 help가 모두 이 목록을 쓴다.
 * 순서는 표시 순서(필터 칩, help)다. 새 레이어를 넣으면 CSS 토큰 `--<layer>`도 같이 추가한다.
 */
export const LAYERS = ['front', 'server', 'infra', 'db', 'ai', 'build', 'tooling'] as const;

export type Layer = (typeof LAYERS)[number];
