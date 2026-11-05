/**
 * 커밋 메시지 규칙(AGENTS.md) 이전 커밋을 홈 git log에 어떻게 보일지.
 * 이미 push한 히스토리는 고치지 않고, 여기서 커밋 SHA(전체 40자 — 앞 7자는 새 커밋과 겹칠 수 있다)별로 표시 문구를 정한다.
 * null = 홈에서 숨김. 이 표에 없고 규칙에도 맞지 않는 커밋은 숨겨지고 빌드 경고가 난다.
 *
 * post/fix 는 문구 대신 글 slug를 적는다 — 홈에는 그 글의 "지금 제목"이 보인다(draft면 숨김).
 * 새 커밋은 여기 추가하지 않는다. 규칙대로 쓰면 된다.
 */
export type LegacyEntry =
	| { kind: 'site' | 'infra'; title: string }
	| { kind: 'post'; slug: string }
	| { kind: 'fix'; slug: string; reason: string }
	| null;

export const LEGACY: Record<string, LegacyEntry> = {
	'44d80d1cc210733f66685e82067f80032a8e6e5e': { kind: 'post', slug: 'plaintext-encryption-forbidden-rules' },
	'654b91afa580416d53b54ecd5a137efa21d50e96': { kind: 'fix', slug: 'pod-rolling-update-email-code', reason: '맨 위 요약 섹션 제거' },
	'd5b8c09e695ed9dca294fa9fc6a23c0f33ca8119': { kind: 'site', title: '헤더 메뉴 정리 — rss·github는 about으로' },
	'06b116de97bc1417b4415ba14ffec0f480fd4c79': { kind: 'site', title: '글에 댓글(giscus) — 눌러야 불러온다' },
	'0482aab29cde01edb1758e557fdba3339e30c1a5': { kind: 'post', slug: 'pod-rolling-update-email-code' },
	'768f4d6b37ae0c5ee033c2f52d8df2b520e7d3a1': null,
	'78583ba7aee827df9948b228c14cfc7d2cc907a7': { kind: 'infra', title: '공개 도메인 kyungjin.dev 연결 (Terraform)' },
	'ad759930f9ef5661ce33065ab5b49b9757e18f86': { kind: 'site', title: '콘솔 문법 404 페이지' },
	'dd314e73a4786db6d3e96f71facd304cdc91d212': { kind: 'site', title: '소개 페이지를 kubectl describe 형식으로' },
	'177bfea201481048845bf7f3baf9b7eebf6389c8': { kind: 'site', title: '글 상세: 진행바·목차·같은 레이어 글' },
	'338f9ae38eecf908fbe2fec7512abddfee5e2ad5': { kind: 'site', title: '전체 글 표와 레이어 필터' },
	'0cc150b106adb53069cdd254a8e3d3b8b1d6eae4': null,
	'cabf687a3ffa6f582258bae14d04288528519161': { kind: 'site', title: '홈: 콘솔 히어로와 글 표' },
	'6908f283bafcbd85fd131d8527cffcfe3274233d': { kind: 'site', title: '다크/라이트 테마' },
	'757f4cdfbaa0aef5f39f850203a80a0114361ee1': { kind: 'site', title: '글마다 레이어·관점 표시' },
	'5eb99a4d4474edd3657a9a0c00cbe513907fd46a': null,
	'baa916c0d5576f998c51c75fae5c13d488ede246': null,
	'8e7f8b8bb8ccd6845d8e9a2d0c59ec049204281e': null,
	'c16da781878f08fec2f6524be4ea60e46350e020': null,
	'5a5412f27822f0ce6b940ccbd95c9e1e20c09f46': { kind: 'infra', title: 'GCP 프로젝트·Firebase Hosting을 Terraform으로' },
	'934ea8c4a00ff4cc4aad601f822b1264d851b112': null,
	'12b60fbc781efdd5d47a328cd4d648b9a7b683c4': { kind: 'site', title: '블로그 시작 — Astro 골격' },
};
