const noIifeInJsxRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow IIFE calls inside JSX expression containers.',
      recommended: false,
    },
    schema: [],
    messages: {
      avoidIifeInJsx:
        'Avoid IIFE inside JSX. Precompute values before return, use createMemo, or extract a pure function.',
    },
  },
  create(context) {
    const reportIife = (node) => {
      context.report({
        node,
        messageId: 'avoidIifeInJsx',
      })
    }

    return {
      'JSXExpressionContainer CallExpression[callee.type="ArrowFunctionExpression"]': reportIife,
      'JSXExpressionContainer CallExpression[callee.type="FunctionExpression"]': reportIife,
    }
  },
}

export const rules = {
  'no-iife-in-jsx': noIifeInJsxRule,
}

export const containerTrackerEslintPlugin = {
  meta: {
    name: 'container-tracker',
  },
  rules,
}
