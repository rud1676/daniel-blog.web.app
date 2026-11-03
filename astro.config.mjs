// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// TODO: 공개 도메인은 kyungjin.dev (연결 전 임시값).
	// canonical/OG/사이트맵/RSS가 전부 이 값을 쓰므로 배포 전에 반드시 실제 도메인으로 바꿀 것.
	site: 'https://rud1676.dev',

	// 발행한 슬러그는 바꾸지 않는다. 불가피하면 여기에 리다이렉트를 남긴다
	// redirects: { '/posts/old-slug': '/posts/new-slug' },

	integrations: [mdx(), sitemap()],
	// 폰트는 시스템 폰트(tokens.css의 --mono/--sans)를 쓴다. 웹폰트를 받지 않는다.
});
