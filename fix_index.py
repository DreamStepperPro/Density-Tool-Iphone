import re

with open('index.html', 'r') as f:
    content = f.read()

# Modify #profilerModal
modal_old = '<div id="profilerModal" style="display:none; padding-bottom:90px;">'
modal_new = '<div id="profilerModal" class="modal-overlay" style="display:none; align-items:center; justify-content:center; z-index:250;">'

content = content.replace(modal_old, modal_new)

# Remove the PROFILER button from #machineNav
nav_old = """        <div class="machine-nav" style="display:flex; justify-content:space-between; gap:10px;">
        <div id="machineNav" style="display:flex; gap:10px;"></div>
        <button class="m-btn" id="btnProfilerTab" onclick="window.openProfiler()" style="white-space:nowrap;">🔍 PROFILER</button>
    </div>"""
nav_new = """    <div class="machine-nav" id="machineNav"></div>"""

content = content.replace(nav_old, nav_new)

with open('index.html', 'w') as f:
    f.write(content)
