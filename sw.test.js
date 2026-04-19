import { mock, test, expect, spyOn, beforeEach } from "bun:test";

let listeners = {};
global.self = {
    addEventListener: (event, handler) => {
        listeners[event] = handler;
    },
    skipWaiting: mock(() => {})
};

let mockCache;

beforeEach(() => {
    listeners = {};
    mockCache = {
        put: mock(() => Promise.resolve()),
        addAll: mock(() => Promise.resolve())
    };

    global.caches = {
        open: mock(() => Promise.resolve(mockCache)),
        keys: mock(() => Promise.resolve(['old-cache', 'dsi-advantage-v2'])),
        delete: mock(() => Promise.resolve()),
        match: mock(() => Promise.resolve("cached-response"))
    };
});

test("Fetch event fallback to cache on network failure", async () => {
    // Reset fetch to reject
    global.fetch = mock(() => Promise.reject(new Error("Network failure")));

    await import("./sw.js?isolated=1");

    const respondWithMock = mock((promise) => promise);
    const event = {
        request: { method: 'GET', url: 'https://example.com/test' },
        respondWith: respondWithMock
    };

    listeners['fetch'](event);

    // The handler passes a promise to respondWith. Wait for it.
    const result = await respondWithMock.mock.calls[0][0];

    expect(global.fetch).toHaveBeenCalledWith(event.request);
    expect(global.caches.match).toHaveBeenCalledWith(event.request);
    expect(result).toBe("cached-response");
});

test("Fetch event caches and returns network response on success", async () => {
    const mockResponse = { clone: mock(() => "cloned-response") };
    global.fetch = mock(() => Promise.resolve(mockResponse));

    await import("./sw.js?isolated=2");

    const respondWithMock = mock((promise) => promise);
    const event = {
        request: { method: 'GET', url: 'https://example.com/test' },
        respondWith: respondWithMock
    };

    listeners['fetch'](event);

    const result = await respondWithMock.mock.calls[0][0];

    expect(global.fetch).toHaveBeenCalledWith(event.request);
    expect(global.caches.open).toHaveBeenCalledWith('dsi-advantage-v2');
    expect(mockCache.put).toHaveBeenCalledWith(event.request, "cloned-response");
    expect(result).toBe(mockResponse);
});

test("Fetch event ignores non-GET requests", async () => {
    global.fetch = mock(() => Promise.reject(new Error("Should not fetch")));

    await import("./sw.js?isolated=3");

    const respondWithMock = mock((promise) => promise);
    const event = {
        request: { method: 'POST', url: 'https://example.com/test' },
        respondWith: respondWithMock
    };

    listeners['fetch'](event);

    expect(respondWithMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});
