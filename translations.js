// =====================================================================
// TRANSLATIONS.JS — i18n Dictionary + Translation Engine
// All text strings and language functions live here.
// To add a new language: duplicate the 'es' block with new locale key.
// =====================================================================

const i18n = {
    en: {
        title: "The Advantage", target: "Target", lane: "LANE", density: "DENSITY", avgWt: "AVG WEIGHT",
        newDens: "New Density:", tapApply: "TAP TO APPLY", history: "Shift History", saveCheck: "SAVE CHECK",
        clearTable: "CLEAR TABLE", lineAvg: "LINE AVG", lineSd: "LINE SD", options: "⚙️ Options",
        dispName: "Your Display Name", targetWt: "Target Weight (g)", unlockMethod: "Unlock Method",
        machines: "Machines", config: "Configuration", prodMode: "Product Mode", smartMode: "Smart Mode",
        theme: "Theme", enableAlerts: "🔔 ENABLE SYSTEM ALERTS", reset: "FACTORY RESET (LOCAL)",
        lunch: "Lunch", bfast: "Breakfast", dispatch: "📻 Line Dispatch", weightOff: "⚖️ WEIGHT OFF",
        maintReq: "🔧 MAINTENANCE REQ", send: "SEND", radioOpen: "Radio channel open...",
        accessPending: "🔒 Access Pending", accessWait: "Your device is waiting for Admin approval.",
        identify: "Identify Yourself to Admin", pingAdmin: "PING ADMIN FOR ACCESS", workOffline: "WORK OFFLINE",
        cmdCenter: "👑 Command Center", pendingAppr: "⏳ Pending Approvals", allUsers: "All Users",
        lockBtn: "Lock Button (Default)", longPress: "Long Press (1s)", doubleTap: "Double Tap",
        dualLane: "Dual Lane", quadLane: "Quad Lane", changeTarget: "⚠️ Change target weight mid-shift?",
        enterName: "Enter your name / role...", typeMsg: "Type message...",
        errWt: "⚖️ WEIGHT OFF: Need calibration.", errMech: "🔧 MAINTENANCE: Mechanical failure.",
        weighNow: "⚠️ WEIGH NOW", driftingFast: "DRIFTING FAST",
        dispatchWarningConfirm: "Dispatch weight warning to {machine} Lane {lane}?",
        offTargetMsg: "⚠️ OFF TARGET: Please check weight on {machine}, Lane {lane}.",
        maintMatrix: "Hardware Matrix", maintHint: "Tap a component to toggle its status.",
        waterjets: "Waterjet Cutters", belts: "Transport Belts",
        infeed: "Infeed", outfeed: "Outfeed", nuggetBelt: "Nuggets", filletBelt: "Fillets",
        faultReason: "Fault Reason", notesOpt: "Notes (Optional)",
        disable: "DISABLE", repair: "REPAIR", close: "CLOSE",
        maintLogs: "Maintenance Logs", backToMatrix: "BACK TO MATRIX",
        noLogs: "No downtime logged yet.", loadingLogs: "Loading logs...",
        sysRunning: "RUNNING", sysDegraded: "DEGRADED",
        allActive: "All components active. Tap for Maintenance.",
        compsDown: "component(s) down. TAP TO VIEW.", selectReason: "-- Select Reason --",
        comp_bin: "Infeed Belt", comp_bout: "Outfeed Belt", comp_bnug: "Nugget Belt", comp_bfil: "Fillet Belt",
        f_orifice: "Orifice", f_blocker: "Blocker", f_water: "Water Line",
        f_tracking: "Belt Tracking", f_broken: "Belt Broken", f_motor: "Motor Failure",
        f_jam: "Product Jam", f_other: "Other",
        disableComp: "Disable", repairComp: "Repair",
        confirmRepair: "Confirm this component is back online before clearing its downtime.",
        cancel: "CANCEL", backOnline: "✅ BACK ONLINE",
        sysDown: "DOWN", globalSys: "System Level", comp_sys: "Entire Machine (Hard Stop)",
        impactLevel: "Impact Level",
        impactDegraded: "⚠️ Reduces Capacity (Degraded)",
        impactDown: "🔴 Stops Machine (Hard Down)",
        endShift: "🏁 END SHIFT",
        endShiftConfirm: "🏁 END SHIFT?\nThis will clear the board for the next operator. The Supervisor Ledger will NOT be deleted.",
        liveYield: "LIVE YIELD UPDATE", trim: "Trim", fillets: "Fillets", nuggets: "Nuggets",
        streamReq: "💧 STREAM TEST REQUIRED", tapToLog: "Tap here to log results",
        stVerify: "Stream Test Verification", stPrompt: "Inspect the cardboard cutout for all active lanes. Are the jet streams cutting cleanly?",
        stPass: "✅ ALL STREAMS VERIFIED", stFail: "⚠️ LOG A FAILURE",
        takePhoto: "📸 Take Photo (Optional)", retakePhoto: "📸 Retake Photo",
        photoBypass: "No photo attached. Proceed without photo?",
        ourStory: "Our Story", missionTitle: "Built by an Operator",
        missionText: "I've been in the portioning industry for almost 10 years as a team leader and an operator. For a decade, the reality of the job was \"playing with the machine\" — guessing and adjusting density settings just to chase good weights. You'd check it every 30 minutes, hoping you were still in spec. It was a rhythmic approach to the constant problem of machine variation. Sometimes, all it takes is one issue to destabilize your entire workflow. The high speed and unpredictable nature of production mishaps can send even the most veteran operators spiraling.\n\nI wanted a solution, but a real one didn't exist. The tools we had were too slow, too out of touch, and relied too much on the blind hope that everything would just go smoothly. So, I built one. The Night Shift Advantage was built from the ground up by an operator who understands the chaotic nature of portioning and production. It was engineered to take back control from the chaos that robs your peace of mind. It is rigorously battle-tested. When you use this app, you will understand: it just works.\n\nThis tool can turn a new operator into a veteran, and a veteran into an elite operator. Set your own density formula, or let our SMART Adapt technology handle the headache for you — it accounts for the variation between all cutter performances so you hit your target weights instantly. The Predictive Velocity Engine tells you exactly when a lane is predicted to drift, keeping your target weights in the green for much longer. If there's downtime, you track Degraded vs. Hard Down events in seconds — no scrambling, no lethargic paperwork. And by sharing data securely in the cloud, operators and supervisors finally understand each other's strengths and weaknesses in real-time.\n\nBuilt with the operator front and center. Take back control."
    },
    es: {
        title: "La Ventaja", target: "Objetivo", lane: "CARRIL", density: "DENSIDAD", avgWt: "PESO PROM",
        newDens: "Nueva Densidad:", tapApply: "TOCA PARA APLICAR", history: "Historial de Turno", saveCheck: "GUARDAR",
        clearTable: "BORRAR TABLA", lineAvg: "PROM LÍNEA", lineSd: "SD LÍNEA", options: "⚙️ Opciones",
        dispName: "Tu Nombre", targetWt: "Peso Objetivo (g)", unlockMethod: "Método Desbloqueo",
        machines: "Máquinas", config: "Configuración", prodMode: "Modo Producto", smartMode: "Modo Inteligente",
        theme: "Tema", enableAlerts: "🔔 ACTIVAR ALERTAS", reset: "RESETEO DE FÁBRICA",
        lunch: "Almuerzo", bfast: "Desayuno", dispatch: "📻 Radio de Línea", weightOff: "⚖️ PESO INCORRECTO",
        maintReq: "🔧 REQ. MANTENIMIENTO", send: "ENVIAR", radioOpen: "Canal de radio abierto...",
        accessPending: "🔒 Acceso Pendiente", accessWait: "Tu dispositivo espera aprobación del Admin.",
        identify: "Identifícate al Admin", pingAdmin: "CONTACTAR ADMIN", workOffline: "TRABAJAR OFFLINE",
        cmdCenter: "👑 Centro de Mando", pendingAppr: "⏳ Aprobaciones Pendientes", allUsers: "Todos los Usuarios",
        lockBtn: "Botón Bloqueo", longPress: "Pulsar 1s", doubleTap: "Doble Toque",
        dualLane: "Dos Carriles", quadLane: "Cuatro Carriles", changeTarget: "⚠️ ¿Cambiar objetivo en medio turno?",
        enterName: "Ingresa tu nombre...", typeMsg: "Escribe un mensaje...",
        errWt: "⚖️ PESO INCORRECTO: Requiere calibración.", errMech: "🔧 MANTENIMIENTO: Falla mecánica.",
        weighNow: "⚠️ PESAR AHORA", driftingFast: "DESVIACIÓN RÁPIDA",
        dispatchWarningConfirm: "¿Enviar alerta de peso a {machine} Carril {lane}?",
        offTargetMsg: "⚠️ FUERA DE OBJETIVO: Por favor revise el peso en {machine}, Carril {lane}.",
        maintMatrix: "Matriz de Hardware", maintHint: "Toca un componente para cambiar su estado.",
        waterjets: "Cortadoras de Agua", belts: "Cintas de Transporte",
        infeed: "Entrada", outfeed: "Salida", nuggetBelt: "Nuggets", filletBelt: "Filetes",
        faultReason: "Razón de Falla", notesOpt: "Notas (Opcional)",
        disable: "DESACTIVAR", repair: "REPARAR", close: "CERRAR",
        maintLogs: "Registros de Mantenimiento", backToMatrix: "VOLVER A LA MATRIZ",
        noLogs: "Sin registros de inactividad.", loadingLogs: "Cargando registros...",
        sysRunning: "ACTIVO", sysDegraded: "DEGRADADO",
        allActive: "Todos activos. Toca para Mantenimiento.",
        compsDown: "comp. inactivos. TOCA PARA VER.", selectReason: "-- Seleccionar Razón --",
        comp_bin: "Cinta de Entrada", comp_bout: "Cinta de Salida", comp_bnug: "Cinta de Nuggets", comp_bfil: "Cinta de Filetes",
        f_orifice: "Orificio", f_blocker: "Bloqueador", f_water: "Línea de Agua",
        f_tracking: "Alineación de Cinta", f_broken: "Cinta Rota", f_motor: "Falla de Motor",
        f_jam: "Atasco de Producto", f_other: "Otro",
        disableComp: "Desactivar", repairComp: "Reparar",
        confirmRepair: "Confirma que el componente está en línea antes de borrar el tiempo.",
        cancel: "CANCELAR", backOnline: "✅ EN LÍNEA",
        sysDown: "DETENIDA", globalSys: "Nivel de Sistema", comp_sys: "Máquina Completa (Parada)",
        impactLevel: "Nivel de Impacto",
        impactDegraded: "⚠️ Reduce Capacidad (Degradado)",
        impactDown: "🔴 Detiene la Máquina (Parada)",
        endShift: "🏁 FINALIZAR TURNO",
        endShiftConfirm: "🏁 ¿FINALIZAR TURNO?\nEsto limpiará la pantalla para el próximo operador. El registro del supervisor NO se borrará.",
        liveYield: "ACTUALIZACIÓN DE RENDIMIENTO", trim: "Recorte", fillets: "Filetes", nuggets: "Nuggets",
        streamReq: "💧 PRUEBA DE CHORRO REQUERIDA", tapToLog: "Toca aquí para registrar",
        stVerify: "Verificación de Chorro", stPrompt: "Inspeccione el corte de cartón. ¿Los chorros están cortando limpiamente?",
        stPass: "✅ TODOS VERIFICADOS", stFail: "⚠️ REGISTRAR FALLA",
        takePhoto: "📸 Tomar Foto (Opcional)", retakePhoto: "📸 Volver a Tomar",
        photoBypass: "Sin foto adjunta. ¿Continuar sin foto?",
        ourStory: "Nuestra Historia", missionTitle: "Creado por un Operador",
        missionText: "Llevo casi 10 años en la industria del porcionado como líder de equipo y operador. Durante una década, la realidad del trabajo era \"jugar con la máquina\" — adivinar y ajustar la densidad solo para alcanzar buenos pesos. Revisabas cada 30 minutos, esperando seguir dentro de los parámetros. Era un enfoque rítmico al problema constante de la variación de la máquina. A veces, un solo problema desestabiliza todo el flujo de trabajo. La velocidad y la naturaleza impredecible de la producción puede hacer espiral incluso a los operadores más veteranos.\n\nQuería una solución real, pero no existía. Las herramientas disponibles eran demasiado lentas, demasiado desconectadas, y dependían demasiado de la esperanza de que todo saliera bien. Así que la construí yo. The Night Shift Advantage fue construida desde cero por un operador que entiende la naturaleza caótica del porcionado y la producción. Fue diseñada para recuperar el control del caos que roba tu paz mental. Está rigurosamente probada en campo. Cuando uses esta aplicación, entenderás: simplemente funciona.\n\nEsta herramienta puede convertir a un operador nuevo en veterano, y a un veterano en un operador élite. Configura tu propia fórmula de densidad, o deja que la tecnología SMART Adapt lo haga por ti — toma en cuenta la variación entre todos los cortadores para que alcances los pesos objetivo al instante. El Motor de Velocidad Predictiva te dice exactamente cuándo se predice que un carril se desviará, manteniendo los pesos en verde por mucho más tiempo. Si hay tiempo de inactividad, registras eventos Degradado vs. Parada en segundos — sin carreras, sin papeleo lento. Y al compartir datos de forma segura en la nube, operadores y supervisores finalmente entienden las fortalezas y debilidades del equipo en tiempo real.\n\nConstruido con el operador al frente. Recupera el control."
    }
};

