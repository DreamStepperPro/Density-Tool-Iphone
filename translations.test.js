import { expect, test, describe, beforeEach, mock } from "bun:test";

describe("translations.js", () => {
    let mockConfig;

    beforeEach(async () => {
        mockConfig = { lang: 'en' };

        // Reset window and document
        global.window = {
            getConfig: mock(() => mockConfig),
            saveLocalSettings: mock(),
            getStore: mock(() => null),
            getHistory: mock(() => null),
            getCachedHistories: mock(() => null),
            db: null,
            isOfflineMode: false,
        };

        global.document = {
            getElementById: mock((id) => {
                if (id === 'langToggleBtnOp' || id === 'langToggleBtnSup') {
                    return { innerText: '' };
                }
                if (id === 'lanesContainer') {
                    return { children: [] };
                }
                if (id === 'supervisorDashboard') {
                    return { style: { display: 'none' } };
                }
                return null;
            }),
            querySelectorAll: mock((selector) => {
                if (selector === '[data-i18n]') {
                    return [
                        { getAttribute: () => 'title', innerText: '' }
                    ];
                }
                if (selector === '[data-i18n-ph]') {
                    return [
                        { getAttribute: () => 'enterName', placeholder: '' }
                    ];
                }
                return [];
            })
        };

        // Clear module cache to re-evaluate translations.js with our new global.window
        delete require.cache[require.resolve("./translations.js")];
        await import("./translations.js?isolated=true&ts=" + Date.now());
    });

    describe("window.t()", () => {
        test("returns English translation when lang is 'en'", () => {
            mockConfig.lang = 'en';
            expect(window.t('title')).toBe("The Advantage");
        });

        test("returns Spanish translation when lang is 'es'", () => {
            mockConfig.lang = 'es';
            expect(window.t('title')).toBe("La Ventaja");
        });

        test("returns the key if translation is missing", () => {
            expect(window.t('missing_key')).toBe("missing_key");
        });
    });

    describe("window.toggleLanguage()", () => {
        test("toggles language from 'en' to 'es'", () => {
            window.applyTranslations = mock();
            mockConfig.lang = 'en';

            window.toggleLanguage();

            expect(mockConfig.lang).toBe('es');
            expect(window.saveLocalSettings).toHaveBeenCalled();
            expect(window.applyTranslations).toHaveBeenCalled();
        });

        test("toggles language from 'es' to 'en'", () => {
            window.applyTranslations = mock();
            mockConfig.lang = 'es';

            window.toggleLanguage();

            expect(mockConfig.lang).toBe('en');
            expect(window.saveLocalSettings).toHaveBeenCalled();
            expect(window.applyTranslations).toHaveBeenCalled();
        });
    });

    describe("window.applyTranslations()", () => {
        test("updates DOM elements based on language", () => {
            const langToggleOp = { innerText: '' };
            const langToggleSup = { innerText: '' };
            const titleEl = { getAttribute: () => 'title', innerText: '' };
            const inputEl = { getAttribute: () => 'enterName', placeholder: '' };

            global.document.getElementById = mock((id) => {
                if (id === 'langToggleBtnOp') return langToggleOp;
                if (id === 'langToggleBtnSup') return langToggleSup;
                if (id === 'lanesContainer') return { children: [] };
                if (id === 'supervisorDashboard') return { style: { display: 'none' } };
                return null;
            });

            global.document.querySelectorAll = mock((selector) => {
                if (selector === '[data-i18n]') return [titleEl];
                if (selector === '[data-i18n-ph]') return [inputEl];
                return [];
            });

            mockConfig.lang = 'es';
            window.applyTranslations();

            expect(langToggleOp.innerText).toBe('ES');
            expect(langToggleSup.innerText).toBe('ES');
            expect(titleEl.innerText).toBe('La Ventaja');
            expect(inputEl.placeholder).toBe('Ingresa tu nombre...');
        });

        test("calls renderInterface if lanesContainer has children", () => {
            window.renderInterface = mock();

            global.document.getElementById = mock((id) => {
                if (id === 'langToggleBtnOp' || id === 'langToggleBtnSup') return { innerText: '' };
                if (id === 'lanesContainer') return { children: [{}] }; // Has children
                if (id === 'supervisorDashboard') return { style: { display: 'none' } };
                return null;
            });

            window.applyTranslations();

            expect(window.renderInterface).toHaveBeenCalled();
        });

        test("calls updateUIFromCloud if store has lanes", () => {
            window.updateUIFromCloud = mock();
            window.getStore = mock(() => ({ lanes: {} }));

            window.applyTranslations();

            expect(window.updateUIFromCloud).toHaveBeenCalled();
        });

        test("calls renderHistoryCards if history has length > 0", () => {
            window.renderHistoryCards = mock();
            window.getHistory = mock(() => [{}]); // length > 0

            window.applyTranslations();

            expect(window.renderHistoryCards).toHaveBeenCalled();
        });

        test("calls renderSupervisorDashboard if supervisor dashboard is visible", () => {
            window.renderSupervisorDashboard = mock();
            window.getCachedHistories = mock(() => ({}));

            global.document.getElementById = mock((id) => {
                if (id === 'langToggleBtnOp' || id === 'langToggleBtnSup') return { innerText: '' };
                if (id === 'lanesContainer') return { children: [] };
                if (id === 'supervisorDashboard') return { style: { display: 'block' } }; // Visible
                return null;
            });

            window.applyTranslations();

            expect(window.renderSupervisorDashboard).toHaveBeenCalled();
        });

        test("starts comms listener if db exists and not offline", () => {
            window.startCommsListener = mock();
            window.db = {};
            window.isOfflineMode = false;

            window.applyTranslations();

            expect(window.startCommsListener).toHaveBeenCalled();
        });

        test("updates banner state if function exists", () => {
            window.updateBannerState = mock();

            window.applyTranslations();

            expect(window.updateBannerState).toHaveBeenCalled();
        });
    });
});
