import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LAYERS } from './lib/layers';

// frontmatter 오타는 런타임이 아니라 빌드 전에 잡는다.
const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z
			.object({
				title: z.string(),
				/** OG / meta description 겸용이라 160자를 넘기면 잘린다 */
				description: z.string().max(160),
				pubDate: z.coerce.date(),
				updatedDate: z.coerce.date().optional(),
				/** 정정 사유 한 줄. 있으면 홈 Events에 `Updated`로 뜬다 */
				updatedReason: z.string().max(100).optional(),
				/** 문제가 지나간 영역. 순서 = 흐름 (예: server → infra → db) */
				layers: z.array(z.enum(LAYERS)).min(1).max(4).optional(),
				/** 관점 한 줄. 없으면 목록에서 description을 대신 보여 준다 */
				stance: z.string().max(120).optional(),
				/** 홈 대표 글. 발행 글 중 최대 2편 (getPublishedPosts에서 검사) */
				pinned: z.boolean().default(false),
				tags: z.array(z.string()).default([]),
				/** true면 경로 자체가 생성되지 않는다 */
				draft: z.boolean().default(false),
				/** 외부에 먼저 실린 글일 때만. 크로스포스팅은 반대로 이쪽이 canonical이다 */
				canonical: z.string().url().optional(),
				heroImage: z.optional(image()),
			})
			.superRefine((data, ctx) => {
				if (!data.draft && !data.layers) {
					ctx.addIssue({ code: 'custom', path: ['layers'], message: '발행 글에는 layers가 필요하다' });
				}
				if (data.layers && new Set(data.layers).size !== data.layers.length) {
					ctx.addIssue({ code: 'custom', path: ['layers'], message: 'layers에 같은 레이어가 두 번 있다' });
				}
				if (data.updatedReason && !data.updatedDate) {
					ctx.addIssue({
						code: 'custom',
						path: ['updatedReason'],
						message: 'updatedReason에는 updatedDate가 필요하다',
					});
				}
			}),
});

export const collections = { posts };