// Translation lookup — uses config from app.js via getter
window.t = function(key) {
    return i18n[window.getConfig().lang][key] || key;
};

window.toggleLanguage = function() {
    window.getConfig().lang = window.getConfig().lang === 'en' ? 'es' : 'en';
    window.saveLocalSettings();
    window.applyTranslations();
};

window.applyTranslations = function() {
    const lang = window.getConfig().lang;
    document.getElementById('langToggleBtnOp').innerText = lang.toUpperCase();
    document.getElementById('langToggleBtnSup').innerText = lang.toUpperCase();
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) el.innerText = i18n[lang][key];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (i18n[lang][key]) el.placeholder = i18n[lang][key];
    });
    const store = window.getStore();
    const history = window.getHistory();
    if (document.getElementById('lanesContainer') && document.getElementById('lanesContainer').children.length > 0) {
        window.renderInterface();
    }
    if (store && store.lanes) window.updateUIFromCloud();
    if (history && history.length > 0) window.renderHistoryCards();
    const supDash = document.getElementById('supervisorDashboard');
    const cachedHistories = window.getCachedHistories ? window.getCachedHistories() : null;
    if (supDash && supDash.style.display !== 'none' && cachedHistories) window.renderSupervisorDashboard(cachedHistories);
    if (window.db && !window.isOfflineMode) window.startCommsListener();
    if (typeof window.updateBannerState === 'function') window.updateBannerState();
};
