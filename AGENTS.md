## 이 저장소의 규칙 (먼저 읽을 것)

- **이 저장소는 public GitHub repo(`github.com/rud1676/daniel-blog.web.app`)다.** 커밋하는 모든 것과 커밋 히스토리는 누구나 본다.
  - 키·토큰·결제 계정 ID·`terraform.tfvars`·state 파일을 커밋하지 않는다 (`.gitignore`가 막지만 커밋 전에 diff를 확인한다).
  - 로컬 절대경로, 회사·고객사·업무 노트 이름을 문서·코드·커밋 메시지에 쓰지 않는다. 회사 이름과 겹치는 호스트명·기기명도 쓰지 않는다(챗봇 서버는 코드에서 `agent`로만 부른다).
  - 재직 중인 회사에서 겪은 일은 **일반화한 경험담으로만** 쓴다. 회사·고객사·동료 이름, 티켓 번호, 내부 링크·채널명, 내부 수치(트래픽·매출·인원 등)는 쓰지 않는다. `/about`에는 "합류" 한 줄(회사명 없이)만 둔다.
  - 한 번 push한 내용은 파일에서 지워도 히스토리에 남는다. 실수로 올렸으면 파일 수정이 아니라 히스토리 정리 + 키 폐기가 필요하다.
- 설계 결정은 작성자의 기획 문서(이 저장소 밖)에서 관리한다. 이 저장소에는 결과물과 아래 규칙만 둔다. 규칙을 바꿀 땐 이 파일을 고친다.
- **글 상세 페이지 JS ≤ 10kB. 읽기에 필요 없는 JS는 넣지 않는다.**
  - 허용: 테마 기억·깜빡임 방지 인라인 스크립트, 목차 현재 절 강조 같은 읽기 보조.
  - 예산 밖: 터미널·챗봇(`dagent`) — 버튼은 정적, 열 때 `import()`로 불러온다.
  - 금지: 조회수 카운터, 애니메이션 라이브러리, 분석 SDK.
- **island를 함부로 늘리지 않는다.** 인터랙션이 없으면 `.astro`로 만든다.
  `.tsx`는 `client:*`를 붙일 것만. 추가할 때마다 README의 성능 예산을 다시 잰다.
- **기능이 글을 밀어내지 않게 한다.** 기획에서 합의되지 않은 기능은 만들지 않는다.
- **계측 스크립트를 넣지 않는다.** GA4·쿠키 배너·경량 분석 스크립트 모두 쓰지 않는다. 방문 분석은 Firebase Hosting 요청 로그 → BigQuery(서버 쪽, JS 0)로 한다. `llms.txt`도 넣지 않는다.
- `src/content/posts/`의 글은 Obsidian vault에서 복사해 온 것이다.
  내용을 임의로 창작하지 말 것 — 초고(`draft: true`)는 뼈대만 있는 게 정상이다.
- **live 배포는 `live-*` 태그 push로만 한다** (`.github/workflows/deploy.yml`). main push로는 배포되지 않고, 로컬 `firebase deploy`도 하지 않는다. 태그는 main 위의 커밋에만 찍는다.
- 공개 도메인은 `kyungjin.dev`다. `astro.config.mjs`의 `site`, `public/robots.txt`, `infra/main/domain.tf`가 함께 움직인다. `daniel-blog.web.app`은 Firebase 기본 주소일 뿐 공개 주소로 쓰지 않는다.

## 커밋 메시지 규칙

홈 첫 화면이 이 저장소의 `git log`다. **커밋 제목이 그대로 방문자에게 보인다.** 그래서 제목은 개발 용어가 아니라 "독자가 읽을 한 줄"로 쓴다.

```
<종류>: <독자가 읽을 한 줄>        ← 제목. 한국어, 50자 안, 마침표 없음

<개발용 세부: 무엇을 왜, 파일·결정>  ← 본문. 홈에 안 나온다
```

| 종류 | 언제 | 홈에서 | 예 |
|---|---|---|---|
| `post` | 글 **발행** (발행 글 1편만 건드린다) | 글 제목 + 그 글 링크 (제목 대신 지금 글 제목이 보인다) | `post: 파드는 교체됐는데, 이메일 인증번호는 어디로 갔을까?` |
| `fix` | 발행 글 **정정** — 제목에 정정 사유 | `<글 제목> — <사유>` + 그 글 링크 | `fix: 맨 위 요약 섹션 제거` |
| `site` | 화면·기능 | 제목 그대로 + GitHub 커밋 링크 | `site: 헤더 메뉴 정리 — rss·github는 about으로` · `site: 글에 댓글(giscus) — 눌러야 불러온다` · `site: 다크/라이트 테마` |
| `infra` | Terraform·배포·도메인 | 제목 그대로 + GitHub 커밋 링크 | `infra: 공개 도메인 kyungjin.dev 연결 (Terraform)` · `infra: GCP 프로젝트·Firebase Hosting을 Terraform으로` |
| `draft` | 초고 추가·수정 | 안 나옴 | `draft: 초고 1편 정리` |
| `docs` · `chore` | README·설정·정리 | 안 나옴 | `chore: 의존성 업데이트` |

- 제목은 **무엇이 바뀌었는지를 읽는 사람 말로** 쓴다. `feat(header): …` 같은 스코프, 함수·파일 이름, "추가/수정/리팩터링" 같은 개발 동사로 시작하지 않는다.
  - ✗ `feat(post): 글 상세 메타 박스·진행바·목차·같은 레이어 글, JS 예산 검사`
  - ○ `site: 글 상세: 진행바·목차·같은 레이어 글` (JS 예산 검사 같은 세부는 본문에)
- **한 커밋 = 한 종류.** 발행 글과 초고를 한 커밋에 섞지 않는다 — 섞이면 초고 제목이 제목에 새기 쉽다.
- **초고(`draft: true`) 제목은 어떤 커밋 제목에도 쓰지 않는다.** 초고는 어디에서도 노출되지 않아야 한다.
- 위 public 규칙은 커밋 제목에 더 엄격하게 적용된다: 회사·고객사 이름, 재직 회사 업무, 회사명과 겹치는 기기명, 티켓 번호, 로컬 경로를 쓰지 않는다. (CI가 비공개 금지어 목록으로 한 번 더 검사한다)
- 이 규칙 이전의 커밋(`feat(…)` · `content:` 형식)은 히스토리를 고치지 않는다. 홈에서는 SHA별 표시 문구 표(`src/data/gitlog-legacy.ts`)로 보여 준다. 표에 없고 규칙에도 안 맞는 커밋은 홈에서 숨겨진다.
- main에는 **rebase and merge**로만 들어간다(GitHub 설정에서 merge commit·squash를 껐다). merge 커밋을 만들지 않는다.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
