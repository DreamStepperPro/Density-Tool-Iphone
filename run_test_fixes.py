import os

files_to_fix = ['app.test.js', 'calculateLocal.test.js', 'openAdmin.test.js', 'pushLaneToCloud.test.js', 'startCloudSync.test.js', 'comms.test.js', 'yield.test.js', 'supervisor.test.js', 'downtime.test.js', 'swapSeverity.test.js']

for f in files_to_fix:
    if os.path.exists(f):
        with open(f, 'r') as file:
            content = file.read()

        # Ensure initializeApp is exposed
        if "mock.module(\"https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js\", () => ({" in content:
            if "initializeApp:" not in content:
                content = content.replace('mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({', 'mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({\n    initializeApp: mock(() => ({})),')
        elif "mock.module('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js', () => ({" in content:
            if "initializeApp:" not in content:
                content = content.replace("mock.module('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js', () => ({", "mock.module('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js', () => ({\n    initializeApp: mock(() => ({})),")

        # Ensure query is exposed
        if "mock.module(\"https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js\", () => ({" in content:
            if "query:" not in content:
                 content = content.replace('mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({', 'mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({\n    query: mock(() => ({})),\n    orderByChild: mock(() => ({})),\n    equalTo: mock(() => ({})),')
        elif "mock.module('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js', () => ({" in content:
             if "query:" not in content:
                 content = content.replace("mock.module('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js', () => ({", "mock.module('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js', () => ({\n    query: mock(() => ({})),\n    orderByChild: mock(() => ({})),\n    equalTo: mock(() => ({})),")

        if "mock.module(\"https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js\", () => ({" in content:
            if "serverTimestamp:" not in content:
                 content = content.replace('mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({', 'mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({\n    serverTimestamp: mock(() => ({})),\n    goOnline: mock(() => ({})),\n    goOffline: mock(() => ({})),\n    push: mock(() => ({})),\n    limitToLast: mock(() => ({})),')
        elif "mock.module('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js', () => ({" in content:
             if "serverTimestamp:" not in content:
                 content = content.replace("mock.module('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js', () => ({", "mock.module('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js', () => ({\n    serverTimestamp: mock(() => ({})),\n    goOnline: mock(() => ({})),\n    goOffline: mock(() => ({})),\n    push: mock(() => ({})),\n    limitToLast: mock(() => ({})),")

        with open(f, 'w') as file:
            file.write(content)
