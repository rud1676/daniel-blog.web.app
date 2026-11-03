/**
 * /about 내용. 화면(about.astro)과 분리해 사실만 여기 모은다.
 * 근거: 작성자의 이력서 원고(저장소 밖). 이 저장소는 public이라
 *  - 회사·고객사 이름은 쓰지 않는다.
 *  - 재직 중인 회사는 "합류" 한 줄만 쓰고 세부 업무는 쓰지 않는다 (AGENTS.md).
 *  - Role 문구는 홈 히어로와 같은 "인프라를 주로 다루는"으로 맞춘다 (작성자 결정 2026-11-03).
 */

export const describe = {
	name: 'Daniel',
	role: '인프라를 주로 다루는 개발자. 문제를 따라 front·server·infra·db·ai를 넘나든다.',
	approach: '결과보다 판단이 뒤집힌 과정을 남긴다 — 뭘 저울질했고, 뭘 버렸고, 왜 그쪽으로 갔는지.',
	strengths: 'Terraform · k3s로 서비스 직접 운영 · 배포 순서와 무중단 전환 · 측정으로 판단 근거 만들기 · 버린 선택지의 이유 남기기',
	contact: 'rud167637@gmail.com',
} as const;

export type AboutEvent = {
	/** 표시용 시점 (YYYY 또는 YYYY.MM) */
	when: string;
	type: 'Normal' | 'Warning';
	reason: string;
	title: string;
	detail?: string;
};

/** 경력 = Events 타임라인. 최신이 위. Warning = 틀렸던 전제를 고친 일. */
export const events: AboutEvent[] = [
	{
		when: '2026',
		type: 'Warning',
		reason: 'Reconsidered',
		title: '메모리에 두던 인증번호를 DB로 옮김',
		detail: 'replicas가 1이어도 롤링 업데이트 중엔 파드가 둘이 된다. "프로세스는 하나"라는 전제가 깨지는 지점을 찾았다.',
	},
	{
		when: '2026.07',
		type: 'Normal',
		reason: 'Migrated',
		title: '흩어진 개인 서비스 운영을 Terraform + k3s로 통합',
		detail: 'App Runner·EC2·Amplify로 나뉘어 있던 운영을 Terraform + k3s(EC2) + CloudFront로 옮겼다. 콘솔 리소스는 import해 plan 변경 없음으로 검증.',
	},
	{
		when: '2025.07',
		type: 'Normal',
		reason: 'Joined',
		title: '헬스케어 플랫폼 팀에 프리랜서로 합류',
		detail: '프론트엔드로 시작해 서버·DB·배포까지 담당을 넓혔다.',
	},
	{
		when: '2024.12',
		type: 'Normal',
		reason: 'Started',
		title: 'MLB 데이터 서비스를 기획부터 운영까지 혼자 구축',
		detail: 'API·배치·프론트·어드민을 혼자 만들고 운영한다.',
	},
	{
		when: '2022.03',
		type: 'Normal',
		reason: 'Started',
		title: '외주 개발로 시작',
		detail: 'Unity 게임부터 React·Next.js 웹, Express 서버까지 2~5인 팀 프로젝트를 맡았다.',
	},
];

export type AboutProject = {
	name: string;
	summary: string;
	stack: string;
	/** LED: 지금 돌아가고 있나 */
	live: boolean;
	href?: string;
};

export const projects: AboutProject[] = [
	{
		name: 'mlb-data-service',
		summary: '혼자 기획·개발·운영하는 MLB 경기 데이터 서비스',
		stack: 'NestJS · Next.js · PostgreSQL · Terraform · k3s',
		live: true,
		href: 'https://blfil.com',
	},
	{
		name: 'daniel-blog',
		summary: '이 블로그. 정적 생성, 인프라는 Terraform으로',
		stack: 'Astro · Firebase Hosting · Terraform',
		live: true,
		href: 'https://github.com/rud1676/daniel-blog.web.app',
	},
	{
		name: 'dagent',
		summary: '글·이력서를 근거로 답하는 AI 버전의 Daniel (준비 중)',
		stack: '터미널에서 dagent 실행',
		live: false,
	},
];
