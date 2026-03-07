async function getLeagues(apiBase) {
  const url = new URL('/api/leagues', apiBase);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getRank(apiBase, league, character) {
  const url = new URL('/api/overlay/rank', apiBase);
  url.searchParams.set('league', league);
  url.searchParams.set('character', character);

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));

  if (res.status === 404) return { error: data.error || 'Character not found', notFound: true };
  if (res.status === 429) return { error: 'Rate limited — waiting', rateLimited: true };
  if (res.status === 400) return { error: data.error || 'Bad request' };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  return data;
}

module.exports = { getLeagues, getRank };
