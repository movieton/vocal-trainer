"""Собирает app/src/data/library.json из research/catalog-*.md.
Отсеивает карточки, чей источник подтверждён только выдачей поиска или не проверен."""
import json, re, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
FILES = {'breath': 'catalog-breath.md', 'vocal': 'catalog-vocal.md', 'diction': 'catalog-diction.md'}
UNVERIFIED = re.compile(r'выдач[аи] поиска|не провер|WebSearch|найдено поиском', re.I)
SOURCES = {}

def steps(s):
    parts = re.split(r'\s*\d+\)\s*', s)
    return [p.strip().rstrip(';').rstrip('.') + '.' for p in parts if p.strip()] or [s]

def items(s):
    return [x.strip().rstrip('.') + '.' for x in re.split(r';\s*', s) if x.strip()]

def notes(src):
    # "~X:d" — глиссандо от предыдущей высоты до X
    out, last = [], 0
    for tok in src.split():
        body, _, dur = tok.partition(':')
        d = f':{dur}' if dur else ''
        if body.startswith('~'):
            out.append(f'{last}~{body[1:]}{d}'); last = int(body[1:])
        else:
            out.append(tok)
            if body != 'r': last = int(body.rstrip('.').split('~')[-1])
    return ' '.join(out)

lib, dropped = [], []
for kind, fn in FILES.items():
    text = (R / 'research' / fn).read_text()
    for m in re.finditer(r'^- (S\d+) .*?(https?://\S+)', text, re.M):
        SOURCES[m.group(1)] = m.group(2)
    text = re.split(r'^## (?:Отброшено|Пробелы)', text, flags=re.M)[0]
    group = ''
    for block in re.split(r'^(?=## |### )', text, flags=re.M):
        if block.startswith('## '):
            group = block[3:].split('\n')[0].strip(); continue
        if not block.startswith('### '): continue
        head, *lines = block.strip().split('\n')
        mm = re.match(r'### (\S+) — (.+)', head)
        if not mm: continue
        f = {}
        for ln in lines:
            m2 = re.match(r'- ([^:]+): (.*)', ln)
            if m2: f[m2.group(1).strip()] = m2.group(2).strip()
        src = f.get('Источник', '')
        if UNVERIFIED.search(src) or UNVERIFIED.search(block):
            dropped.append(mm.group(1)); continue
        src = re.sub(r'\bS\d+\b', lambda x: SOURCES.get(x.group(0), x.group(0)), src)
        urls = [u.rstrip('.') for u in re.findall(r'https?://[^\s;,)]+', src)]
        lvl_ev = f.get('Уровень 1 · Доказательность') or ''
        ev_line = next((ln for ln in lines if 'Доказательность' in ln), '')
        ev = re.search(r'Доказательность: ([ИШПТ])', ev_line)
        lvl = re.search(r'Уровень (\d)', ev_line)
        it = {
            'id': mm.group(1), 'title': mm.group(2).strip(), 'kind': kind,
            'cat': (f.get('Категория') or f.get('Раздел') or group).split('/')[0].strip().lower(),
            'goal': f.get('Цель', ''), 'how': steps(f.get('Как делать', '')),
            'mistakes': items(f.get('Ошибки', '')) if f.get('Ошибки') else [],
            'dose': f.get('Длительность/повторы') or f.get('Повторы') or '',
            'evidence': ev.group(1) if ev else 'П', 'level': int(lvl.group(1)) if lvl else 1,
            'source': re.sub(r'https?://\S+', '', src).strip(' —–;,.') , 'urls': urls,
            'illustration': f.get('Иллюстрация', ''),
        }
        if 'Ноты' in f:
            n = f['Ноты']
            q = re.search(r'"([^"]+)"', n); b = re.search(r'(\d+)\s*bpm', n); s = re.search(r'«([^»]+)»', n)
            if q: it['notes'] = notes(q.group(1)); it['bpm'] = int(b.group(1)) if b else 70; it['syllable'] = s.group(1) if s else 'а'
            if '→' in n or 'жен' in n: it['notesHint'] = n.split('bpm', 1)[-1].strip(' ,;')
        lib.append(it)

cap = lambda t: t[:1].upper() + t[1:] if t else t
for it in lib:
    for k in ('goal', 'source', 'dose', 'illustration'): it[k] = cap(it[k])
    it['how'] = [cap(x) for x in it['how']]; it['mistakes'] = [cap(x) for x in it['mistakes']]
(R / 'app/src/data/library.json').write_text(json.dumps(lib, ensure_ascii=False, indent=1))
print(len(lib), 'items; dropped:', dropped)
