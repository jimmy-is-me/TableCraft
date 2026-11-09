"""Apply the reviewed, idempotent TableCraft upgrade; only index.html is changed."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MARKER = '<!-- TableCraft neutral-demo upgrade v2 -->'

def apply(source, features):
    if MARKER in source:
        return source
    def replace(old, new, count=1):
        nonlocal source
        if source.count(old) != count:
            raise ValueError('Source drift: expected anchor count %s: %s' % (count, old[:90]))
        source = source.replace(old, new)
    start = source.index('  function createDemoProject() {')
    end = source.index('  /* =========================================================', start)
    source = source[:start] + "  function createDemoProject() {\n    const rows = [\n      ['活動名稱', '日期', '地點', '名額', '開放報名', '備註'],\n      ['城市攝影散步', '2026-12-05', '河畔公園', '20', '是', '自備相機或手機'],\n      ['植物觀察工作坊', '2026-12-12', '社區花園', '16', '是', '適合初學者'],\n      ['手作書籤體驗', '2026-12-19', '文化空間', '24', '否', '材料由主辦單位準備']\n    ];\n    return {\n      id: 'proj_' + generateStableId('demo'), tableUid: generateStableId('wmt-tc'),\n      name: '社區活動行事曆', headerMode: 'firstRow', rowHeaderScope: true, rows,\n      columns: rows[0].map((_,i)=>createDefaultColumnMeta(i,\n        i===1?{type:'date'}:i===3?{type:'number'}:i===4?{type:'status'}:i===5?{rwdPriority:'secondary'}:{})),\n      style: Object.assign({}, STYLE_PRESETS.business, {\n        preset:'business',fontFamily:'sans',fontSize:15,lineHeight:'1.6',textWrap:'wrap',\n        tableWidth:'100%',cellPadding:'12px 16px',rwdMode:'scroll',rwdBreakpoint:640,rwdMinWidth:580,\n        caption:'社區活動行事曆',summary:'虛構活動資料，僅供表格功能展示',\n        footnote:'* 本表為虛構範例，非實際活動公告。',emptyCellMode:'dash',emptyCellCustom:'無',statusSvgIcon:true\n      }),\n      exportConfig:{mode:'wp',csvFormulaSafe:true,interSearch:true,interSort:true,interPage:true,interPageSize:10}\n    };\n  }\n\n" + source[end:]
    source, n = re.subn(r'(<textarea id="importRawTextarea"[^>]*placeholder=")[^"]*(")', r'\1在此貼上 Excel 或 Google 試算表內容，例如活動名稱、日期、地點及名額。\2', source)
    if n != 1:
        raise ValueError('Import placeholder anchor mismatch')
    source = re.sub(r'(id="tableCaptionInput"[^>]*placeholder=")[^"]*', r'\1例如：社區活動行事曆', source)
    source = re.sub(r'(id="tableFootnoteInput"[^>]*placeholder=")[^"]*', r'\1例如：* 本表資料僅供展示。', source)
    replace("if (parsed.length <= 1 && parsed[0].length <= 1)", "if (!parsed.length || (parsed.length <= 1 && parsed[0].length <= 1))")
    replace('          App.projects = parsed.projects;', '          App.projects = parsed.projects.map(normalizeProject);')
    replace('          // Sanitize structure', '          Object.assign(parsed, normalizeProject(parsed));\n          // Sanitize structure')
    replace("parsed.tableUid = parsed.tableUid && /^wmt-tc-[a-z0-9]+$/.test(parsed.tableUid) ? parsed.tableUid : generateStableId('wmt-tc');", "parsed.tableUid = generateStableId('wmt-tc');")
    replace('    // Project selector & name', '    if (App.historyProjectId !== proj.id) {\n      App.historyProjectId = proj.id;\n      App.history = []; App.historyIndex = -1;\n      App.gridPage = 0; App.activeRowIdx = 0; App.activeColIdx = 0;\n      pushHistory();\n    }\n    // Project selector & name')
    replace('const dec = parseInt(colMeta.decimals || 0, 10);', 'const dec = Math.max(0, Math.min(20, parseInt(colMeta.decimals, 10) || 0));', 3)
    replace("      if (m) {\n        const y = m[1];", "      if (m && Number(m[2])>=1 && Number(m[2])<=12 && Number(m[3])>=1 && Number(m[3])<=new Date(Number(m[1]),Number(m[2]),0).getDate()) {\n        const y = m[1];")
    replace("  var allRows = Array.prototype.slice.call(tbody.querySelectorAll('tr:not(.tc-priority-drawer-row)'));", "  var allRows = Array.prototype.slice.call(tbody.querySelectorAll('tr:not(.tc-priority-drawer-row)'));\n  var drawers = new Map();\n  allRows.forEach(function(r){var next=r.nextElementSibling;if(next&&next.classList.contains('tc-priority-drawer-row'))drawers.set(r,next);});")
    replace("    allRows.forEach(function(r){ r.style.display = 'none'; });", "    allRows.forEach(function(r){r.style.display='none';if(drawers.has(r))drawers.get(r).style.display='none';});")
    replace('      tbody.appendChild(r);', "      tbody.appendChild(r);\n      if(drawers.has(r)){var drawer=drawers.get(r);drawer.style.display='';tbody.appendChild(drawer);}")
    replace('return !q || r.textContent.toLowerCase().indexOf(q) !== -1;', "return !q || (r.textContent+(drawers.has(r)?drawers.get(r).textContent:'')).toLowerCase().indexOf(q)!==-1;")
    # Real viewport isolation rather than changing only a div's CSS width.
    replace('<style id="previewScopedStyle"></style>\n        <div id="previewTableMount"></div>', '<iframe id="tablePreviewFrame" title="表格即時預覽" sandbox="allow-same-origin allow-modals" style="display:block;width:100%;height:440px;border:0;background:white;"></iframe>')
    start = source.index('    const styleMount =', source.index('  function renderPreviewAndCode()'))
    end = source.index('    // Update Code Box', start)
    source = source[:start] + '    const frame = document.getElementById(\'tablePreviewFrame\');\n    const css = generateScopedCss(proj);\n    const html = generateTableHtml(proj, {inlineMode:false,interactiveMode:false});\n    frame.srcdoc = \'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:12px;}\'+css+\'</style></head><body>\'+html+\'</body></html>\';\n\n' + source[end:]
    replace('      window.print();', "      const frame=document.getElementById('tablePreviewFrame');\n      if(frame.contentWindow){frame.contentWindow.focus();frame.contentWindow.print();}")
    css = '\n/* TableCraft upgrade: sticky offset, constrained panels, separate mobile views. */\nhtml,body { overflow-x:clip; }\n.app-header { height:auto;min-height:56px;flex-wrap:wrap;padding-block:8px; }\n.brand-group,.project-bar,.header-actions { flex-wrap:wrap; }\n.mobile-tabs { top:var(--header-h,56px); }\n.panel { min-width:0; }\n.preview-viewport { flex-shrink:0;padding:0; }\n@media(max-width:860px) {\n .workspace[data-mobile-view="preview"] .export-panel-card { display:none; }\n .workspace[data-mobile-view="export"] .preview-toolbar,\n .workspace[data-mobile-view="export"] .preview-stage-outer { display:none; }\n}\n'
    source = source.replace('</style>', css + '</style>', 1)
    replace('  function init() {', features + '\n  function init() {')
    replace('    bindEvents();\n    renderAll();', '    bindEvents();\n    bindUpgradeFeatures();\n    renderAll();')
    source = source.replace('</head>', MARKER + '\n</head>', 1)
    return source

if __name__ == '__main__':
    path = ROOT / 'index.html'
    result = apply(path.read_text(encoding='utf-8'), (ROOT/'scripts/features.js').read_text(encoding='utf-8'))
    path.write_text(result, encoding='utf-8')
