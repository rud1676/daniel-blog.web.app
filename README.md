# daniel-blog

개인 기술 블로그. **Astro + Cloudflare Pages**, 정적 출력, island 0개로 시작한다.

설계 근거·ADR·마일스톤은 **[`docs/DESIGN.md`](./docs/DESIGN.md)가 정본**이다.
결정을 바꿀 땐 기존 ADR을 지우지 말고 새 항목을 덧붙인다.

## 실행

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview
```

Node는 `.nvmrc`(22) 기준. Cloudflare Pages 빌드 설정도 같은 버전으로 맞춘다.

## 글 쓰는 법

1. 원고는 **Obsidian vault의 `BLOG/` 폴더가 원본**이다. vault 전체를 발행하지 않는다.
2. 발행할 글만 `src/content/posts/`로 복사한다. 파일명이 곧 URL이다 — **영문 kebab-case 고정**.
3. frontmatter를 `docs/POST_TEMPLATE.md` 형식으로 다시 쓴다. 스키마 위반은 빌드가 막는다.
4. Obsidian 문법을 정리한다:
   | Obsidian | 처리 |
   |---|---|
   | `[[위키링크]]` | 일반 마크다운 링크로. 대상이 미발행이면 링크를 풀고 텍스트만 남긴다 |
   | `![[이미지.png]]` | `public/images/`로 복사 후 `![설명](/images/이미지.png)` |
   | `> [!note]` 콜아웃 | 인용문으로 낮춘다 (지원하려면 `remark-callouts` 추가) |
   | ` ```dataviewjs ` | **절대 복사하지 않는다.** vault 전용 |
5. **보안 체크(필수)**: 사내 코드·계정 정보·고객사명이 섞이지 않았는지 확인한다.
   실무 경험을 쓸 땐 회사/서비스명을 일반화하고 코드는 재작성한다.
   이 단계를 자동화하지 않은 건 의도적이다 — 여기가 체크포인트다.
6. `draft: true`면 경로 자체가 생성되지 않는다. 쓰다 만 글은 노출되지 않는다.

**한 번 발행한 슬러그는 바꾸지 않는다.** 불가피하면 `astro.config.mjs`의 `redirects`에 남긴다.

## 구조

```
src/
  content.config.ts        # 컬렉션 스키마 (Zod 검증)
  content/posts/           # 발행 글 — Obsidian에서 복사
  lib/posts.ts             # draft 필터·정렬·태그 집계 (모든 페이지가 여기를 거친다)
  components/              # 인터랙션 없으면 반드시 .astro
  layouts/                 # BaseLayout(일반 페이지) / PostLayout(글)
  pages/                   # /, /posts, /posts/[slug], /tags/[tag], /about, /rss.xml
public/images/             # 글 이미지
```

**확장자 규칙**: 인터랙션이 없으면 `.astro`. `.tsx`는 island로 쓸 것만 만든다.
(`.tsx`로 만들고 `client:*`를 안 붙이면 동작하지 않는 죽은 UI가 된다)

## 성능 예산 — 넘으면 머지하지 않는다

| 항목 | 예산 |
|---|---|
| 글 상세 페이지 클라이언트 JS | ≤ 10kB (현재 사실상 0) |
| 페이지 총 전송량 (이미지 제외) | ≤ 100kB |
| Lighthouse Performance / SEO / Best Practices | ≥ 95 |
| LCP (모바일 스로틀링) | ≤ 2.0s |

island를 하나 추가할 때마다 다시 잰다. `client:load`를 습관적으로 쓰지 말고
`client:visible` / `client:idle`을 먼저 고려한다.

## 배포 (Cloudflare Pages)

- 빌드 커맨드 `npm run build` / 출력 디렉터리 `dist` / Node 22
- Web Analytics는 Pages 대시보드에서 토글 ON (코드 변경 없음, 쿠키리스)
- 배포 당일 Search Console에 `sitemap-index.xml` 제출 — 색인 데이터는 소급되지 않는다

## 남은 일

- [ ] **도메인 확정** (DESIGN.md §15 Q1) → `astro.config.mjs`의 `site`, `public/robots.txt`, `src/consts.ts` 세 곳을 함께 교체
- [ ] `/about` 실명·소속 공개 수위 확정 (§15 Q2), `RESUME_URL` 채우기
- [ ] Cloudflare Pages 연결 + 도메인 + HTTPS
- [ ] Search Console 등록 + 사이트맵 제출
- [ ] 초고 2편(`draft: true`) 완성 — 글 3편이 M1 완료 조건
- [ ] 성능 예산 실측 기록

M2 이후(댓글·OG 자동생성·다크모드 토글·검색)는 **글 3편 뒤에** 손댄다.
