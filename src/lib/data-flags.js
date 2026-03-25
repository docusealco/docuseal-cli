export function parseDataFlags(pairs) {
  const result = {}

  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue

    const rawKey = pair.slice(0, eqIdx)
    const value = pair.slice(eqIdx + 1)

    const segments = []
    const firstBracket = rawKey.indexOf('[')
    if (firstBracket === -1) {
      segments.push(rawKey)
    } else {
      segments.push(rawKey.slice(0, firstBracket))
      const rest = rawKey.slice(firstBracket)
      for (const m of rest.matchAll(/\[([^\]]*)\]/g)) {
        segments.push(m[1])
      }
    }

    let current = result
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]
      const nextSeg = segments[i + 1]
      const nextIsIndex = /^\d+$/.test(nextSeg) || nextSeg === ''

      if (current[seg] === undefined) {
        current[seg] = nextIsIndex ? [] : {}
      }
      current = current[seg]
    }

    const lastSeg = segments[segments.length - 1]
    if (lastSeg === '') {
      if (Array.isArray(current)) {
        current.push(value)
      }
    } else {
      current[lastSeg] = value
    }
  }

  return result
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
