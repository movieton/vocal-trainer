// Оборачивает русские строки в t(): строковые литералы, шаблоны и JSX-текст.
const ts = require('typescript'), fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '../src')
const CYR = /[А-Яа-яЁё]/
const SKIP_PROPS = new Set(['id', 'cat', 'kind', 'evidence', 'group', 'section', 'type', 'key'])
const SKIP_FILES = new Set(['lib/i18n.ts'])
const keys = new Set()
const files = []
;(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p) } })(ROOT)
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
for (const file of files) {
  const rel = path.relative(ROOT, file)
  if (SKIP_FILES.has(rel)) continue
  const src = fs.readFileSync(file, 'utf8')
  if (!CYR.test(src)) continue
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edits = []
  const skip = n => {
    const p = n.parent
    if (!p) return false
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p)) return true
    if (ts.isPropertyAssignment(p) && p.name === n) return true
    if (ts.isPropertyAssignment(p) && SKIP_PROPS.has(p.name.getText(sf))) return true
    if (ts.isBinaryExpression(p) && ['===', '!==', '==', '!='].includes(p.operatorToken.getText(sf))) return true
    if (ts.isCaseClause(p)) return true
    if (ts.isJsxAttribute(p) && ['e', 'key', 'to', 'className', 'id', 'type', 'hl'].includes(p.name.getText(sf))) return true
    if (ts.isElementAccessExpression(p) && p.argumentExpression === n) return true
    if (ts.isCallExpression(p) && /^(tr|console\.\w+)$/.test(p.expression.getText(sf))) return true
    return false
  }
  const visit = n => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && CYR.test(n.text) && n.text.length > 1 && !skip(n)) {
      keys.add(n.text)
      const call = `tr('${esc(n.text)}')`
      const inAttr = n.parent && ts.isJsxAttribute(n.parent)
      edits.push([n.getStart(sf), n.getEnd(), inAttr ? `{${call}}` : call]); return
    }
    if (ts.isTemplateExpression(n) && CYR.test(n.head.text + n.templateSpans.map(x => x.literal.text).join('')) && !skip(n)) {
      let k = n.head.text; const args = []
      n.templateSpans.forEach((s, i) => { k += `{${i}}` + s.literal.text; args.push(s.expression.getText(sf)) })
      keys.add(k)
      edits.push([n.getStart(sf), n.getEnd(), `tr('${esc(k)}', ${args.join(', ')})`]); return
    }
    if (ts.isJsxText(n) && CYR.test(n.text)) {
      const raw = n.getFullText(sf), m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/)
      const body = m[2].replace(/\s*\n\s*/g, ' ')
      keys.add(body)
      edits.push([n.getFullStart(), n.getEnd(), `${m[1]}{tr('${esc(body)}')}${m[3]}`]); return
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue
  let out = src
  for (const [a, b, r] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + r + out.slice(b)
  if (!/import \{ tr \} from/.test(out)) {
    let imp = path.relative(path.dirname(file), path.join(ROOT, 'lib/i18n')).replace(/\\/g, '/')
    if (!imp.startsWith('.')) imp = './' + imp
    out = `import { tr } from '${imp}'\n` + out
  }
  fs.writeFileSync(file, out)
  console.log(rel, edits.length)
}
const outKeys = path.join(__dirname, '../src/locales/keys.json')
fs.mkdirSync(path.dirname(outKeys), { recursive: true })
fs.writeFileSync(outKeys, JSON.stringify([...keys], null, 1))
console.log('keys', keys.size)
