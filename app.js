// ===== STATE =====
let isGuideVisible = true;
let isWebCascadeVisible = false;
let activeVT = null; // null | 'VT1' | 'VT2'

// ===== SUPABASE =====
let supabaseClient = null;
let sessionId = null;
let isLocalAction = false;

// ===== SDK COMMUNICATION =====
function toggleVisibility(actorName, visible) {
    window.parent.postMessage(
        JSON.stringify({
            action: "toggleVisibility",
            actor: actorName,
            visible: visible
        }),
        "*"
    );
}

function teleport(actorName) {
    window.parent.postMessage(
        JSON.stringify({
            action: "teleport",
            actor: actorName
        }),
        "*"
    );
}

// ===== SUPABASE INIT =====
async function initSupabase() {
    try {
        const { createClient } = supabase;
        supabaseClient = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

        const { data, error } = await supabaseClient
            .from('tp_menu_session')
            .select('*')
            .single();

        if (error) {
            console.error('Error fetching session:', error);
            return;
        }

        sessionId = data.id;
        console.log('Connected to tp_menu_session:', sessionId);

        // Sync initial state from DB
        syncStateFromData(data);

        // Subscribe to real-time changes
        supabaseClient
            .channel('tp_menu_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tp_menu_session'
                },
                handleSessionUpdate
            )
            .subscribe();

        console.log('Real-time subscription active');
    } catch (err) {
        console.error('Supabase initialization error:', err);
    }
}

async function updateSession(updates) {
    if (!supabaseClient || !sessionId) return;

    try {
        const { error } = await supabaseClient
            .from('tp_menu_session')
            .update(updates)
            .eq('id', sessionId);

        if (error) {
            console.error('Error updating session:', error);
        } else {
            console.log('Session updated:', updates);
        }
    } catch (err) {
        console.error('Update error:', err);
    }
}

function handleSessionUpdate(payload) {
    if (isLocalAction) {
        isLocalAction = false;
        return;
    }

    const data = payload.new;
    console.log('Received update:', data);
    syncFromSession(data);
}

function syncStateFromData(data) {
    // Sync toggle states from DB
    if (data.is_guide_visible !== undefined) {
        isGuideVisible = data.is_guide_visible;
        document.getElementById('mode-toggle').value = isGuideVisible ? 'Mode : Guide' : 'Mode : Auto';
    }
    if (data.is_web_cascade_visible !== undefined) {
        isWebCascadeVisible = data.is_web_cascade_visible;
        document.getElementById('web-cascade-toggle').value = isWebCascadeVisible ? 'Web Cascade ON' : 'Web Cascade OFF';
    }
    if (data.active_vt !== undefined) {
        activeVT = data.active_vt;
        document.getElementById('vt1-toggle').style.fontWeight = activeVT === 'VT1' ? 'bold' : 'normal';
        document.getElementById('vt2-toggle').style.fontWeight = activeVT === 'VT2' ? 'bold' : 'normal';
    }
}

function syncFromSession(data) {
    const action = data.last_action;
    const counter = data.action_counter;

    // Sync toggle states
    syncStateFromData(data);

    // Execute one-shot actions
    if (action && counter) {
        switch (action) {
            case 'tp_product':
                teleport("TP Product");
                toggleVisibility("VT Production systems", false);
                toggleVisibility("VT Supply", false);
                toggleVisibility("VT Product", true);
                break;
            case 'tp_production':
                teleport("TP Production");
                toggleVisibility("VT Product", false);
                toggleVisibility("VT Supply", false);
                toggleVisibility("VT Production systems", true);
                toggleVisibility("room", true);
                toggleVisibility("Eolienne", false);
                break;
            case 'tp_supply':
                teleport("TP Supply");
                toggleVisibility("VT Product", false);
                toggleVisibility("VT Production systems", false);
                toggleVisibility("VT Supply", true);
                break;
            case 'tp_ccl':
                teleport("TP CCL");
                toggleVisibility("VT Product", true);
                toggleVisibility("VT Production systems", true);
                toggleVisibility("VT Supply", true);
                break;
            case 'tp_eolienne':
                teleport("TP Eolienne");
                break;
            case 'toggle_guide_auto':
                applyGuideAutoLocal();
                break;
            case 'toggle_web_cascade':
                applyWebCascadeLocal();
                break;
            case 'toggle_vt':
                applyVTLocal();
                break;
            case 'reset':
                resetToAsIsLocal();
                break;
        }
    }
}

// ===== ACTIONS =====

// --- VT1 / VT2 ---
async function toggleVT(vt) {
    activeVT = (activeVT === vt) ? null : vt;
    applyVTLocal();

    isLocalAction = true;
    await updateSession({
        active_vt: activeVT,
        last_action: 'toggle_vt',
        action_counter: Date.now()
    });
}

function applyVTLocal() {
    const isVT1 = activeVT === 'VT1';
    const isVT2 = activeVT === 'VT2';

    toggleVisibility("General", !isVT1 && !isVT2);
    toggleVisibility("VT1", isVT1);
    toggleVisibility("VT2", isVT2);

    document.getElementById('vt1-toggle').style.fontWeight = isVT1 ? 'bold' : 'normal';
    document.getElementById('vt2-toggle').style.fontWeight = isVT2 ? 'bold' : 'normal';
}

