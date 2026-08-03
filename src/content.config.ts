import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// DESIGN.md §5.1 — frontmatter 오타는 런타임이 아니라 빌드 전에 잡는다.
const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			/** OG / meta description 겸용이라 160자를 넘기면 잘린다 */
			description: z.string().max(160),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			tags: z.array(z.string()).default([]),
			/** true면 경로 자체가 생성되지 않는다 (DESIGN.md §5.2) */
			draft: z.boolean().default(false),
			/** 외부에 먼저 실린 글일 때만. 크로스포스팅은 반대로 이쪽이 canonical이다 (§8) */
			canonical: z.string().url().optional(),
			heroImage: z.optional(image()),
		}),
});

export const collections = { posts };
