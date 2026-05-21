with open('app.js', 'r') as f:
    content = f.read()

# Let's restore the focus gate from the previous task, because I must have accidentally reverted it if it's not there.
dEl_block_old = """        const dEl = document.getElementById(`currDens-${i}`);
        if (dEl && document.activeElement !== dEl) {"""
dEl_block_new = """        const dEl = document.getElementById(`currDens-${i}`);
        if (dEl && document.activeElement === dEl) {
            continue;
        }
        if (dEl) {"""

wEl_block_old = """        const wEl = document.getElementById(`avgWt-${i}`);
        if (wEl && document.activeElement !== wEl) {"""
wEl_block_new = """        const wEl = document.getElementById(`avgWt-${i}`);
        if (wEl && document.activeElement === wEl) {
            continue;
        }
        if (wEl) {"""

content = content.replace(dEl_block_old, dEl_block_new)
content = content.replace(wEl_block_old, wEl_block_new)

with open('app.js', 'w') as f:
    f.write(content)
