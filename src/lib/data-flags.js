import { parse } from 'qs'
import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'

// Params whose keys are user-defined names (field names, metadata keys, template variables),
// so numeric keys like values[1] are names, not array indexes.
const MAP_KEYS = ['values', 'metadata', 'variables']

export function parseDataFlags(pairs) {
  const jsonPairs = pairs.filter(p => p.startsWith('{'))
  const qsPairs = pairs.filter(p => !p.startsWith('{')).map(encodePair)

  let result = qsPairs.length > 0 ? fixArrays(parse(qsPairs.join('&'), { depth: 10, arrayLimit: Infinity, allowSparse: true })) : {}

  for (const json of jsonPairs) {
    result = deepMerge(result, JSON.parse(json))
  }

  return resolveFiles(result)
}

function encodePair(pair) {
  const bracketEqualsPos = pair.indexOf(']=')
  const pos = bracketEqualsPos === -1 ? pair.indexOf('=') : bracketEqualsPos + 1

  if (pos === -1) return encodeURIComponent(pair)

  return encodeURIComponent(pair.slice(0, pos)) + '=' + encodeURIComponent(pair.slice(pos + 1))
}

// qs parses all-numeric keys as a (sparse) array. Turn those back into objects under MAP_KEYS
// (everything below a map is user data), and compact every other array as qs does by default.
function fixArrays(obj, key, inMap = false) {
  const isMap = !inMap && MAP_KEYS.includes(key)

  if (Array.isArray(obj) && !isMap) return obj.filter(() => true).map(item => fixArrays(item, undefined, inMap))

  if (obj && typeof obj === 'object') {
    const out = Array.isArray(obj) ? { ...obj } : obj

    for (const k of Object.keys(out)) out[k] = fixArrays(out[k], k, inMap || isMap)

    return out
  }

  return obj
}

function resolveFiles(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(item => resolveFiles(item))
  } else if (obj && typeof obj === 'object') {
    if (typeof obj.file === 'string' && !/^https?:\/\//.test(obj.file)) {
      if (existsSync(obj.file)) {
        obj.name = obj.name || basename(obj.file)
        obj.file = Buffer.from(readFileSync(obj.file)).toString('base64')
      } else if (/^\S+\.[A-Za-z0-9]{1,8}$/.test(obj.file)) {
        throw new Error(`File not found: ${obj.file}`)
      }
    }

    for (const val of Object.values(obj)) {
      resolveFiles(val)
    }
  }

  return obj
}

export function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
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
