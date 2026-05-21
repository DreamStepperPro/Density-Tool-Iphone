import re

with open('index.html', 'r') as f:
    content = f.read()

# Wait, `index.html` was reverted? Oh, maybe my earlier scripts weren't tracked because I reverted from git?
# Let's fix the #profilerModal structure explicitly to match the prompt's overlay instructions exactly.
# It currently has: <div class="modal-overlay" id="profilerModal" style="display:none; z-index:250;">
# I will make it: <div class="modal-overlay" id="profilerModal" style="display:none; align-items:center; justify-content:center; z-index:250;">

content = content.replace('<div class="modal-overlay" id="profilerModal" style="display:none; z-index:250;">', '<div class="modal-overlay" id="profilerModal" style="display:none; align-items:center; justify-content:center; z-index:250;">')

# And let's update the layout inside the modal as per plan step 2:
# "Modify index.html to update #profilerModal replacing the machine/lane target dropdowns with the Single/Dual toggle."
# Wait, the prompt says: "If the machine configuration is set to Quad Lane, include a clear toggle element at the top: Single Lane Check vs Dual Check (Combined Pair)."
# I will just replace the modal options entirely with a container for the toggle.

old_opts = """        <div class="modal-opt">
            <label for="profilerMachine">Machine</label>
            <select id="profilerMachine">
                <option value="M1">M1</option>
                <option value="M2">M2</option>
            </select>
        </div>
        <div class="modal-opt">
            <label for="profilerConfig">Configuration</label>
            <select id="profilerConfig">
                <option value="dual">Dual 1-2</option>
                <option value="quad">Quad 1-4</option>
                <option value="paired">Paired Quad 1+2 / 3+4</option>
            </select>
        </div>"""

new_opts = """        <div class="modal-opt" id="profilerToggleContainer" style="display:none;">
            <label for="profilerConfig">Mode</label>
            <select id="profilerConfig">
                <option value="single">Single Lane Check</option>
                <option value="dual">Dual Check (Combined Pair)</option>
            </select>
        </div>"""

content = content.replace(old_opts, new_opts)

# Remove the PROFILER button from `#machineNav` if it exists. But wait, `index.html` might have been reverted so it's already just `<div class="machine-nav" id="machineNav"></div>`
with open('index.html', 'w') as f:
    f.write(content)
