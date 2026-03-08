// ====================================
// SYSTÉM TRÉNINGOV - OŠK Kamenná Poruba
// ====================================

// Note: Global variables are declared in /pages/trainings.html before this script loads:
// - let currentUser
// - let trainings
// - let parentChildren

const PLAYER_DIRECTORY = {};

const PLAYER_NAME_MAP = {};

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsSingleQuotedString(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function isQuarterHourTime(value) {
    const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) {
        return false;
    }

    const minutes = Number(match[2]);
    return Number.isInteger(minutes) && minutes % 15 === 0;
}

function initializeCoachTrainingTimeSelectors() {
    const hourSelect = document.getElementById('coachTrainingHour');
    const minuteSelect = document.getElementById('coachTrainingMinute');
    if (!hourSelect || !minuteSelect) {
        return;
    }

    hourSelect.innerHTML = '';
    for (let hour = 8; hour <= 20; hour += 1) {
        const value = String(hour).padStart(2, '0');
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        hourSelect.appendChild(option);
    }

    hourSelect.value = '17';
    minuteSelect.value = '00';
}

function getApiBase() {
    if (typeof API_BASE === 'string' && API_BASE.length > 0) {
        return API_BASE;
    }
    const host = window.location.hostname;
    if (host.endsWith('.vercel.app')) {
        return '/api';
    }
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:4000/api';
    }
    const configuredRaw = window.localStorage ? window.localStorage.getItem('OSK_API_BASE') : '';
    const configured = String(configuredRaw || '').trim();
    if (configured) {
        const normalized = configured.replace(/\/+$/, '');
        return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
    }

    return '/api';
}

function getPlayerUsernamesByCategory(category) {
    return PLAYER_DIRECTORY[category] || [];
}

