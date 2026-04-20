import re

with open('app.js', 'r') as f:
    content = f.read()

# Replace calculateLocal end correctly
end_str = """    } else { document.getElementById('machAvg').innerText = "--"; document.getElementById('stdDev').innerText = "--"; }
"""
replacement = """    } else { document.getElementById('machAvg').innerText = "--"; document.getElementById('stdDev').innerText = "--"; }

    if (typeof window.generateCopilotActions === 'function') {
        window.generateCopilotActions();
    }
"""

if end_str in content:
    content = content.replace(end_str, replacement)
else:
    print("Not found")

with open('app.js', 'w') as f:
    f.write(content)
