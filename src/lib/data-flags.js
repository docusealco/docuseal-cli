import { parse } from 'qs'
import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'

export function parseDataFlags(pairs) {
  return resolveFiles(parse(pairs.join('&'), { depth: 10 }))
}

function resolveFiles(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(item => resolveFiles(item))
  } else if (obj && typeof obj === 'object') {
    if (typeof obj.file === 'string' && !/^https?:\/\//.test(obj.file) && existsSync(obj.file)) {
      const content = readFileSync(obj.file)
      const base64 = Buffer.from(content).toString('base64')
      const name = basename(obj.file)
      obj.name = obj.name || name
      obj.file = `data:application/octet-stream;base64,${base64}`
    }

    for (const val of Object.values(obj)) {
      resolveFiles(val)
    }
  }

  return obj
}

export function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      for (let i = 0; i < source[key].length; i++) {
        if (source[key][i] !== undefined) {
          if (typeof source[key][i] === 'object' && typeof target[key][i] === 'object') {
            target[key][i] = deepMerge(target[key][i], source[key][i])
          } else {
            target[key][i] = source[key][i]
          }
        }
      }
    } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
               target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      target[key] = deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}
