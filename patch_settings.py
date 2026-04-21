import re

with open('app.js', 'r') as f:
    content = f.read()

# Add config.copilotEnabled
content = content.replace("currentMachine: 1, lang: 'en', inputMode: 'button', displayName: ''", "currentMachine: 1, lang: 'en', inputMode: 'button', displayName: '', copilotEnabled: false")

# Add toggleSettings logic
toggle_settings_add = """        if (document.getElementById('setTarget') && store.target) document.getElementById('setTarget').value = store.target;
        if (isAdmin) {
            document.getElementById('copilotSettingContainer').style.display = 'flex';
            if (document.getElementById('setCopilot')) document.getElementById('setCopilot').checked = config.copilotEnabled === true;
        } else {
            document.getElementById('copilotSettingContainer').style.display = 'none';
        }"""
content = content.replace("if (document.getElementById('setTarget') && store.target) document.getElementById('setTarget').value = store.target;", toggle_settings_add)

# Add saveLocalSettings logic
save_settings_add = """    if (document.getElementById('setTheme'))    config.theme      = document.getElementById('setTheme').value;
    if (document.getElementById('setCopilot') && isAdmin) config.copilotEnabled = document.getElementById('setCopilot').checked;"""
content = content.replace("if (document.getElementById('setTheme'))    config.theme      = document.getElementById('setTheme').value;", save_settings_add)

with open('app.js', 'w') as f:
    f.write(content)
