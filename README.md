# daniel-blog

개인 기술 블로그. **Astro + GCP Firebase Hosting(Terraform으로 구성)**, 정적 출력, island 0개로 시작한다.

작업 규칙은 [`AGENTS.md`](./AGENTS.md)를 따른다.

## 실행

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview
```

Node는 `.nvmrc`(22) 기준. GitHub Actions 배포도 같은 버전으로 맞춘다.

## 글 쓰는 법

1. 원고는 **Obsidian vault의 `BLOG/` 폴더가 원본**이다. vault 전체를 발행하지 않는다.
2. 발행할 글만 `src/content/posts/`로 복사한다. 파일명이 곧 URL이다 — **영문 kebab-case 고정**.
3. frontmatter를 아래 [frontmatter](#frontmatter) 형식으로 다시 쓴다. 스키마 위반은 빌드가 막는다.
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

### frontmatter

```yaml
---
title: '제목 — 판단이 뒤집힌 지점이 드러나게'
description: '검색 결과·OG 카드에 노출된다. 160자 이내.'
pubDate: 'YYYY-MM-DD'
layers: [server, infra, db]   # 문제가 지나간 영역, 순서 = 흐름. 1~4개
                              # front · server · infra · db · ai · build · tooling 중에서만
stance: '이 기술을 나는 이렇게 본다 — 관점 한 줄 (120자 이내)'   # 없으면 description을 보여 준다
pinned: true                  # 홈 대표 글. 발행 글 중 최대 2편
# updatedDate: 'YYYY-MM-DD'   # 크게 고쳤을 때만
# updatedReason: '무엇을 왜 정정했나 한 줄 (100자 이내)'   # 있으면 홈 Events에 Updated로 뜬다. updatedDate 필수
tags: ['tag-a', 'tag-b']
draft: true                   # 발행할 때 false로 바꾸거나 줄을 지운다
# canonical: 'https://...'    # 외부에 먼저 실린 글일 때만
---
```

빌드가 막는 경우: 목록 밖 레이어·중복 레이어, 발행 글에 `layers` 없음, `pinned` 발행 글 3편 이상, `updatedDate` 없는 `updatedReason`.

쓰기 전 확인:
- 결과("무엇을 했다")가 아니라 과정(무엇을 저울질했고 왜 그쪽으로 갔나)이 본문인가?
- 사내 코드·계정 정보·고객사명이 섞이지 않았는가?
- dataviewjs 블록, 위키링크, Obsidian 콜아웃을 정리했는가?

## 구조

```
src/
  content.config.ts        # 컬렉션 스키마 (Zod 검증)
  content/posts/           # 발행 글 — Obsidian에서 복사
  lib/posts.ts             # draft 필터·정렬·레이어 집계 (모든 페이지가 여기를 거친다)
  components/              # 인터랙션 없으면 반드시 .astro
  layouts/                 # BaseLayout(일반 페이지) / PostLayout(글)
  pages/                   # /, /posts, /posts/layer/[layer], /posts/[slug], /about, /rss.xml
public/images/             # 글 이미지
```

**확장자 규칙**: 인터랙션이 없으면 `.astro`. `.tsx`는 island로 쓸 것만 만든다.
(`.tsx`로 만들고 `client:*`를 안 붙이면 동작하지 않는 죽은 UI가 된다)

## 성능 예산 — 넘으면 머지하지 않는다

| 항목 | 예산 |
|---|---|
| 글 상세 페이지 클라이언트 JS | ≤ 10kB (현재 약 1.3kB: 테마 + 목차). `npm run build && npm run check:js` 로 잰다 |
| 페이지 총 전송량 (이미지 제외) | ≤ 100kB |
| Lighthouse Performance / SEO / Best Practices | ≥ 95 |
| LCP (모바일 스로틀링) | ≤ 2.0s |

island를 하나 추가할 때마다 다시 잰다. `client:load`를 습관적으로 쓰지 말고
`client:visible` / `client:idle`을 먼저 고려한다.

## 배포 (Firebase Hosting)

- GCP 리소스는 콘솔이 아니라 [`infra/`](./infra/README.md)의 Terraform으로 만든다. `apply`는 사람이 `plan`을 읽고 승인한 뒤에만.
  - `infra/bootstrap/` — GCP 프로젝트 `daniel-blog-1676` · state 버킷 · 월 예산 알림
  - `infra/main/` — Firebase 프로젝트 · Hosting 사이트 `daniel-blog` · 커스텀 도메인 `kyungjin.dev` · GitHub Actions 배포 권한(WIF, `ci.tf`)
- 사이트 응답 헤더·캐시·리다이렉트는 `firebase.json`, 배포 대상은 `.firebaserc`.
- **live 배포는 `live-*` 태그 push로만 한다** ([`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)). main에 머지해도 배포되지 않는다:
  ```bash
  git switch main && git pull
  git tag live-2026-11-05             # 같은 날 두 번째는 live-2026-11-05.2
  git push origin live-2026-11-05     # → 빌드 → JS 예산 검사 → 배포 → 홈의 tag: live 커밋 확인
  ```
  - 태그는 main 위의 커밋에만 찍는다(아니면 워크플로가 실패한다). 매일 06:00(KST)에 가장 최근 태그를 다시 빌드한다(글 표 AGE 갱신).
  - 로컬 `firebase deploy`는 하지 않는다. 했다면 다음 태그 배포가 덮어쓴다.
- 홈 첫 화면은 이 저장소의 `git log`다 — 커밋 제목 규칙은 [`AGENTS.md`](./AGENTS.md#커밋-메시지-규칙).
- 방문 분석은 Firebase Hosting 요청 로그 → Cloud Logging → BigQuery로 한다(JS 0, 예정). 분석 스크립트는 붙이지 않는다
- 배포 당일 Search Console에 `sitemap-index.xml` 제출 — 색인 데이터는 소급되지 않는다

## 남은 일

- [x] 공개 도메인 `kyungjin.dev`로 결정
- [x] 도메인 연결 — `kyungjin.dev` live
- [x] `/about` — 이름 Daniel, 경력 타임라인은 두지 않는다
- [x] `infra/bootstrap` apply — GCP 프로젝트 · state 버킷(GCS) · 예산 알림
- [x] `infra/main` apply → 첫 배포 (`daniel-blog.web.app`)
- [ ] GitHub Actions 배포 — 코드(`infra/main/ci.tf`·`deploy.yml`) 준비됨. `ci.tf` apply · 저장소 변수/시크릿 등록 · 첫 `live-*` 태그가 남음
- [x] 커스텀 도메인 연결 + HTTPS (Cloudflare DNS에 TXT·A 레코드, DNS only)
- [ ] Search Console 등록 + 사이트맵 제출
- [ ] 초고(`draft: true`) 완성
- [ ] 성능 예산 실측 기록

