export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Warn when className props contain more than the specified number of Tailwind utilities',
      category: 'Stylistic Issues',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          maxUtilities: {
            type: 'number',
            default: 5,
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {}
    const maxUtilities = options.maxUtilities || 5

    function countTailwindUtilities(classNameValue) {
      if (!classNameValue || typeof classNameValue !== 'string') {
        return 0
      }

      const classes = classNameValue.trim().split(/\s+/).filter(Boolean)

      return classes.filter((cls) => {
        const isTemplateLiteral = cls.includes('${')
        const isCVACall = cls.includes('(')
        const isCnCall = cls === 'cn'
        const isSpreadOperator = cls.includes('...')
        const isPrimitiveComposition = cls.includes('Gradient') || cls.includes('Glass')

        return (
          !isTemplateLiteral &&
          !isCVACall &&
          !isCnCall &&
          !isSpreadOperator &&
          !isPrimitiveComposition
        )
      }).length
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== 'className') {
          return
        }

        if (
          !node.value ||
          node.value.type !== 'Literal' ||
          typeof node.value.value !== 'string'
        ) {
          return
        }

        const classNameValue = node.value.value
        const utilityCount = countTailwindUtilities(classNameValue)

        if (utilityCount > maxUtilities) {
          context.report({
            node,
            message: `className contains ${utilityCount} utilities, exceeds maximum of ${maxUtilities}. Consider using a primitive or extracting to a reusable component.`,
            data: {
              count: utilityCount,
              max: maxUtilities,
            },
          })
        }
      },
    }
  },
}
