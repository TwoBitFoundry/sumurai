const defaultMaxUtilities = 5

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce maximum number of Tailwind utilities in className prop',
      recommended: false
    },
    messages: {
      tooManyUtilities:
        'className has {{count}} utility classes (max: {{max}}). Consider using a primitive from @/ui/primitives or creating a new one.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxUtilities: { type: 'integer', minimum: 1 }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] || {}
    const maxUtilities = options.maxUtilities || defaultMaxUtilities

    const countTailwindUtilities = (value) => {
      if (!value || typeof value !== 'string') return 0
      const classes = value.trim().split(/\s+/).filter(Boolean)
      return classes.filter((cls) => {
        const isTemplateLiteral = cls.includes('${')
        const isCVACall = cls.includes('(')
        const isCnCall = cls === 'cn'
        return !isTemplateLiteral && !isCVACall && !isCnCall
      }).length
    }

    return {
      JSXAttribute(node) {
        if (node.name?.name !== 'className' || !node.value || node.value.type !== 'Literal') return
        const utilityCount = countTailwindUtilities(node.value.value)
        if (utilityCount > maxUtilities) {
          context.report({
            node: node.value,
            messageId: 'tooManyUtilities',
            data: { count: utilityCount, max: maxUtilities }
          })
        }
      }
    }
  }
}
