// Generates src/api/schema.d.ts from the live OpenAPI doc.
// openapi-typescript widens integer fields (esp. int64) to `number | string` for big-int safety.
// Our ids are well within JS safe-integer range, so we collapse that back to `number` for
// ergonomics. `number | string` only arises from this integer widening in our doc, so the
// replacement is safe.
import fs from 'node:fs'
import openapiTS, { astToString } from 'openapi-typescript'

const target = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:5239'

const ast = await openapiTS(new URL('/openapi/v1.json', target))
const out = astToString(ast).replaceAll('number | string', 'number')

fs.writeFileSync(new URL('../src/api/schema.d.ts', import.meta.url), out)
console.log('✓ src/api/schema.d.ts')
