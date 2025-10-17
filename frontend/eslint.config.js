import js from '@eslint/js'
import tseslint from 'typescript-eslint'

const MAX_TAILWIND_UTILITIES = 5

const tailwindClassLengthRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce maximum number of Tailwind utilities in className prop',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      tooManyUtilities:
        'className has {{count}} utility classes (max: {{max}}). Consider using a primitive from @/ui/primitives or creating a new one. See docs/STYLING_GUIDE.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: {
            type: 'integer',
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {}
    const maxUtilities = options.max || MAX_TAILWIND_UTILITIES

    function countTailwindUtilities(classNameValue) {
      if (!classNameValue || typeof classNameValue !== 'string') {
        return 0
      }

      const classes = classNameValue.trim().split(/\s+/).filter(Boolean)

      return classes.filter((cls) => {
        const isTemplateLiteral = cls.includes('${')
        const isCVACall = cls.includes('(')
        const isCnCall = cls === 'cn'

        return !isTemplateLiteral && !isCVACall && !isCnCall
      }).length
    }

    function checkJSXAttribute(node) {
      if (
        node.name &&
        node.name.name === 'className' &&
        node.value &&
        node.value.type === 'Literal'
      ) {
        const classNameValue = node.value.value
        const utilityCount = countTailwindUtilities(classNameValue)

        if (utilityCount > maxUtilities) {
          context.report({
            node: node.value,
            messageId: 'tooManyUtilities',
            data: {
              count: utilityCount,
              max: maxUtilities,
            },
          })
        }
      }
    }

    return {
      JSXAttribute: checkJSXAttribute,
    }
  },
}

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'build/**', '*.config.js'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'custom-rules': {
        rules: {
          'max-tailwind-utilities': tailwindClassLengthRule,
        },
      },
    },
    rules: {
      'custom-rules/max-tailwind-utilities': [
        'warn',
        { max: MAX_TAILWIND_UTILITIES },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
)
