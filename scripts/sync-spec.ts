import { writeFileSync } from 'fs'
import { parse } from 'yaml'

const res = await fetch('https://console.docuseal.com/openapi.yml')
const text = await res.text()

const spec = parse(text)

writeFileSync('openapi-spec.json', JSON.stringify(spec, null, 2))
console.log('✓ Saved openapi-spec.json')

const paths = Object.keys(spec.paths)
console.log(`  Found ${paths.length} paths:`)
paths.forEach((p: string) => console.log(`  ${p}`))
