import {defineType, defineField, defineArrayMember} from 'sanity'

/**
 * Every article on the site — project updates, success stories and the
 * active-project pages — is the same document type. They share one hero /
 * article / CTA template, so splitting them into three schemas would only
 * duplicate fields. `postType` decides the URL prefix, the hero eyebrow and
 * which listing page a post appears on.
 */
export const POST_TYPES = [
  {title: 'Project Update', value: 'update'},
  {title: 'Success Story', value: 'story'},
  {title: 'Active Project', value: 'project'},
] as const

export default defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'meta', title: 'Details'},
    {name: 'cta', title: 'Call to action'},
    {name: 'seo', title: 'SEO'},
  ],
  fields: [
    defineField({
      name: 'postType',
      title: 'Post type',
      type: 'string',
      group: 'meta',
      description:
        'Decides the URL and the listing page. Update goes to /pages/updates/, Success Story to /pages/stories/, Active Project to /pages/projects/.',
      options: {list: [...POST_TYPES], layout: 'radio'},
      initialValue: 'update',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'content',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      description: 'The last part of the URL. Changing it breaks existing links.',
      options: {source: 'title', maxLength: 96},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'cardTitle',
      title: 'Card title',
      type: 'string',
      group: 'content',
      description:
        'A shorter heading for the listing page card. Leave empty to reuse the full title.',
    }),
    defineField({
      name: 'excerpt',
      title: 'Card summary',
      type: 'text',
      rows: 3,
      group: 'content',
      description: 'One or two sentences shown on the listing page card.',
      validation: (Rule) => Rule.required().max(320),
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      group: 'content',
      description: 'Used on the listing card and as the social sharing image.',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
          description: 'Describes the image for screen readers and search engines.',
        }),
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'block',
          // The article template styles paragraphs, headings, bullet lists and
          // pull quotes. Anything outside that list would render unstyled, so
          // the editor is only offered what the page can actually draw.
          styles: [
            {title: 'Paragraph', value: 'normal'},
            {title: 'Heading', value: 'h2'},
            {title: 'Sub-heading', value: 'h3'},
            {title: 'Quote', value: 'blockquote'},
          ],
          lists: [{title: 'Bullet', value: 'bullet'}],
          marks: {
            decorators: [
              {title: 'Bold', value: 'strong'},
              {title: 'Italic', value: 'em'},
            ],
            annotations: [
              defineArrayMember({
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [
                  defineField({
                    name: 'href',
                    type: 'url',
                    title: 'URL',
                    validation: (Rule) =>
                      Rule.uri({
                        allowRelative: true,
                        scheme: ['http', 'https', 'mailto', 'tel'],
                      }),
                  }),
                ],
              }),
            ],
          },
        }),
        defineArrayMember({
          type: 'image',
          title: 'Image',
          options: {hotspot: true},
          fields: [
            defineField({
              name: 'alt',
              title: 'Alternative text',
              type: 'string',
              description: 'Also shown as the caption underneath the image.',
            }),
          ],
        }),
        defineArrayMember({type: 'statGroup'}),
      ],
      validation: (Rule) => Rule.required().min(1),
    }),

    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      group: 'meta',
      to: [{type: 'author'}],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      group: 'meta',
      of: [defineArrayMember({type: 'reference', to: [{type: 'category'}]})],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      group: 'meta',
      description: 'Every listing page is ordered newest first by this date.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'dateLabel',
      title: 'Date label',
      type: 'string',
      group: 'meta',
      description:
        'The text shown beside the clock in the hero. Leave empty to show the published date. Use it for things like "Active Since 2026" or "Ongoing".',
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      group: 'meta',
      description: 'Shown beside the pin in the hero, e.g. "Chitral, Pakistan".',
    }),
    defineField({
      name: 'featured',
      title: 'Feature on the homepage',
      type: 'boolean',
      group: 'meta',
      initialValue: false,
    }),

    defineField({
      name: 'cta',
      title: 'Call to action',
      type: 'callToAction',
      group: 'cta',
      description: 'The green band at the bottom of the article.',
    }),

    defineField({
      name: 'seoTitle',
      title: 'SEO title',
      type: 'string',
      group: 'seo',
      description: 'Browser tab and search result title. Falls back to the post title.',
    }),
    defineField({
      name: 'seoDescription',
      title: 'Meta description',
      type: 'text',
      rows: 3,
      group: 'seo',
      description: 'Search result snippet. Falls back to the card summary.',
      validation: (Rule) => Rule.max(320),
    }),
  ],

  orderings: [
    {
      title: 'Newest first',
      name: 'publishedAtDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
    {
      title: 'Oldest first',
      name: 'publishedAtAsc',
      by: [{field: 'publishedAt', direction: 'asc'}],
    },
  ],

  preview: {
    select: {
      title: 'title',
      postType: 'postType',
      date: 'publishedAt',
      media: 'mainImage',
    },
    prepare({title, postType, date, media}) {
      const label = POST_TYPES.find((t) => t.value === postType)?.title ?? 'Post'
      const when = date ? new Date(date).toISOString().slice(0, 10) : 'no date'
      return {title, subtitle: `${label} · ${when}`, media}
    },
  },
})
