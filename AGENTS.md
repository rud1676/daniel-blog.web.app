## 이 저장소의 규칙 (먼저 읽을 것)

- **정본 설계서는 `docs/DESIGN.md`.** 스택/계측/구조를 바꾸려면 거기 ADR의 근거부터 반박한다.
  결정이 바뀌면 기존 항목을 지우지 말고 새 ADR을 덧붙인다.
- **island를 함부로 늘리지 않는다.** 인터랙션이 없으면 `.astro`로 만든다.
  `.tsx`는 `client:*`를 붙일 것만. 추가할 때마다 README의 성능 예산을 다시 잰다.
- **글보다 기능을 먼저 만들지 않는다.** 댓글·검색·다크모드 토글은 글 3편 이후(M2)다.
- **계측을 늘리지 않는다.** GA4는 붙이지 않기로 했다 (DESIGN.md ADR-004). `llms.txt`도 넣지 않는다.
- `src/content/posts/`의 글은 Obsidian vault에서 복사해 온 것이다.
  내용을 임의로 창작하지 말 것 — 초고(`draft: true`)는 뼈대만 있는 게 정상이다.
- 도메인은 아직 미확정이다. `astro.config.mjs`의 `site`, `public/robots.txt`, `src/consts.ts`가 함께 움직인다.

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
