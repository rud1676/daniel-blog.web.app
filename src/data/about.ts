/**
 * /about 내용. 화면(about.astro)과 분리해 사실만 여기 모은다.
 * about은 "내 정보만" 둔다 — 경력 타임라인은 사이트에 두지 않고(작성자 결정 2026-11-05),
 * 프로젝트는 /projects (src/data/projects.ts)로 옮겼다.
 * 이 저장소는 public이라 회사·고객사 이름, 재직 중인 회사의 업무는 쓰지 않는다 (AGENTS.md).
 */

export const describe = {
	name: 'Daniel',
	role: '인프라를 주로 다루는 개발자. 문제를 따라 front·server·infra·db·ai를 넘나든다.',
	approach: '결과보다 판단이 뒤집힌 과정을 남긴다 — 뭘 저울질했고, 뭘 버렸고, 왜 그쪽으로 갔는지.',
	contact: 'rud167637@gmail.com',
} as const;
