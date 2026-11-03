## 이 저장소의 규칙 (먼저 읽을 것)

- **이 저장소는 public GitHub repo(`github.com/rud1676/daniel-blog.web.app`)다.** 커밋하는 모든 것과 커밋 히스토리는 누구나 본다.
  - 키·토큰·결제 계정 ID·`terraform.tfvars`·state 파일을 커밋하지 않는다 (`.gitignore`가 막지만 커밋 전에 diff를 확인한다).
  - 로컬 절대경로, 회사·고객사·업무 노트 이름을 문서·코드·커밋 메시지에 쓰지 않는다. 회사 이름과 겹치는 호스트명·기기명도 쓰지 않는다(챗봇 서버는 코드에서 `agent`로만 부른다).
  - 재직 중인 회사의 세부 업무는 쓰지 않는다. 허용되는 건 `/about` 타임라인의 "합류" 한 줄(회사명 없이)뿐이다.
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
- 공개 도메인은 `kyungjin.dev`(연결 전)다. `astro.config.mjs`의 `site`, `public/robots.txt`, `src/consts.ts`가 함께 움직인다. `daniel-blog.web.app`은 Firebase 기본 주소일 뿐 공개 주소로 쓰지 않는다.

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
