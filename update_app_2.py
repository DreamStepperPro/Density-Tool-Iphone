import re

with open('app.js', 'r') as f:
    content = f.read()

# 1. Modify `window.renderInterface()` to append `<button class="btn-icon" onclick="window.openLaneProfiler(${i})"...>🔍</button>` next to `btnDisable-${i}` for admins.
# "If isAdmin === true, append a diagnostic button labeled 🔍 right next to the existing ⊘ (Disable Lane) button in the card header."
# Currently: `let btnHtml = config.inputMode === 'button' && !isAdmin ? ... : ...;`
# But the disable button is here: `<button class="btn-icon" id="btnDisable-${i}" onclick="window.toggleLaneDisable(${i})" style="margin-left:8px; font-size:0.9rem; padding:0 5px;" aria-label="Toggle Lane Power" title="Toggle Lane Power">⊘</button>`
search_str = 'title="Toggle Lane Power">⊘</button>'
replace_str = 'title="Toggle Lane Power">⊘</button>${isAdmin ? `<button class="btn-icon" onclick="window.openLaneProfiler(${i})" style="margin-left:8px; font-size:0.9rem; padding:0 5px;" aria-label="Lane ${i} Diagnostics" title="Lane Diagnostics">🔍</button>` : ""}'

content = content.replace(search_str, replace_str)

# 2. Remove the tab-hide logic in `switchMachine()`.
# We added this earlier:
tab_logic = """    const pModal = document.getElementById('profilerModal');
    if (pModal) pModal.style.display = 'none';
    const lContainer = document.getElementById('lanesContainer');
    if (lContainer) lContainer.style.display = 'block';
    const hSection = document.querySelector('.history-section');
    if (hSection) hSection.style.display = 'block';
    const btn = document.getElementById('btnProfilerTab');
    if (btn) btn.classList.remove('m-active');"""

content = content.replace(tab_logic, "")

with open('app.js', 'w') as f:
    f.write(content)
