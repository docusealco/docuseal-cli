import { writeFileSync } from 'fs'

const res = await fetch('https://console.docuseal.com/openapi.json')
const spec = await res.json()

const code = 'export default ' + JSON.stringify(spec, null, 2) + '\n'

writeFileSync('openapi-spec.js', code)
console.log('✓ Saved openapi-spec.js')

const paths = Object.keys(spec.paths)
console.log(`  Found ${paths.length} paths:`)
paths.forEach((p) => console.log(`  ${p}`))
