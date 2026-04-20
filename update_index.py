import re

with open('index.html', 'r') as f:
    content = f.read()

# Add Copilot Setting
settings_addition = """        <div class="modal-opt" id="copilotSettingContainer" style="display:none;">
            <label for="setCopilot">Beta: AI Copilot</label>
            <input type="checkbox" id="setCopilot" onchange="window.saveLocalSettings()" style="width:24px; height:24px;">
        </div>"""

content = re.sub(r'(<div class="modal-opt">\s*<label data-i18n="theme" for="setTheme">Theme</label>\s*<select id="setTheme".*?</select>\s*</div>)', r'\1\n' + settings_addition, content, flags=re.DOTALL)

# Add copilotQueue before lanesContainer
queue_addition = """    <div id="copilotQueue" style="display:none; position:sticky; top:60px; z-index:100; margin:10px; display:flex; flex-direction:column; gap:8px;"></div>"""

content = content.replace('<div id="lanesContainer"></div>', queue_addition + '\n    <div id="lanesContainer"></div>')

with open('index.html', 'w') as f:
    f.write(content)
