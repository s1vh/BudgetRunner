// eslint-disable-next-line no-control-regex -- canonicalization deliberately removes control and format characters.
const hiddenCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/gu
const numericEntity = /&#(?:x([0-9a-f]+)|(\d+));?/giu
const versionedComment = /\/\*![0-9]*([\s\S]*?)\*\//gu
const blockComment = /\/\*[\s\S]*?\*\//gu
const quotedConcatenation = /(['"`])\s*(?:\|\||\+)\s*\1/gu
const sqlVerb = '(?:select|insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|copy|call|execute|exec|prepare|do|vacuum|analyze)'
const suspiciousPatterns = [
  new RegExp(`^\\s*${sqlVerb}\\b`, 'u'),
  new RegExp(`;\\s*${sqlVerb}\\b`, 'u'),
  /^\s*with\s+[a-z_$][\w$]*\s+as\s*\(/u,
  /^\s*(?:show\s+[a-z_$]|set\s+[a-z_$][\w$]*\s*(?:=|to\b)|reset\s+[a-z_$]|values\s*\(|table\s+[a-z_$])/u,
  /\bunion\s*(?:all\s+)?select\b/u,
  /(?:['"`)]\s*)(?:or|and)\s+(?:\d+\s*=\s*\d+|['"][^'"]*['"]\s*=\s*['"][^'"]*['"]|true\b|false\b)/u,
  /\b(?:or|and)\s+\d+\s*=\s*\d+\s*(?:--|#|\/\*)/u,
  /\b(?:or|and)\s+(?:\d+\s*=\s*\d+|['"][^'"]*['"]\s*=\s*['"][^'"]*['"]|true\b|false\b)(?:\s|$)/u,
  /(?:['"`;)]\s*)(?:--|#|\/\*)/u,
  /\b(?:pg_sleep|sleep|benchmark)\s*\(/u,
  /\bwaitfor\s+delay\b/u,
  /\b(?:information_schema|pg_catalog|sqlite_master|sysobjects|syscolumns)\b/u,
  /\b(?:current_database|current_schema|version|current_user|session_user)\s*\(?/u,
  /\b(?:xp_cmdshell|load_file|into\s+outfile)\b/u,
  /\b(?:chr|char|nchar|ascii|unicode)\s*\(\s*\d+/u,
  /\b(?:decode|unhex|convert_from)\s*\(/u,
]

function decodeNumericEntity(match: string, hexadecimal: string | undefined, decimal: string | undefined) {
  const value = Number.parseInt(hexadecimal ?? decimal ?? '', hexadecimal ? 16 : 10)
  return Number.isSafeInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match
}

function decodePercentEncoding(value: string) {
  let decoded = value
  for (let pass = 0; pass < 2 && /%[0-9a-f]{2}/iu.test(decoded); pass += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      break
    }
  }
  return decoded
}

function normalizedUntrustedText(value: string) {
  return decodePercentEncoding(value)
    .replace(numericEntity, decodeNumericEntity)
    .replace(/&(apos|#39);?/giu, "'")
    .replace(/&(quot|#34);?/giu, '"')
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u2033]/gu, '"')
    .replace(/[\u2010-\u2015\u2212]/gu, '-')
    .replace(hiddenCharacters, '')
    .toLocaleLowerCase('en-US')
    .replace(versionedComment, '$1')
}

function finishCanonicalText(value: string) {
  return value.replace(quotedConcatenation, '').replace(/\s+/gu, ' ').trim()
}

export function containsQueryShapedText(value: string) {
  if (value.length === 0) return false
  const normalized = normalizedUntrustedText(value)
  const containsSqlComments = decodePercentEncoding(value).includes('/*')
  const variants = [
    finishCanonicalText(normalized.replace(blockComment, '')),
    finishCanonicalText(normalized.replace(blockComment, ' ')),
  ]
  return variants.some((canonical, index) => {
    const withoutQuotes = canonical.replace(/['"`]/gu, '')
    if (containsSqlComments && index === 0) {
      const commentObfuscatedStatement = new RegExp(`(?:^|;)\\s*${sqlVerb}`, 'u')
      if (commentObfuscatedStatement.test(canonical) || commentObfuscatedStatement.test(withoutQuotes)) return true
    }
    return suspiciousPatterns.some((pattern) => pattern.test(canonical) || pattern.test(withoutQuotes))
  })
}

export function containsQueryShapedValue(value: unknown): boolean {
  if (typeof value === 'string') return containsQueryShapedText(value)
  if (Array.isArray(value)) return value.some(containsQueryShapedValue)
  if (!value || typeof value !== 'object') return false
  return Object.values(value as Record<string, unknown>).some(containsQueryShapedValue)
}
