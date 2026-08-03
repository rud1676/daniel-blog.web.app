// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// TODO(docs/DESIGN.md §15 Q1): 도메인 확정 전 임시값.
	// canonical/OG/사이트맵/RSS가 전부 이 값을 쓰므로 배포 전에 반드시 실제 도메인으로 바꿀 것.
	site: 'https://rud1676.dev',

	// 발행한 슬러그는 바꾸지 않는다. 불가피하면 여기에 리다이렉트를 남긴다 (DESIGN.md §5.3)
	// redirects: { '/posts/old-slug': '/posts/new-slug' },

	integrations: [mdx(), sitemap()],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
