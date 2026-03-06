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

const jsxShortCircuitWrapperTypes = new Set([
  'ParenthesizedExpression',
  'TSNonNullExpression',
  'TSAsExpression',
  'TSTypeAssertion',
  'TSSatisfiesExpression',
])

function unwrapJsxShortCircuitNode(node) {
  let currentNode = node

  while (currentNode && jsxShortCircuitWrapperTypes.has(currentNode.type)) {
    if (currentNode.type === 'ParenthesizedExpression') {
      currentNode = currentNode.expression
      continue
    }

    if (currentNode.type === 'TSNonNullExpression') {
      currentNode = currentNode.expression
      continue
    }

    if (currentNode.type === 'TSAsExpression') {
      currentNode = currentNode.expression
      continue
    }

    if (currentNode.type === 'TSTypeAssertion') {
      currentNode = currentNode.expression
      continue
    }

    if (currentNode.type === 'TSSatisfiesExpression') {
      currentNode = currentNode.expression
    }
  }

  return currentNode
}

function containsExplicitJsx(node) {
  const unwrappedNode = unwrapJsxShortCircuitNode(node)
  if (!unwrappedNode) {
    return false
  }

  if (unwrappedNode.type === 'JSXElement' || unwrappedNode.type === 'JSXFragment') {
    return true
  }

  if (unwrappedNode.type === 'ConditionalExpression') {
    return (
      containsExplicitJsx(unwrappedNode.consequent) || containsExplicitJsx(unwrappedNode.alternate)
    )
  }

  if (unwrappedNode.type === 'LogicalExpression' && unwrappedNode.operator === '&&') {
    return containsExplicitJsx(unwrappedNode.right)
  }

  return false
}

const noJsxShortCircuitRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow short-circuit JSX rendering with cond && <JSX />.',
      recommended: false,
    },
    schema: [],
    messages: {
      avoidJsxShortCircuit:
        'Do not use cond && <JSX /> for conditional rendering. Use <Show when={cond}>...</Show> instead.',
    },
  },
  create(context) {
    return {
      JSXExpressionContainer(node) {
        const { expression } = node
        if (!expression || expression.type !== 'LogicalExpression') {
          return
        }

        if (expression.operator !== '&&') {
          return
        }

        if (!containsExplicitJsx(expression.right)) {
          return
        }

        context.report({
          node: expression,
          messageId: 'avoidJsxShortCircuit',
        })
      },
    }
  },
}

const noJsxTernaryRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow JSX ternary rendering with cond ? <A /> : <B />.',
      recommended: false,
    },
    schema: [],
    messages: {
      avoidJsxTernary:
        'Do not use JSX ternary for conditional rendering. Use <Show when={cond}>...</Show> instead.',
    },
  },
  create(context) {
    return {
      JSXExpressionContainer(node) {
        const { expression } = node
        if (!expression || expression.type !== 'ConditionalExpression') {
          return
        }

        if (
          !containsExplicitJsx(expression.consequent) &&
          !containsExplicitJsx(expression.alternate)
        ) {
          return
        }

        context.report({
          node: expression,
          messageId: 'avoidJsxTernary',
        })
      },
    }
  },
}

export const rules = {
  'no-iife-in-jsx': noIifeInJsxRule,
  'no-jsx-short-circuit': noJsxShortCircuitRule,
  'no-jsx-ternary': noJsxTernaryRule,
}

export const containerTrackerEslintPlugin = {
  meta: {
    name: 'container-tracker',
  },
  rules,
}
