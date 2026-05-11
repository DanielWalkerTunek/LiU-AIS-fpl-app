export const handler = async (event) => {
  const fplPath = event.queryStringParameters?.path || '';
  const fplUrl = `https://fantasy.premierleague.com/api/${fplPath}`;

  try {
    const res = await fetch(fplUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://fantasy.premierleague.com/',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    });

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `FPL API returned ${res.status}` }),
      };
    }

    const data = await res.text();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=180',
      },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
