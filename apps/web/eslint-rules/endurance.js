/**
 * Project rules for the mistakes that actually keep recurring here.
 *
 * Each of these was found twice by review — once, fixed, then reintroduced in a component written
 * the same day. A rule that lives only in DESIGN.md is a rule that depends on whoever writes the
 * next component having read it. These fire at write time instead.
 *
 * Deliberately narrow. Each one targets the specific shape of the real defect and accepts that it
 * will miss creative variants; a rule that flags honest code gets disabled, and a disabled rule
 * catches nothing.
 */

const classNameOf = (node) =>
  node.attributes?.find((a) => a.type === 'JSXAttribute' && a.name?.name === 'className')

/** Literal class string from `className="..."` or `className={\`...\`}`, else null when dynamic. */
function staticClasses(attr) {
  if (!attr?.value) return null
  if (attr.value.type === 'Literal') return String(attr.value.value)
  if (attr.value.type === 'JSXExpressionContainer') {
    const e = attr.value.expression
    if (e.type === 'Literal') return String(e.value)
    if (e.type === 'TemplateLiteral') return e.quasis.map((q) => q.value.cooked).join(' ')
  }
  return null
}

const hasAttr = (node, name) =>
  node.attributes?.some((a) => a.type === 'JSXAttribute' && a.name?.name === name)

const INTERACTIVE = new Set(['button', 'a'])

export const rules = {
  /**
   * `uppercase` on an element whose text comes from data.
   *
   * DESIGN.md scopes the all-caps Title style to short labels — nav links, buttons, table headers.
   * Applied to data it produces things like `PORSCHE CARRERA CUP NORTH AMERICA`, 33 characters of
   * caps in the control an operator reads most. Found on the context selects, fixed, then written
   * again into the championship band hours later.
   *
   * A literal child ("Save", "Overview") is a label and is fine; a JSX expression is data.
   */
  'no-uppercase-data': {
    meta: {
      type: 'problem',
      docs: { description: 'Do not apply `uppercase` to text interpolated from data.' },
      schema: [],
      messages: {
        uppercaseData:
          'This element renders interpolated data with `uppercase`. DESIGN.md scopes all-caps to short labels; proper nouns and counts are not labels.',
      },
    },
    create(context) {
      // Narrowed to *entity names* rather than any interpolation. The broad version flagged 136
      // legitimate sites — short labels from props, status enums, counts — because "is this text
      // long enough to hurt in caps" is semantic, not syntactic. Property names are the one
      // syntactic signal that reliably marks the real thing: a championship, a circuit, a person.
      // Both real defects were name-shaped (`o.label` on the selects held championship names;
      // `row.championshipName` in the band), and both are caught here.
      const NAME_LIKE = /(^|\.)(name|fullName|teamName|circuit|championshipName)$/i
      const isEntityName = (expr) => {
        if (expr?.type === 'MemberExpression' && expr.property?.type === 'Identifier') {
          return NAME_LIKE.test(expr.property.name)
        }
        return false
      }
      return {
        JSXElement(node) {
          const classes = staticClasses(classNameOf(node.openingElement))
          if (!classes || !/\buppercase\b/.test(classes)) return
          const rendersName = node.children.some(
            (c) => c.type === 'JSXExpressionContainer' && isEntityName(c.expression),
          )
          if (rendersName) context.report({ node: node.openingElement, messageId: 'uppercaseData' })
        },
      }
    },
  },

  /**
   * An interactive element whose accessible name would be several element children concatenated.
   *
   * A `<button>` with four unlabelled spans announces as one run-on string — `"Road Americano
   * classes set"` — which is the failure DESIGN.md documents for leaderboard rows and solves with an
   * explicit name. `jsx-a11y` checks that a control has *content*, not that the content reads as a
   * sentence, so this gap is real and unguarded.
   */
  'multi-child-control-needs-label': {
    meta: {
      type: 'problem',
      docs: { description: 'Multi-element controls need an explicit accessible name.' },
      schema: [],
      messages: {
        needsLabel:
          'This <{{tag}}> builds its accessible name from {{count}} element children, which screen readers concatenate without separators. Add an explicit aria-label.',
      },
    },
    create(context) {
      return {
        JSXElement(node) {
          const open = node.openingElement
          const tag = open.name?.name
          if (!INTERACTIVE.has(tag)) return
          if (hasAttr(open, 'aria-label') || hasAttr(open, 'aria-labelledby')) return
          const elementChildren = node.children.filter((c) => c.type === 'JSXElement')
          if (elementChildren.length < 3) return
          context.report({
            node: open,
            messageId: 'needsLabel',
            data: { tag, count: elementChildren.length },
          })
        },
      }
    },
  },

  /**
   * Tailwind classes composed by template interpolation.
   *
   * Tailwind scans source text, so `w-${n}` generates no CSS and the element silently collapses.
   * DESIGN.md already documents this for the standings grid; it was written again into the band's
   * skeleton. Catches the interpolation directly rather than trying to know Tailwind's vocabulary.
   */
  'no-interpolated-tailwind': {
    meta: {
      type: 'problem',
      docs: { description: 'Tailwind utilities must be whole literal strings.' },
      schema: [],
      messages: {
        interpolated:
          'Tailwind scans source text, so `{{sample}}` generates no CSS and fails silently. Use whole literal class strings and switch between them.',
      },
    },
    create(context) {
      return {
        JSXAttribute(node) {
          if (node.name?.name !== 'className') return
          const e = node.value?.type === 'JSXExpressionContainer' ? node.value.expression : null
          if (e?.type !== 'TemplateLiteral') return
          for (let i = 0; i < e.expressions.length; i++) {
            const before = e.quasis[i]?.value.cooked ?? ''
            // An interpolation that continues a class token — `w-${n}` — rather than one that
            // supplies a whole class, which is the normal and correct `${base} ${variant}` pattern.
            if (/[\w[\]/.-]$/.test(before) && !/\s$/.test(before)) {
              context.report({
                node: e.expressions[i],
                messageId: 'interpolated',
                data: { sample: (before.split(/\s/).pop() || '') + '${…}' },
              })
            }
          }
        },
      }
    },
  },
}

export default { rules }
