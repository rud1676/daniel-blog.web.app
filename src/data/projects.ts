import type { Layer } from '../lib/layers';

/**
 * /projects 카드와 /projects/list 표의 데이터. 개인 프로젝트만 둔다.
 * 근거: 작성자의 이력서 원고(저장소 밖). 비용 수치는 넣지 않는다.
 * 순서 = 슬라이드 순서. 첫 카드가 가운데에서 시작한다(JS 없이 처음 위치를 못 옮기므로 순서로 정한다).
 */
export type Project = {
	/** 카드 id → /projects#<slug> (모아보기·dagent sources 링크) */
	slug: string;
	title: string;
	/** 카드에 크게 보이는 한 줄 */
	hook: string;
	status: 'Running' | 'Pending';
	/** 'YYYY.MM'. 아직 시작 전이면 null */
	since: string | null;
	/** 순서 = 문제가 지나간 흐름 */
	layers: Layer[];
	/** 포스터 그라데이션 색 */
	tint: Layer;
	/** 한 일 3줄 — 카드의 `› 한 일 보기`를 펼쳐야 보인다 */
	did: string[];
	stack: string[];
	link?: { label: string; href: string };
};

export const projects: Project[] = [
	{
		slug: 'mlb-data-service',
		title: 'MLB 데이터 서비스',
		hook: '혼자 기획·개발·운영하는 MLB 경기 데이터 서비스',
		status: 'Running',
		since: '2024.12',
		layers: ['front', 'server', 'db', 'infra'],
		tint: 'infra',
		did: [
			'App Runner·EC2·Amplify로 흩어진 운영을 Terraform + k3s(EC2) + CloudFront로 통합',
			'콘솔 리소스를 import해 plan 변경 없음으로 검증, 환경별 state로 분리',
			'GitHub OIDC 배포 · 포트 미개방(SSM으로 kubectl) · 어드민은 WAF IP 제한',
		],
		stack: ['NestJS', 'Next.js', 'PostgreSQL', 'Terraform', 'k3s'],
		link: { label: 'blfil.com', href: 'https://blfil.com' },
	},
	{
		slug: 'daniel-blog',
		title: '이 블로그',
		hook: '글 상세 JS ≤ 10kB를 지키는 콘솔형 기술 블로그',
		status: 'Running',
		since: '2026.08',
		layers: ['front', 'infra'],
		tint: 'infra',
		did: [
			'Astro 정적 생성 · 빌드마다 글 상세 JS 예산 검사 (지금 2.3kB)',
			'GCP 프로젝트·Hosting·도메인을 Terraform으로, apply는 사람 승인',
			'댓글은 눌러야 불러오는 giscus, 분석 SDK 없음',
		],
		stack: ['Astro', 'Firebase Hosting', 'Terraform', 'Cloudflare DNS'],
		link: { label: 'github', href: 'https://github.com/rud1676/daniel-blog.web.app' },
	},
	{
		slug: 'dagent',
		title: 'AI 버전의 Daniel',
		hook: '글·이력서·프로젝트 기록만 근거로 답하는 챗봇',
		status: 'Pending',
		since: null,
		layers: ['ai', 'server'],
		tint: 'ai',
		did: ['/cli에서 dagent로 실행', '답변마다 근거 글을 sources로', 'agent가 꺼져 있으면 셸 명령만 동작'],
		stack: ['준비 중'],
		link: { label: '/cli', href: '/cli' },
	},
];
