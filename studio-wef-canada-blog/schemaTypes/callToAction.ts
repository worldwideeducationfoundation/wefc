import {defineType, defineField} from 'sanity'

/** The green band at the foot of every article. */
export default defineType({
  name: 'callToAction',
  title: 'Call to action',
  type: 'object',
  options: {collapsible: true, collapsed: false},
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'text',
      title: 'Supporting line',
      type: 'text',
      rows: 2,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'primaryLabel',
      title: 'Primary button label',
      type: 'string',
      initialValue: 'Support our work',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'primaryUrl',
      title: 'Primary button link',
      type: 'string',
      initialValue:
        'https://www.zeffy.com/en-US/donation-form/donate-now-to-support-education-for-underprivileged-children',
      description: 'A full URL, or a site path such as /pages/contact.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'secondaryLabel',
      title: 'Secondary button label',
      type: 'string',
      description: 'Leave empty to show only the primary button.',
    }),
    defineField({
      name: 'secondaryUrl',
      title: 'Secondary button link',
      type: 'string',
      description: 'A site path such as /pages/project-updates, or a full URL.',
    }),
  ],
  preview: {select: {title: 'heading', subtitle: 'text'}},
})