async function loadTrainingsFromApi() {
    const response = await fetch(`${getApiBase()}/trainings`, {
        method: 'GET',
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Nepodarilo sa načítať tréningy z backendu.');
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];

    return items.map((item) => ({
        id: item.id,
        date: item.date,
        time: item.time,
        type: item.type,
        duration: item.duration,
        category: item.category,
        note: item.note || '',
        createdBy: item.createdBy,
        createdDate: item.createdAt,
        isActive: item.isActive,
        attendance: Array.isArray(item.attendance)
            ? item.attendance.reduce((acc, row) => {
                acc[`${item.id}_${row.playerUsername}`] = row.status;
                return acc;
            }, {})
            : {}
    }));
}

// Initialize training HTML structure
function initializeTrainingView() {
    const trainingContainer = document.getElementById('trainingView');
    if (!trainingContainer) return;

    trainingContainer.innerHTML = `
        <section id="trainingSection" style="background: linear-gradient(135deg, #003399 0%, #1a5ccc 100%); color: white; padding: 60px 40px;">
            <div style="max-width: 1400px; margin: 0 auto;">
                <h2 style="border: none; color: white; padding-bottom: 10px; margin-bottom: 30px;">
                    <i class="fas fa-dumbbell"></i> Systém Tréningov
                </h2>

                <!-- Coach's Training Creation Form -->
                <div id="coachCreateTrainingArea" style="display: none; margin-bottom: 40px; background: rgba(255, 255, 255, 0.05); padding: 30px; border-radius: 10px; border: 2px solid #ffd700;">
                    <h3 style="color: #ffd700; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-plus-circle"></i> Vytvoriť nový tréning
                    </h3>
                    <form style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; align-items: end;">
                        <div>
                            <label style="display: block; margin-bottom: 8px; color: #ffd700; font-weight: bold;">Dátum:</label>
                            <input type="date" id="coachTrainingDate" style="width: 100%; padding: 10px; border: 1px solid #ffd700; border-radius: 5px; background: rgba(255, 255, 255, 0.1); color: white;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; color: #ffd700; font-weight: bold;">Čas:</label>
                            <div style="display:flex; gap:8px;">
                                <select id="coachTrainingHour" style="flex: 1; width: 100%; padding: 10px; border: 1px solid #ffd700; border-radius: 5px; background: rgba(255, 255, 255, 0.1); color: white;"></select>
                                <select id="coachTrainingMinute" style="flex: 1; width: 100%; padding: 10px; border: 1px solid #ffd700; border-radius: 5px; background: rgba(255, 255, 255, 0.1); color: white;">
                                    <option value="00">00</option>
                                    <option value="15">15</option>
                                    <option value="30">30</option>
                                    <option value="45">45</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; color: #ffd700; font-weight: bold;">Typ:</label>
                            <select id="coachTrainingType" style="width: 100%; padding: 10px; border: 1px solid #ffd700; border-radius: 5px; background: rgba(255, 255, 255, 0.1); color: white;">
                                <option value="">-- Vybrať typ --</option>
                                <option value="technical">Technický tréning</option>
                                <option value="tactical">Taktický tréning</option>
                                <option value="physical">Fyzický tréning</option>
                                <option value="friendly">Prieťahový zápas</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; color: #ffd700; font-weight: bold;">Trvanie (min):</label>
                            <input type="number" id="coachTrainingDuration" value="60" min="1" step="1" style="width: 100%; padding: 10px; border: 1px solid #ffd700; border-radius: 5px; background: rgba(255, 255, 255, 0.1); color: white;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; color: #ffd700; font-weight: bold;">Kategória:</label>
                            <select id="coachTrainingCategory" style="width: 100%; padding: 10px; border: 1px solid #ffd700; border-radius: 5px; background: rgba(255, 255, 255, 0.1); color: white;">
                                <option value="">-- Vybrať kategóriu --</option>
                                <option value="pripravky">Prípravky (U8-U9)</option>
                                <option value="ziaci">Žiaci (U10-U12)</option>
                                <option value="dorastenci">Dorastenci (U13-U18)</option>
                                <option value="adults_young">Dospelí - Mladí (18-25)</option>
                                <option value="adults_pro">Dospelí - Skúsení (25+)</option>
                            </select>
                        </div>
                        <div style="grid-column: 1 / -1;">
                            <label style="display: block; margin-bottom: 8px; color: #ffd700; font-weight: bold;">Poznámka k tréningu:</label>
                            <textarea id="coachTrainingNote" maxlength="1000" placeholder="Voliteľná poznámka pre hráčov a rodičov" style="width: 100%; padding: 10px; border: 1px solid #ffd700; border-radius: 5px; background: rgba(255, 255, 255, 0.1); color: white; font-family: inherit; min-height: 80px; resize: vertical;"></textarea>
                        </div>
                        <div>
                            <button type="button" onclick="createTraining()" style="width: 100%; padding: 12px; background: #ffd700; color: #003399; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.3s;">
                                <i class="fas fa-plus"></i> Vytvoriť tréning
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Parent Children Management (Read-Only) -->
                <div id="parentChildrenArea" style="display: none; margin-bottom: 40px; background: rgba(255, 255, 255, 0.05); padding: 30px; border-radius: 10px; border: 2px solid #ffd700;">
                    <h3 style="color: #ffd700; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-child"></i> Moje deti
                    </h3>
                    <div id="childrenList"></div>
                </div>

                <!-- Player/Parent Training Selection -->
                <div id="playerTrainingArea" style="display: none; margin-bottom: 40px;">
                    <h3 style="color: #ffd700; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-calendar-check"></i> Prihlásiť sa na tréning
                    </h3>
                    <div id="playerTrainingsContainer"></div>
                </div>

                <!-- Coach's Training Roster Table -->
                <div id="coachRosterArea" style="display: none;">
                    <h3 style="color: #ffd700; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-list"></i> Tréningy a účasť hráčov
                    </h3>
                    <div id="coachTrainingsContainer"></div>
                </div>
            </div>
        </section>
    `;

    initializeCoachTrainingTimeSelectors();
}

// Load training data from backend API
async function loadTrainingData() {
    try {
        trainings = await loadTrainingsFromApi();
    } catch (error) {
        console.error(error);
        trainings = [];
    }
    
    // Load parent's children from authenticated backend session payload
    if (currentUser && currentUser.role === 'parent') {
        parentChildren = {}; // Reset to ensure clean state
        const sessionChildren = Array.isArray(currentUser.parentChildren)
            ? currentUser.parentChildren
                .map((child) => (child && child.username ? child.username : null))
                .filter(Boolean)
            : [];

        sessionChildren.forEach((childUsername) => {
            parentChildren[childUsername] = true;
        });
    }

    if (currentUser && (currentUser.role === 'coach' || currentUser.role === 'admin')) {
        refreshCoachRoster();
    } else if (currentUser && (currentUser.role === 'player' || currentUser.role === 'parent')) {
        refreshPlayerTrainings();
    }
}

// Create training (Coach only)
async function createTraining() {
    console.log('createTraining called, currentUser:', currentUser);
    
    if (!currentUser || !currentUser.username) {
        alert('Musíte byť prihlásený ako tréner!');
        return;
    }
    
    const date = document.getElementById('coachTrainingDate').value;
    const selectedHour = document.getElementById('coachTrainingHour').value;
    const selectedMinute = document.getElementById('coachTrainingMinute').value;
    const time = (selectedHour && selectedMinute) ? `${selectedHour}:${selectedMinute}` : '';
    const type = document.getElementById('coachTrainingType').value;
    const duration = document.getElementById('coachTrainingDuration').value;
    const category = document.getElementById('coachTrainingCategory').value;
    const noteElement = document.getElementById('coachTrainingNote');
    const note = noteElement ? noteElement.value.trim() : '';

    if (!date || !time || !type || !duration || !category) {
        alert('Prosím vyplňte všetky polia!');
        return;
    }

    if (!isQuarterHourTime(time)) {
        alert('Čas tréningu musí byť po 15 minútach (00, 15, 30, 45).');
        return;
    }

    try {
        const csrfToken = typeof ensureCsrfToken === 'function' ? await ensureCsrfToken() : null;
        const response = await fetch(`${getApiBase()}/trainings`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
            },
            body: JSON.stringify({
                date,
                time,
                type,
                duration: Number(duration),
                category,
                note: note || null
            })
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.message || 'Nepodarilo sa vytvoriť tréning na serveri.');
        }
    } catch (error) {
        console.error(error);
        alert(error.message || 'Nepodarilo sa vytvoriť tréning.');
        return;
    }

    await loadTrainingData();

    alert('Tréning bol úspešne vytvorený! Všetci hráči majú stav "neviem".');
    
    // Clear form
    document.getElementById('coachTrainingDate').value = '';
    document.getElementById('coachTrainingHour').value = '17';
    document.getElementById('coachTrainingMinute').value = '00';
    document.getElementById('coachTrainingType').value = '';
    document.getElementById('coachTrainingDuration').value = '60';
    document.getElementById('coachTrainingCategory').value = '';
    if (noteElement) {
        noteElement.value = '';
    }

    refreshCoachRoster();
    refreshPlayerTrainings();
}

