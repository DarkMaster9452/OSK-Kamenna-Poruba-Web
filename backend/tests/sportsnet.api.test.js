const request = require('supertest');

jest.mock('dotenv', () => ({
  config: jest.fn()
}));

function setSportsnetEnv() {
  process.env.NODE_ENV = 'test';
  process.env.SPORTNET_API_BASE = 'https://api.sportsnet.test';
  process.env.SPORTNET_ORG_ID = '54b532721c6198f161840003';
  process.env.SPORTNET_API_KEY = 'test-api-key';
  process.env.SPORTSNET_API_URL = '';
  process.env.SPORTSNET_API_KEY = '';
  process.env.SPORTSNET_TEAM_ID = '1234';
  process.env.SPORTSNET_COMPETITION_ID = '9876';
  process.env.SPORTSNET_SEASON = '2025-2026';
  process.env.SPORTSNET_CACHE_SECONDS = '120';
}

function createFetchResponse(body, status = 200) {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText
  };
}

async function loadApp() {
  jest.resetModules();
  return require('../src/app');
}

describe('GET /api/sportsnet/matches', () => {
  beforeEach(() => {
    setSportsnetEnv();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('načíta údaje zo Sportsnet API a normalizuje odpoveď', async () => {
    global.fetch.mockResolvedValue(
      createFetchResponse({
        items: [
          {
            id: 77,
            startsAt: '2026-03-01T16:00:00Z',
            status: 'finished',
            homeTeamName: 'OŠK Kamenná Poruba',
            awayTeamName: 'FK Test',
            scoreHome: 2,
            scoreAway: 1,
            venue: 'Domáci štadión'
          }
        ]
      })
    );

    const app = await loadApp();
    const response = await request(app).get('/api/sportsnet/matches');

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('sportsnet.online');
    expect(response.body.count).toBe(1);
    expect(response.body.cache).toBe('MISS');
    expect(response.body.items[0]).toMatchObject({
      id: '77',
      status: 'finished',
      homeTeam: 'OŠK Kamenná Poruba',
      awayTeam: 'FK Test',
      scoreHome: 2,
      scoreAway: 1,
      venue: 'Domáci štadión'
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/organizations/54b532721c6198f161840003/matches');
    expect(url).toContain('teamIds=1234');
    expect(url).toContain('competitionId=9876');
    expect(url).toContain('seasonName=2025-2026');
    expect(options).toMatchObject({
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'ApiKey test-api-key'
      }
    });
  });

  test('vráti cache HIT pri opakovanom volaní bez refresh parametra', async () => {
    global.fetch.mockResolvedValue(
      createFetchResponse({
        items: [
          {
            id: 'abc',
            startsAt: '2026-03-02T17:00:00Z',
            homeTeamName: 'Domáci',
            awayTeamName: 'Hostia'
          }
        ]
      })
    );

    const app = await loadApp();
    const firstResponse = await request(app).get('/api/sportsnet/matches');
    const secondResponse = await request(app).get('/api/sportsnet/matches');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.cache).toBe('MISS');
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.cache).toBe('HIT');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('refresh=true obíde cache a vynúti nové volanie Sportsnet API', async () => {
    global.fetch
      .mockResolvedValueOnce(
        createFetchResponse({
          items: [
            {
              id: 1,
              startsAt: '2026-03-03T18:00:00Z',
              homeTeamName: 'A',
              awayTeamName: 'B'
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createFetchResponse({
          items: [
            {
              id: 2,
              startsAt: '2026-03-03T18:30:00Z',
              homeTeamName: 'C',
              awayTeamName: 'D'
            }
          ]
        })
      );

    const app = await loadApp();
    const firstResponse = await request(app).get('/api/sportsnet/matches');
    const refreshedResponse = await request(app).get('/api/sportsnet/matches?refresh=true');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.items[0].id).toBe('1');
    expect(refreshedResponse.status).toBe(200);
    expect(refreshedResponse.body.items[0].id).toBe('2');
    expect(refreshedResponse.body.cache).toBe('MISS');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('pri chybe Sportsnet API vráti backend status 502', async () => {
    global.fetch.mockResolvedValue(createFetchResponse({ error: 'upstream failure' }, 503));

    const app = await loadApp();
    const response = await request(app).get('/api/sportsnet/matches');

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      message: expect.stringContaining('Sportsnet API vrátilo status 503')
    });
  });

  test('pri sieťovej chybe na Sportsnet endpoint vráti backend status 502', async () => {
    global.fetch.mockRejectedValue(new Error('fetch failed'));

    const app = await loadApp();
    const response = await request(app).get('/api/sportsnet/matches');

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      message: expect.stringContaining('Nepodarilo sa pripojiť na Sportsnet API endpoint.')
    });
  });

  test('pri HTML odpovedi zo Sportsnet endpointu vráti backend status 502', async () => {
    global.fetch.mockResolvedValue(createFetchResponse('<!DOCTYPE html><html><body>Error page</body></html>', 200));

    const app = await loadApp();
    const response = await request(app).get('/api/sportsnet/matches');

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      message: expect.stringContaining('Sportsnet endpoint nevrátil validné JSON dáta.')
    });
  });

  test('bez nakonfigurovaného Sportsnet endpointu vráti prázdnu odpoveď bez volania API', async () => {
    process.env.SPORTNET_API_BASE = '';
    process.env.SPORTSNET_API_BASE = '';
    process.env.SPORTNET_API_URL = '';
    process.env.SPORTSNET_API_URL = '';

    const app = await loadApp();
    const response = await request(app).get('/api/sportsnet/matches');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: 'sportsnet.unconfigured',
      count: 0,
      items: [],
      cache: 'BYPASS'
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
