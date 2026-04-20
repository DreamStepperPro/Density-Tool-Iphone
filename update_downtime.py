import re

with open('downtime.js', 'r') as f:
    content = f.read()

# Add window.getCurrentActiveDowntimes = () => currentActiveDowntimes;
if "window.getCurrentActiveDowntimes" not in content:
    content = content.replace("let currentActiveDowntimes = {};", "let currentActiveDowntimes = {};\nwindow.getCurrentActiveDowntimes = () => currentActiveDowntimes;")
    with open('downtime.js', 'w') as f:
        f.write(content)
