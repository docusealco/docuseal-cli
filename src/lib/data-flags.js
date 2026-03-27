import { parse } from 'qs'

export function parseDataFlags(pairs) {
  return parse(pairs.join('&'), { depth: 10 })
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