// --- Guide / Auto ---
async function toggleGuideAuto() {
    isGuideVisible = !isGuideVisible;
    applyGuideAutoLocal();

    isLocalAction = true;
    await updateSession({
        is_guide_visible: isGuideVisible,
        last_action: 'toggle_guide_auto',
        action_counter: Date.now()
    });
}

function applyGuideAutoLocal() {
    const button = document.getElementById('mode-toggle');
    if (isGuideVisible) {
        toggleVisibility("Guide", true);
        toggleVisibility("Auto", false);
        button.value = 'Mode : Guide';
    } else {
        toggleVisibility("Guide", false);
        toggleVisibility("Auto", true);
        button.value = 'Mode : Auto';
    }
}

// --- Web Cascade ---
async function toggleWebCascade() {
    isWebCascadeVisible = !isWebCascadeVisible;
    applyWebCascadeLocal();

    isLocalAction = true;
    await updateSession({
        is_web_cascade_visible: isWebCascadeVisible,
        last_action: 'toggle_web_cascade',
        action_counter: Date.now()
    });
}

function applyWebCascadeLocal() {
    const button = document.getElementById('web-cascade-toggle');
    if (isWebCascadeVisible) {
        toggleVisibility("Guide", false);
        toggleVisibility("Auto", false);
        toggleVisibility("Presentation", false);
        toggleVisibility("Web Cascade", true);
        toggleVisibility("Web Cascade 2", true);
        button.value = 'Web Cascade ON';
    } else {
        if (isGuideVisible) {
            toggleVisibility("Guide", true);
        } else {
            toggleVisibility("Auto", true);
        }
        toggleVisibility("Web Cascade", false);
        toggleVisibility("Presentation", true);
        button.value = 'Web Cascade OFF';
    }
}

// --- Teleport ---
async function teleportToProduct() {
    teleport("TP Product");
    toggleVisibility("VT Production systems", false);
    toggleVisibility("VT Supply", false);
    toggleVisibility("VT Product", true);
    isLocalAction = true;
    await updateSession({ last_action: 'tp_product', action_counter: Date.now() });
}

async function teleportToProduction() {
    teleport("TP Production");
    toggleVisibility("VT Product", false);
    toggleVisibility("VT Supply", false);
    toggleVisibility("VT Production systems", true);
    toggleVisibility("room", true);
    toggleVisibility("Eolienne", false);
    isLocalAction = true;
    await updateSession({ last_action: 'tp_production', action_counter: Date.now() });
}

async function teleportToSupply() {
    teleport("TP Supply");
    toggleVisibility("VT Product", false);
    toggleVisibility("VT Production systems", false);
    toggleVisibility("VT Supply", true);
    isLocalAction = true;
    await updateSession({ last_action: 'tp_supply', action_counter: Date.now() });
}

async function teleportToCCL() {
    teleport("TP CCL");
    toggleVisibility("VT Product", true);
    toggleVisibility("VT Production systems", true);
    toggleVisibility("VT Supply", true);
    isLocalAction = true;
    await updateSession({ last_action: 'tp_ccl', action_counter: Date.now() });
}

async function teleportToEolienne() {
    teleport("TP Eolienne");
    isLocalAction = true;
    await updateSession({ last_action: 'tp_eolienne', action_counter: Date.now() });
}

// --- Reset ---
async function resetToAsIs() {
    resetToAsIsLocal();

    isGuideVisible = true;
    isWebCascadeVisible = false;

    isLocalAction = true;
    await updateSession({
        is_guide_visible: true,
        is_web_cascade_visible: false,
        last_action: 'reset',
        action_counter: Date.now()
    });
}

function resetToAsIsLocal() {
    // Hide PRD
    toggleVisibility("PRD 1", false);
    toggleVisibility("PRD 2", false);
    toggleVisibility("PRD 3", false);
    toggleVisibility("PRD 4", false);
    toggleVisibility("PRD Content", false);

    // Hide PSY
    toggleVisibility("PSY 1", false);
    toggleVisibility("PSY 2", false);
    toggleVisibility("PSY 3", false);
    toggleVisibility("PSY 4", false);
    toggleVisibility("PSY Content", false);

    // Hide SUP
    toggleVisibility("SUP 1", false);
    toggleVisibility("SUP 2", false);
    toggleVisibility("SUP 3", false);
    toggleVisibility("SUP 4", false);
    toggleVisibility("SUP Content", false);

    // Show AS IS
    toggleVisibility("AS IS Product", true);
    toggleVisibility("AS IS Production", true);
    toggleVisibility("AS IS Supply Chain", true);

    // Show Auto
    toggleVisibility("Auto", true);

    // Hide Web Univers
    toggleVisibility("Web Univers", false);

    // Update button labels
    document.getElementById('mode-toggle').value = 'Mode : Guide';
    document.getElementById('web-cascade-toggle').value = 'Web Cascade OFF';

    isGuideVisible = true;
    isWebCascadeVisible = false;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    await initSupabase();
    console.log('Teleport Menu loaded - SDK & Supabase ready');
});
