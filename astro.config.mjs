// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// 공개 도메인. canonical/OG/사이트맵/RSS가 전부 이 값을 쓴다.
	// infra/main/domain.tf 의 custom_domain, public/robots.txt 와 같이 움직인다.
	site: 'https://kyungjin.dev',

	// 발행한 슬러그는 바꾸지 않는다. 불가피하면 여기에 리다이렉트를 남긴다
	// redirects: { '/posts/old-slug': '/posts/new-slug' },

	integrations: [mdx(), sitemap()],

	// 코드 블록: 빌드 때 색을 입힌다(JS 0). 두 테마 색을 CSS 변수로 함께 내보내고
	// global.css가 html[data-theme]에 맞춰 고른다.
	markdown: {
		shikiConfig: {
			themes: { dark: 'github-dark', light: 'github-light' },
			defaultColor: false,
		},
	},
	// 폰트는 시스템 폰트(tokens.css의 --mono/--sans)를 쓴다. 웹폰트를 받지 않는다.
});
