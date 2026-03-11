const env = require('../config/env');

const cacheState = {
  expiresAt: 0,
  payload: null
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getHeaders() {
  const headers = {
    Accept: 'application/json'
  };

  if (isNonEmptyString(env.sportsnetApiKey)) {
    const rawKey = env.sportsnetApiKey.trim();
    let prefix = 'Bearer';
    let token = rawKey;

    if (/^ApiKey\s+/i.test(rawKey)) {
      prefix = 'ApiKey';
      token = rawKey.replace(/^ApiKey\s+/i, '').trim();
    } else if (/^Bearer\s+/i.test(rawKey)) {
      prefix = 'Bearer';
      token = rawKey.replace(/^Bearer\s+/i, '').trim();
    } else {
      // If no prefix, guess based on length/format. JWTs are very long and have dots.
      prefix = token.includes('.') ? 'Bearer' : 'ApiKey';
    }

    if (token) {
      headers.Authorization = `${prefix} ${token}`;
    }
  }

  return headers;
}

function buildApiBase() {
  return 'https://sutaze.api.sportnet.online/api/v2';
}

// Map SportNet internal team names to our categories
const TEAM_NAME_MAP = {
  'dospeli-m-a': 'dospeli',
  'dospeli m a': 'dospeli',
  'u19-m-a': 'u19',
  'u19 m a': 'u19',
  'u17-m-a': 'u17',
  'u17 m a': 'u17',
  'u15-m-a': 'u15',
  'u15 m a': 'u15',
  'u13-m-a': 'u13',
  'u13 m a': 'u13',
  'u11-m-a': 'u11',
  'u11 m a': 'u11',
  'u09-m-a': 'u09',
  'u09 m a': 'u09',
  'u9-m-a': 'u09',
  'u9 m a': 'u09'
};

function detectTeamCategory(team) {
  const name = String(team.name || '').toLowerCase().trim();
  const displayName = String(team.displayName || '').toLowerCase().trim();

  // Try direct map
  for (const [pattern, category] of Object.entries(TEAM_NAME_MAP)) {
    if (name === pattern || name.includes(pattern)) return category;
    if (displayName === pattern || displayName.includes(pattern)) return category;
  }

  // Fallback: detect from display name patterns
  if (displayName.includes('u19') || displayName.includes('u-19') || displayName.includes('dorast')) return 'u19';
  if (displayName.includes('u17') || displayName.includes('u-17')) return 'u17';
  if (displayName.includes('u15') || displayName.includes('u-15') || displayName.includes('starší žiaci')) return 'u15';
  if (displayName.includes('u13') || displayName.includes('u-13') || displayName.includes('mladší žiaci')) return 'u13';
  if (displayName.includes('u11') || displayName.includes('u-11') || displayName.includes('prípravka')) return 'u11';
  if (displayName.includes('u09') || displayName.includes('u-09') || displayName.includes('u9')) return 'u09';
  if (displayName.includes('dospel') || displayName.includes('muž') || name.includes('dospel')) return 'dospeli';

  return null;
}

const POSITION_LABELS = {
  brankár: 'Brankár',
  brankar: 'Brankár',
  goalkeeper: 'Brankár',
  gk: 'Brankár',
  obranca: 'Obranca',
  defender: 'Obranca',
  def: 'Obranca',
  záložník: 'Záložník',
  zaloznik: 'Záložník',
  midfielder: 'Záložník',
  mid: 'Záložník',
  útočník: 'Útočník',
  utocnik: 'Útočník',
  forward: 'Útočník',
  fw: 'Útočník',
  striker: 'Útočník',
  str: 'Útočník'
};

function normalizePosition(raw) {
  if (!raw) return 'Neznáma';
  const lower = String(raw).toLowerCase().trim();
  return POSITION_LABELS[lower] || raw;
}

function mapAthlete(athlete) {
  const user = athlete.sportnetUser || {};
  const data = athlete.additionalData || {};

  return {
    sportnetId: user._id || null,
    name: user.name || 'Neznámy',
    position: normalizePosition(data.position),
    number: data.nr || null,
    captain: data.captain === true,
    age: data.age || null
  };
}

function groupByPosition(athletes) {
  const groups = {
    'Brankár': [],
    'Obranca': [],
    'Záložník': [],
    'Útočník': [],
    'Neznáma': []
  };

  athletes.forEach((player) => {
    const pos = player.position;
    if (groups[pos]) {
      groups[pos].push(player);
    } else {
      groups['Neznáma'].push(player);
    }
  });

  return groups;
}

function getUnconfiguredPayload() {
  return {
    source: 'sportsnet-players.unconfigured',
    fetchedAt: new Date().toISOString(),
    teams: {},
    cache: 'BYPASS',
    message: 'Sportsnet endpoint nie je nakonfigurovaný. Nastav SPORTNET_API_BASE a SPORTNET_API_KEY.'
  };
}

async function fetchSportsnetPlayers({ forceRefresh = false } = {}) {
  const apiBase = buildApiBase();
  if (!apiBase) {
    return getUnconfiguredPayload();
  }

  if (!isNonEmptyString(env.sportnetOrgId)) {
    return getUnconfiguredPayload();
  }

  const now = Date.now();

  if (!forceRefresh && cacheState.payload && cacheState.expiresAt > now) {
    return {
      ...cacheState.payload,
      cache: 'HIT'
    };
  }

  const appSpace = env.sportnetOrgId.trim();
  const headers = getHeaders();

  // Step 1: Fetch all teams
  const teamsUrl = `${apiBase}/admin/${encodeURIComponent(appSpace)}/teams?limit=100`;

  let teamsResponse;
  try {
    teamsResponse = await fetch(teamsUrl, { method: 'GET', headers });
  } catch (cause) {
    const error = new Error('Nepodarilo sa pripojiť na Sportsnet API (teams).');
    error.status = 502;
    error.cause = cause;
    throw error;
  }

  if (!teamsResponse.ok) {
    let responseBody = '';
    try { responseBody = await teamsResponse.text(); } catch (_) {}
    
    let errMsg = `Sportsnet API (teams) vrátilo status ${teamsResponse.status}.`;
    if (teamsResponse.status === 401) {
      errMsg += ` Chýba alebo je neplatný SPORTNET_API_KEY. Uistite sa, že je správne nastavený v prostredí (napr. Vercel).`;
    }
    errMsg += ` Body: ${responseBody.slice(0, 300)}`;

    const error = new Error(errMsg);
    error.status = 502;
    throw error;
  }

  let teamsPayload;
  try {
    teamsPayload = await teamsResponse.json();
  } catch (cause) {
    const error = new Error('Sportsnet teams endpoint nevrátil validné JSON dáta.');
    error.status = 502;
    error.cause = cause;
    throw error;
  }

  const teamsList = Array.isArray(teamsPayload.teams) ? teamsPayload.teams : [];

  // Step 2: For each team, fetch its squads and map
  const teams = {};

  for (const team of teamsList) {
    const category = detectTeamCategory(team);
    if (!category) continue;

    // Try to get squad data from the team object directly if available
    let athletes = [];
    let crew = [];

    if (Array.isArray(team.athletes) && team.athletes.length > 0) {
      athletes = team.athletes;
    } else {
      // Fetch squads endpoint for this team
      const squadsUrl = `${apiBase}/admin/${encodeURIComponent(appSpace)}/teams/${encodeURIComponent(team._id)}/squads`;
      try {
        const squadsResponse = await fetch(squadsUrl, { method: 'GET', headers });
        if (squadsResponse.ok) {
          const squadsPayload = await squadsResponse.json();
          const items = Array.isArray(squadsPayload.items) ? squadsPayload.items : [];
          // Use the most recent squad (last one or sorted by validFrom)
          if (items.length > 0) {
            const latestSquad = items.sort((a, b) => {
              return new Date(b.validFrom || 0) - new Date(a.validFrom || 0);
            })[0];
            athletes = latestSquad.athletes || [];
            crew = latestSquad.crew || [];
          }
        }
      } catch (_) {
        // Skip squad fetch errors; we'll have empty roster
      }
    }

    const mappedAthletes = athletes.map(mapAthlete);
    const mappedCrew = (crew || []).map((c) => ({
      sportnetId: c.sportnetUser ? c.sportnetUser._id : null,
      name: c.sportnetUser ? c.sportnetUser.name : 'Neznámy',
      position: c.position || 'Tréner'
    }));

    teams[category] = {
      teamId: team._id,
      name: team.displayName || team.name,
      players: mappedAthletes,
      playersByPosition: groupByPosition(mappedAthletes),
      crew: mappedCrew,
      count: mappedAthletes.length
    };
  }

  const normalized = {
    source: 'sportsnet-players.online',
    fetchedAt: new Date().toISOString(),
    teams
  };

  const cacheTtl = Math.max(0, env.sportnetPlayersCacheSeconds || 0) * 1000;
  cacheState.payload = normalized;
  cacheState.expiresAt = now + cacheTtl;

  return {
    ...normalized,
    cache: 'MISS'
  };
}

module.exports = {
  fetchSportsnetPlayers
};
