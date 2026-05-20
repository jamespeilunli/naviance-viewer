import re

html_path = 'ui/viewer.html'
js_path = 'ui/viewer.js'

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract script content
script_match = re.search(r'<script>(.*?)</script>', content, re.DOTALL)
if not script_match:
    print("Script tag not found")
    exit(1)

js_content = script_match.group(1).strip()

# Replace onclick attributes with ids in HTML
html_replacements = [
    (r'<button class="load-btn" onclick="document\.getElementById\(\'fileInput\'\)\.click\(\)">',
     '<button class="load-btn" id="btn-load-json">'),
    (r'<button class="load-btn" onclick="loadFromDB\(\)" style="background:var\(--purple\);">',
     '<button class="load-btn" id="btn-load-db" style="background:var(--purple);">'),
    (r'<button class="btn-ghost" onclick="showCompare\(\)">⊕ Compare View</button>',
     '<button class="btn-ghost" id="btn-dash-compare">⊕ Compare View</button>'),
    (r'<button class="btn-ghost" onclick="loadFromDB\(\)">↑ Load from DB</button>',
     '<button class="btn-ghost" id="btn-dash-load-db">↑ Load from DB</button>'),
    (r'<button class="btn-ghost" onclick="document\.getElementById\(\'fileInput\'\)\.click\(\)">↑ Load more files</button>',
     '<button class="btn-ghost" id="btn-dash-load-json">↑ Load more files</button>'),
    (r'<button class="back-btn" onclick="showDash\(\)">← Dashboard</button>',
     '<button class="back-btn" id="btn-school-dash">← Dashboard</button>', 1), # Only first one for school
    (r'<button class="btn-ghost" style="margin-left:auto;" onclick="showCompare\(\)">⊕ Compare View</button>',
     '<button class="btn-ghost" id="btn-school-compare" style="margin-left:auto;">⊕ Compare View</button>'),
]

new_html = content[:script_match.start()] + '<script src="viewer.js"></script>\n' + content[script_match.end():]

# We must replace the second back-btn for compare dash explicitly
new_html = re.sub(r'<button class="back-btn" onclick="showDash\(\)">← Dashboard</button>',
                  '<button class="back-btn" id="btn-compare-dash">← Dashboard</button>',
                  new_html) # Replace remaining ones

for rep in html_replacements:
    if len(rep) == 3:
        new_html = new_html.replace(rep[0], rep[1], rep[2])
    else:
        new_html = new_html.replace(rep[0], rep[1])

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html)

# Fix JS to remove inline onclick for showSchool and add event listeners
js_content = re.sub(
    r'onclick="showSchool\(\$\{r\.i\}\)" style="cursor:pointer"',
    r'data-idx="${r.i}" class="rate-row" style="cursor:pointer"',
    js_content
)
js_content = re.sub(
    r'onclick="showSchool\(\$\{r\.i\}\)"',
    r'',
    js_content
)

js_rate_bind = """
      wrap.querySelectorAll('.rate-row').forEach(el => {
        el.addEventListener('click', () => showSchool(parseInt(el.dataset.idx, 10)));
      });
"""
js_content = js_content.replace("    </div>`;\n    }", "    </div>`;" + js_rate_bind + "\n    }")

js_content += """
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-load-json')?.addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('btn-load-db')?.addEventListener('click', () => loadFromDB());
  document.getElementById('btn-dash-compare')?.addEventListener('click', () => showCompare());
  document.getElementById('btn-dash-load-db')?.addEventListener('click', () => loadFromDB());
  document.getElementById('btn-dash-load-json')?.addEventListener('click', () => document.getElementById('fileInput').click());
  
  // Both back buttons can be grabbed if there was only one, but we have two IDs now. Let's just bind both to showDash()
  document.querySelectorAll('#btn-school-dash, #btn-compare-dash, .back-btn').forEach(b => {
      b.addEventListener('click', () => showDash());
  });
  
  document.getElementById('btn-school-compare')?.addEventListener('click', () => showCompare());
});
"""

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Done")
