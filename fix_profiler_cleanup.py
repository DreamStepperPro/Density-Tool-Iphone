with open('profiler.js', 'r') as f:
    content = f.read()

# We can remove window.updateProfilerLanes because we aren't using the secondary dropdown anymore (removed in index.html)
import re
content = re.sub(r'window\.updateProfilerLanes = function\(\) \{.*?\n\};\n', '', content, flags=re.DOTALL)

with open('profiler.js', 'w') as f:
    f.write(content)
