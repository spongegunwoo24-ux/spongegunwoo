#!/usr/bin/env python3
"""모듈들을 한 파일로 합쳐 더블클릭으로 열리는 emoji-defense.html 을 만든다."""
import re, pathlib
root = pathlib.Path(__file__).parent
js = ''
for name in ['data', 'engine', 'bot', 'main']:
    src = (root / 'js' / f'{name}.js').read_text(encoding='utf-8')
    src = re.sub(r'^import .*?;\n', '', src, flags=re.M)
    src = re.sub(r'^export ', '', src, flags=re.M)
    js += f'\n// ===== {name}.js =====\n{src}'
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css' / 'style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>\n{css}</style>')
html = html.replace('<script type="module" src="js/main.js"></script>', f'<script>\n(() => {{\n{js}\n}})();\n</script>')
(root / 'emoji-defense.html').write_text(html, encoding='utf-8')
print('emoji-defense.html', len(html), 'bytes')