// Refresh player trainings view
function refreshPlayerTrainings() {
    const container = document.getElementById('playerTrainingsContainer');
    if (!container) {
        console.error('playerTrainingsContainer not found');
        return;
    }
    
    console.log('refreshPlayerTrainings, trainings:', trainings, 'currentUser:', currentUser);
    
    if (trainings.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #ffd700; padding: 30px;"><p>Zatiaľ nie sú žiadne naplánované tréningy.</p></div>';
        return;
    }

    // Get list of people to track attendance for
    let peopleToDisplay = [currentUser.username];
    if (currentUser.role === 'parent') {
        peopleToDisplay = Object.keys(parentChildren);
    }
    
    if (peopleToDisplay.length === 0 && currentUser.role === 'parent') {
        container.innerHTML = '<div style="text-align: center; color: #ffd700; padding: 30px;"><p>Nemáte pridelené žiadne deti.</p></div>';
        return;
    }

    let html = '';
    trainings.forEach(training => {
        const date = new Date(training.date);
        const formattedDate = date.toLocaleDateString('sk-SK');
        const typeLabel = getTrainingTypeLabel(training.type);
        const noteHtml = training.note
            ? `<p style="margin: 5px 0; color: rgba(255, 255, 255, 0.85);"><i class="fas fa-note-sticky"></i> Poznámka: ${escapeHtml(training.note)}</p>`
            : '';
        
        html += `
            <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 10px; margin-bottom: 15px;">
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; margin-bottom: 15px;">
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #ffd700; font-size: 16px;">${typeLabel}</h4>
                        <p style="margin: 5px 0; color: rgba(255, 255, 255, 0.8);">
                            <i class="fas fa-calendar"></i> ${formattedDate} o ${training.time}
                        </p>
                        <p style="margin: 5px 0; color: rgba(255, 255, 255, 0.8);">
                            <i class="fas fa-clock"></i> Trvanie: ${training.duration} minút
                        </p>
                        ${noteHtml}
                        <p style="margin: 5px 0; color: ${training.isActive ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">
                            ${training.isActive ? '🟢 Aktívny tréning' : '🔴 Uzavretý tréning'}
                        </p>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">`
        ;
        
        // Show attendance options for each person
        peopleToDisplay.forEach(personName => {
            const safeTrainingId = escapeJsSingleQuotedString(training.id);
            const safePersonName = escapeJsSingleQuotedString(personName);
            const trainingKey = training.id + '_' + personName;
            const currentStatus = training.attendance ? training.attendance[trainingKey] : undefined;
            const statusToUse = currentStatus || 'unknown';
            
            html += `
                <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 8px; border-left: 3px solid #ffd700;">
                    <p style="margin: 0 0 10px 0; color: #ffd700; font-size: 12px; font-weight: bold;">${personName}</p>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">`
            ;
            
            if (training.isActive) {
                html += `
                        <button onclick="markAttendance('${safeTrainingId}', '${safePersonName}', 'yes')" 
                            style="flex: 1; padding: 8px; border: none; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 12px; ${statusToUse === 'yes' ? 'background: #2ecc71; color: white;' : 'background: rgba(255, 255, 255, 0.1); color: white;'} transition: all 0.3s;">
                            <i class="fas fa-check"></i> Prídem
                        </button>
                        <button onclick="markAttendance('${safeTrainingId}', '${safePersonName}', 'no')" 
                            style="flex: 1; padding: 8px; border: none; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 12px; ${statusToUse === 'no' ? 'background: #e74c3c; color: white;' : 'background: rgba(255, 255, 255, 0.1); color: white;'} transition: all 0.3s;">
                            <i class="fas fa-times"></i> Neprídnem
                        </button>
                        <button onclick="markAttendance('${safeTrainingId}', '${safePersonName}', 'unknown')" 
                            style="flex: 1; padding: 8px; border: none; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 12px; ${statusToUse === 'unknown' ? 'background: #95a5a6; color: white;' : 'background: rgba(255, 255, 255, 0.1); color: white;'} transition: all 0.3s;">
                            <i class="fas fa-question"></i> Neviem
                        </button>
                `;
            } else {
                const statusLabels = { yes: 'Prídem ✓', no: 'Neprídnem ✗', unknown: 'Neviem ?' };
                const statusColors = { yes: '#2ecc71', no: '#e74c3c', unknown: '#95a5a6' };
                html += `
                        <div style="flex: 1; padding: 8px; border-radius: 3px; background: ${statusColors[statusToUse]}; color: white; text-align: center; font-weight: bold;">
                            ${statusLabels[statusToUse]}
                        </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Update children list display (read-only)
function updateChildrenList() {
    const childrenList = document.getElementById('childrenList');
    const children = Object.keys(parentChildren);
    
    if (children.length === 0) {
        childrenList.innerHTML = '<p style="color: rgba(255, 255, 255, 0.6); text-align: center;">Nemáte pridelené žiadne deti.</p>';
        return;
    }
    
    let html = '';
    children.forEach((childUsername, index) => {
        const childName = PLAYER_NAME_MAP[childUsername] || childUsername;
        
        html += `
            <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #ffd700; font-weight: bold;">${index + 1}. ${childName}</span>
            </div>
        `;
    });
    childrenList.innerHTML = html;
}

// Mark attendance for player or child
async function markAttendance(trainingId, personName, status) {
    // Find the training
    const training = trainings.find(t => String(t.id) === String(trainingId));
    if (!training) {
        console.error('Training not found:', trainingId);
        return;
    }
    
    // Check if training is active (not locked)
    if (!training.isActive) {
        alert('Tento tréning je už zatvorený a nemôžete zmeniť vašu odpoveď.');
        return;
    }
    
    try {
        const csrfToken = typeof ensureCsrfToken === 'function' ? await ensureCsrfToken() : null;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        let response;
        try {
            response = await fetch(`${getApiBase()}/trainings/${training.id}/attendance`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
                },
                body: JSON.stringify({
                    playerUsername: personName,
                    status
                }),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            if (response.status === 403) {
                const message403 = String(payload && payload.message ? payload.message : '').trim();
                if (typeof syncCurrentUserFromSessionWithRetry === 'function') {
                    try {
                        await syncCurrentUserFromSessionWithRetry();
                        if (typeof updateLoginButtonText === 'function') {
                            updateLoginButtonText();
                        }
                    } catch (_) {
                        // Ignore sync error and show original 403 context.
                    }
                }

                throw new Error(message403 || 'Nemáte oprávnenie potvrdzovať tento tréning pre zvolený účet.');
            }
            throw new Error(payload.message || 'Nepodarilo sa uložiť dochádzku.');
        }
    } catch (error) {
        const isTimeout = error && error.name === 'AbortError';
        alert(isTimeout ? 'Server neodpovedá. Skúste to prosím znova o chvíľu.' : (error.message || 'Nepodarilo sa uložiť dochádzku.'));
        return;
    }

    await loadTrainingData();
    
    const statusLabels = { yes: 'Prídem', no: 'Neprídnem', unknown: 'Neviem' };
    const message = personName === currentUser.username ? 
        'Vaša prítomnosť bola upravená na: ' + statusLabels[status] :
        'Prítomnosť ' + personName + ' bola upravená na: ' + statusLabels[status];
    console.log(message);
    
    refreshPlayerTrainings();
    refreshCoachRoster();
}

// Refresh coach roster
function refreshCoachRoster() {
    console.log('refreshCoachRoster called, currentUser:', currentUser, 'trainings:', trainings);
    
    const container = document.getElementById('coachTrainingsContainer');
    if (!container) {
        console.error('coachTrainingsContainer not found');
        return;
    }
    
    if (trainings.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #ffd700; padding: 30px;"><p>Zatiaľ nie sú žiadne vytvorené tréningy.</p></div>';
        return;
    }

    let html = '';
    trainings.forEach(training => {
        const date = new Date(training.date);
        const formattedDate = date.toLocaleDateString('sk-SK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const typeLabel = getTrainingTypeLabel(training.type);
        const categoryLabel = getTrainingCategoryLabel(training.category);
        const noteHtml = training.note
            ? `<p style="margin: 8px 0; color: rgba(255, 255, 255, 0.9);"><i class="fas fa-note-sticky"></i> Poznámka: ${escapeHtml(training.note)}</p>`
            : '';
        
        // Get attendance for this training - now with three categories
        let attendingPlayers = [];
        let notAttendingPlayers = [];
        let unknownPlayers = [];

        if (training.attendance) {
            Object.keys(training.attendance).forEach(key => {
                const playerName = key.substring((training.id + '_').length);
                const status = training.attendance[key];
                
                if (status === 'yes') {
                    attendingPlayers.push(playerName);
                } else if (status === 'no') {
                    notAttendingPlayers.push(playerName);
                } else {
                    unknownPlayers.push(playerName);
                }
            });
        }

        const totalExpected = attendingPlayers.length + notAttendingPlayers.length + unknownPlayers.length;
        const attendancePercent = totalExpected > 0 ? Math.round((attendingPlayers.length / totalExpected) * 100) : 0;

        html += `
            <div style="border: 2px solid #ffd700; border-radius: 10px; overflow: hidden; background: rgba(255, 255, 255, 0.02); margin-bottom: 20px;">
                <!-- Training Header -->
                <div style="background: linear-gradient(90deg, rgba(255, 215, 0, 0.2) 0%, rgba(0, 51, 153, 0.2) 100%); padding: 20px; border-bottom: 2px solid #ffd700;">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: start;">
                        <div>
                            <h3 style="margin: 0 0 10px 0; color: #ffd700; font-size: 20px;">
                                <i class="fas fa-futbol"></i> ${typeLabel}
                            </h3>
                            <p style="margin: 8px 0; color: rgba(255, 255, 255, 0.9);">
                                <i class="fas fa-calendar"></i> <strong>${formattedDate}</strong>
                            </p>
                            <p style="margin: 8px 0; color: rgba(255, 255, 255, 0.9);">
                                <i class="fas fa-clock"></i> <strong>${training.time}</strong> | <i class="fas fa-hourglass-half"></i> ${training.duration} minút
                            </p>
                            <p style="margin: 8px 0; color: #ffd700; font-weight: bold;">
                                <i class="fas fa-users"></i> Kategória: ${categoryLabel}
                            </p>
                            ${noteHtml}
                            <p style="margin: 8px 0; color: ${training.isActive ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">
                                ${training.isActive ? '🟢 Aktívny tréning - hráči môžu meniť odpovede' : '🔴 Uzavretý tréning - žiadne zmeny'}
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: rgba(46, 204, 113, 0.2); border: 2px solid #2ecc71; padding: 15px 20px; border-radius: 8px; margin-bottom: 10px;">
                                <div style="font-size: 28px; color: #2ecc71; font-weight: bold;">${attendingPlayers.length}</div>
                                <div style="font-size: 12px; color: #2ecc71;">Hráči prídu</div>
                            </div>
                            <div style="background: rgba(46, 204, 113, 0.1); padding: 5px 10px; border-radius: 5px; font-size: 12px; color: #2ecc71; margin-bottom: 10px;">
                                Účasť: ${attendancePercent}%
                            </div>
                            <div style="display: flex; gap: 8px; flex-direction: column;">
                                ${training.isActive ? `
                                    <button onclick="startTraining('${training.id}')" style="padding: 8px 12px; background: #f39c12; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; width: 100%;">
                                        <i class="fas fa-play"></i> Začať tréning
                                    </button>
                                ` : ''}
                                <button onclick="editTraining('${training.id}')" style="padding: 8px 12px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; width: 100%;">
                                    <i class="fa-solid fa-pen-to-square"></i> Upraviť
                                </button>
                                <button onclick="deleteTraining('${training.id}')" style="padding: 8px 12px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; width: 100%;">
                                    <i class="fas fa-trash"></i> Odstrániť
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Attendance Lists -->
                <div style="padding: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        <!-- Coming Players -->
                        <div>
                            <h4 style="margin: 0 0 15px 0; color: #2ecc71; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-check-circle"></i> Prídu (${attendingPlayers.length})
                            </h4>
                            <div style="background: rgba(46, 204, 113, 0.1); border: 1px solid rgba(46, 204, 113, 0.3); padding: 15px; border-radius: 8px; min-height: 100px; max-height: 300px; overflow-y: auto;">
                                ${attendingPlayers.length > 0 ? attendingPlayers.map((p, idx) => `
                                    <div style="padding: 10px 0; border-bottom: 1px solid rgba(46, 204, 113, 0.2); color: #2ecc71; display: flex; align-items: center; gap: 8px;">
                                        <span style="display: inline-block; width: 24px; height: 24px; background: #2ecc71; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">${idx + 1}</span>
                                        ${p}
                                    </div>
                                `).join('') : '<p style="color: rgba(255, 255, 255, 0.5); margin: 0; text-align: center; padding-top: 30px;">Zatiaľ nikto</p>'}
                            </div>
                        </div>

                        <!-- Not Coming Players -->
                        <div>
                            <h4 style="margin: 0 0 15px 0; color: #e74c3c; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-times-circle"></i> Neprídú (${notAttendingPlayers.length})
                            </h4>
                            <div style="background: rgba(231, 76, 60, 0.1); border: 1px solid rgba(231, 76, 60, 0.3); padding: 15px; border-radius: 8px; min-height: 100px; max-height: 300px; overflow-y: auto;">
                                ${notAttendingPlayers.length > 0 ? notAttendingPlayers.map((p, idx) => `
                                    <div style="padding: 10px 0; border-bottom: 1px solid rgba(231, 76, 60, 0.2); color: #e74c3c; display: flex; align-items: center; gap: 8px;">
                                        <span style="display: inline-block; width: 24px; height: 24px; background: #e74c3c; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">${idx + 1}</span>
                                        ${p}
                                    </div>
                                `).join('') : '<p style="color: rgba(255, 255, 255, 0.5); margin: 0; text-align: center; padding-top: 30px;">Zatiaľ nikto</p>'}
                            </div>
                        </div>

                        <!-- Unknown Response Players -->
                        <div>
                            <h4 style="margin: 0 0 15px 0; color: #95a5a6; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-question-circle"></i> Nevedia (${unknownPlayers.length})
                            </h4>
                            <div style="background: rgba(149, 165, 166, 0.1); border: 1px solid rgba(149, 165, 166, 0.3); padding: 15px; border-radius: 8px; min-height: 100px; max-height: 300px; overflow-y: auto;">
                                ${unknownPlayers.length > 0 ? unknownPlayers.map((p, idx) => `
                                    <div style="padding: 10px 0; border-bottom: 1px solid rgba(149, 165, 166, 0.2); color: #95a5a6; display: flex; align-items: center; gap: 8px;">
                                        <span style="display: inline-block; width: 24px; height: 24px; background: #95a5a6; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">${idx + 1}</span>
                                        ${p}
                                    </div>
                                `).join('') : '<p style="color: rgba(255, 255, 255, 0.5); margin: 0; text-align: center; padding-top: 30px;">Všetci odpovedali</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Start training - lock attendance changes
async function startTraining(trainingId) {
    const training = trainings.find(t => String(t.id) === String(trainingId));
    if (!training) return;

    if (!confirm('Naozaj chcete uzavrieť tento tréning? Hráči už nebudú môcť meniť svoje odpovede.')) {
        return;
    }

    try {
        const csrfToken = typeof ensureCsrfToken === 'function' ? await ensureCsrfToken() : null;
        const response = await fetch(`${getApiBase()}/trainings/${training.id}/close`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
            }
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.message || 'Nepodarilo sa uzavrieť tréning.');
        }
    } catch (error) {
        alert(error.message || 'Nepodarilo sa uzavrieť tréning.');
        return;
    }

    await loadTrainingData();
    alert('Tréning bol uzavretý. Hráči nemôžu meniť svoje odpovede.');
    refreshCoachRoster();
    refreshPlayerTrainings();
}

// Get training category label
function getTrainingCategoryLabel(category) {
    const labels = {
        'pripravky': 'Prípravky (U8-U9)',
        'ziaci': 'Žiaci (U10-U12)',
        'dorastenci': 'Dorastenci (U13-U18)',
        'adults_young': 'Dospelí - Mladí (18-25)',
        'adults_pro': 'Dospelí - Skúsení (25+)'
    };
    return labels[category] || category;
}

function openTrainingEditModal(training) {
    return new Promise((resolve) => {
        const [currentHourRaw, currentMinuteRaw] = String(training.time || '').split(':');
        const currentHour = String(currentHourRaw || '17').padStart(2, '0');
        const currentMinute = ['00', '15', '30', '45'].includes(String(currentMinuteRaw || '00'))
            ? String(currentMinuteRaw || '00')
            : '00';
        const hourOptions = Array.from({ length: 13 }, (_, index) => String(index + 8).padStart(2, '0'))
            .map((hour) => `<option value="${hour}" ${hour === currentHour ? 'selected' : ''}>${hour}</option>`)
            .join('');

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0, 0, 0, 0.7)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '20px';
        overlay.style.zIndex = '9999';

        const modal = document.createElement('div');
        modal.style.width = '100%';
        modal.style.maxWidth = '680px';
        modal.style.maxHeight = '90vh';
        modal.style.overflowY = 'auto';
        modal.style.background = '#0f2f73';
        modal.style.border = '2px solid #ffd700';
        modal.style.borderRadius = '10px';
        modal.style.padding = '20px';
        modal.style.color = 'white';

        modal.innerHTML = `
            <h3 style="margin:0 0 16px 0;color:#ffd700;"><i class="fa-solid fa-pen-to-square"></i> Upraviť tréning</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
                <label style="display:flex;flex-direction:column;gap:6px;">
                    <span>Dátum</span>
                    <input id="editTrainingDate" type="date" value="${training.date || ''}" style="padding:10px;border:1px solid #ffd700;border-radius:6px;background:rgba(255,255,255,0.1);color:white;">
                </label>
                <label style="display:flex;flex-direction:column;gap:6px;">
                    <span>Čas</span>
                    <div style="display:flex;gap:8px;">
                        <select id="editTrainingHour" style="flex:1;padding:10px;border:1px solid #ffd700;border-radius:6px;background:rgba(255,255,255,0.1);color:white;">
                            ${hourOptions}
                        </select>
                        <select id="editTrainingMinute" style="flex:1;padding:10px;border:1px solid #ffd700;border-radius:6px;background:rgba(255,255,255,0.1);color:white;">
                            <option value="00" ${currentMinute === '00' ? 'selected' : ''}>00</option>
                            <option value="15" ${currentMinute === '15' ? 'selected' : ''}>15</option>
                            <option value="30" ${currentMinute === '30' ? 'selected' : ''}>30</option>
                            <option value="45" ${currentMinute === '45' ? 'selected' : ''}>45</option>
                        </select>
                    </div>
                </label>
                <label style="display:flex;flex-direction:column;gap:6px;">
                    <span>Typ</span>
                    <select id="editTrainingType" style="padding:10px;border:1px solid #ffd700;border-radius:6px;background:rgba(255,255,255,0.1);color:white;">
                        <option value="technical" ${training.type === 'technical' ? 'selected' : ''}>Technický</option>
                        <option value="tactical" ${training.type === 'tactical' ? 'selected' : ''}>Taktický</option>
                        <option value="physical" ${training.type === 'physical' ? 'selected' : ''}>Fyzický</option>
                        <option value="friendly" ${training.type === 'friendly' ? 'selected' : ''}>Priateľský</option>
                    </select>
                </label>
                <label style="display:flex;flex-direction:column;gap:6px;">
                    <span>Trvanie (min)</span>
                    <input id="editTrainingDuration" type="number" min="1" step="1" value="${training.duration || 60}" style="padding:10px;border:1px solid #ffd700;border-radius:6px;background:rgba(255,255,255,0.1);color:white;">
                </label>
                <label style="display:flex;flex-direction:column;gap:6px;grid-column:1/-1;">
                    <span>Kategória</span>
                    <select id="editTrainingCategory" style="padding:10px;border:1px solid #ffd700;border-radius:6px;background:rgba(255,255,255,0.1);color:white;">
                        <option value="pripravky" ${training.category === 'pripravky' ? 'selected' : ''}>Prípravky (U8-U9)</option>
                        <option value="ziaci" ${training.category === 'ziaci' ? 'selected' : ''}>Žiaci (U10-U12)</option>
                        <option value="dorastenci" ${training.category === 'dorastenci' ? 'selected' : ''}>Dorastenci (U13-U18)</option>
                        <option value="adults_young" ${training.category === 'adults_young' ? 'selected' : ''}>Dospelí - Mladí (18-25)</option>
                        <option value="adults_pro" ${training.category === 'adults_pro' ? 'selected' : ''}>Dospelí - Skúsení (25+)</option>
                    </select>
                </label>
                <label style="display:flex;flex-direction:column;gap:6px;grid-column:1/-1;">
                    <span>Poznámka</span>
                    <textarea id="editTrainingNote" maxlength="1000" style="padding:10px;border:1px solid #ffd700;border-radius:6px;background:rgba(255,255,255,0.1);color:white;min-height:90px;resize:vertical;">${training.note || ''}</textarea>
                </label>
            </div>
            <div id="editTrainingError" style="display:none;margin-top:12px;color:#ffb3b3;"></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
                <button id="editTrainingCancel" type="button" style="padding:10px 14px;border:none;border-radius:6px;background:#7f8c8d;color:white;cursor:pointer;">Zrušiť</button>
                <button id="editTrainingSave" type="button" style="padding:10px 14px;border:none;border-radius:6px;background:#2ecc71;color:white;cursor:pointer;">Uložiť zmeny</button>
            </div>
        `;

        const closeModal = (value) => {
            overlay.remove();
            resolve(value);
        };

        const showError = (message) => {
            const errorElement = modal.querySelector('#editTrainingError');
            if (!errorElement) return;
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        };

        const saveButton = modal.querySelector('#editTrainingSave');
        const cancelButton = modal.querySelector('#editTrainingCancel');

        Array.from(modal.querySelectorAll('select option')).forEach((option) => {
            option.style.color = '#111';
            option.style.background = '#fff';
        });

        saveButton?.addEventListener('click', () => {
            const date = String(modal.querySelector('#editTrainingDate')?.value || '').trim();
            const hour = String(modal.querySelector('#editTrainingHour')?.value || '').trim();
            const minute = String(modal.querySelector('#editTrainingMinute')?.value || '').trim();
            const time = (hour && minute) ? `${hour}:${minute}` : '';
            const type = String(modal.querySelector('#editTrainingType')?.value || '').trim();
            const duration = Number(modal.querySelector('#editTrainingDuration')?.value || 0);
            const category = String(modal.querySelector('#editTrainingCategory')?.value || '').trim();
            const note = String(modal.querySelector('#editTrainingNote')?.value || '').trim();

            if (!date || !time || !type || !category || !Number.isInteger(duration) || duration < 1) {
                showError('Vyplňte platné hodnoty pre všetky povinné polia.');
                return;
            }

            if (!isQuarterHourTime(time)) {
                showError('Čas tréningu musí byť po 15 minútach (00, 15, 30, 45).');
                return;
            }

            closeModal({
                date,
                time,
                type,
                duration,
                category,
                note: note || null
            });
        });

        cancelButton?.addEventListener('click', () => closeModal(null));
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeModal(null);
            }
        });

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}

async function editTraining(id) {
    const training = trainings.find((item) => String(item.id) === String(id));
    if (!training) {
        alert('Tréning sa nenašiel.');
        return;
    }

    const payload = await openTrainingEditModal(training);
    if (!payload) {
        return;
    }

    try {
        const csrfToken = typeof ensureCsrfToken === 'function' ? await ensureCsrfToken() : null;
        const patchResponse = await fetch(`${getApiBase()}/trainings/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
            },
            body: JSON.stringify(payload)
        });

        if (!patchResponse.ok) {
            const fallbackResponse = await fetch(`${getApiBase()}/trainings/${id}/update`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
                },
                body: JSON.stringify(payload)
            });

            if (!fallbackResponse.ok) {
                const payloadError = await fallbackResponse.json().catch(() => ({}));
                throw new Error(payloadError.message || 'Nepodarilo sa upraviť tréning.');
            }
        }
    } catch (error) {
        alert(error.message || 'Nepodarilo sa upraviť tréning.');
        return;
    }

    await loadTrainingData();
    alert('Tréning bol upravený a notifikácia odoslaná.');
    refreshCoachRoster();
    refreshPlayerTrainings();
}

// Delete training
async function deleteTraining(id) {
    if (confirm('Ste si istý, že chcete odstrániť tento tréning?')) {
        try {
            const csrfToken = typeof ensureCsrfToken === 'function' ? await ensureCsrfToken() : null;
            const deleteResponse = await fetch(`${getApiBase()}/trainings/${id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
                }
            });

            if (!deleteResponse.ok) {
                const postDeleteResponse = await fetch(`${getApiBase()}/trainings/${id}/delete`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
                    }
                });

                if (!postDeleteResponse.ok) {
                    const fallbackResponse = await fetch(`${getApiBase()}/trainings/delete-by-id`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
                        },
                        body: JSON.stringify({ trainingId: id })
                    });

                    if (!fallbackResponse.ok) {
                        const payload = await fallbackResponse.json().catch(() => ({}));
                        throw new Error(payload.message || 'Nepodarilo sa odstrániť tréning.');
                    }
                }
            }
        } catch (error) {
            alert(error.message || 'Nepodarilo sa odstrániť tréning.');
            return;
        }

        await loadTrainingData();
        alert('Tréning bol odstránený.');
        refreshCoachRoster();
        refreshPlayerTrainings();
    }
}

// Get training type label
function getTrainingTypeLabel(type) {
    const labels = {
        'technical': '⚽ Technický tréning',
        'tactical': '📋 Taktický tréning',
        'physical': '💪 Fyzický tréning',
        'friendly': '🎯 Prieťahový zápas'
    };
    return labels[type] || type;
}

