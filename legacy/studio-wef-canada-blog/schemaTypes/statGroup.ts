import {defineType, defineField, defineArrayMember} from 'sanity'

/**
 * The three-up number strip used inside project articles
 * ("66+ scholars supported", "2 partner universities", ...).
 */
export default defineType({
  name: 'statGroup',
  title: 'Stat strip',
  type: 'object',
  fields: [
    defineField({
      name: 'stats',
      title: 'Stats',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'stat',
          fields: [
            defineField({
              name: 'value',
              title: 'Number',
              type: 'string',
              description: 'The big figure, e.g. "66+" or "$120K".',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              description: 'The small line underneath, e.g. "scholars supported".',
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {select: {title: 'value', subtitle: 'label'}},
        }),
      ],
      validation: (Rule) => Rule.required().min(1).max(4),
    }),
  ],
  preview: {
    select: {stats: 'stats'},
    prepare({stats}) {
      const list = (stats ?? []) as {value?: string; label?: string}[]
      return {
        title: 'Stat strip',
        subtitle: list.map((s) => `${s.value} ${s.label}`).join(' · '),
      }
    },
  },
})
