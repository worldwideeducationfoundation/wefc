// sanity/schemas/navigation.ts
import { defineType, defineField } from 'sanity';

export const navItem = defineType({
  name: 'navItem',
  title: 'Navigation Item',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'The display text in the navigation menu (e.g., "About Us")',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'linkType',
      title: 'Link Type',
      type: 'string',
      options: {
        list: [
          { title: 'Internal Page (Path)', value: 'internal' },
          { title: 'External URL (Full Address)', value: 'external' },
          { title: 'Category Filter (Dynamic)', value: 'category' }
        ],
        layout: 'radio'
      },
      initialValue: 'internal',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'path',
      title: 'Internal Path / Target',
      type: 'string',
      description: 'The path on the site (e.g. "/pages/about" or "/blog")',
      hidden: ({ parent }) => parent?.linkType !== 'internal',
    }),
    defineField({
      name: 'externalUrl',
      title: 'External URL',
      type: 'url',
      description: 'Full external address (e.g., "https://wefdallas.org")',
      hidden: ({ parent }) => parent?.linkType !== 'external',
    }),
    defineField({
      name: 'categoryReference',
      title: 'Category Reference',
      type: 'reference',
      to: [{ type: 'category' }],
      description: 'Select a category to link to dynamically (e.g., news/updates)',
      hidden: ({ parent }) => parent?.linkType !== 'category',
    }),
    defineField({
      name: 'children',
      title: 'Submenu Items',
      type: 'array',
      description: 'Add nested links here to automatically generate a header dropdown.',
      of: [{ type: 'navItem' }],
    }),
  ]
});

export const navigation = defineType({
  name: 'navigation',
  title: 'Header Navigation Menu',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Menu Identifier',
      type: 'string',
      description: 'E.g., "Primary Header" or "Footer Navigation"',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'items',
      title: 'Menu Elements',
      type: 'array',
      description: 'Arrange, add, or remove header elements below in sequence.',
      of: [{ type: 'navItem' }],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      title: 'title',
    },
  },
});
