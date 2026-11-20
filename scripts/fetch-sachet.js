// Saves the NDMA SACHET public CAP alert feed (IMD and other agencies) to data/sachet.json. The feed blocks
// browser requests (no CORS), so a scheduled GitHub Action runs this and commits the copy to the site.
// Run: npm run fetch-sachet
import { writeFile } from 'node:fs/promises';

const FEED = 'https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml';
const xml = await (await fetch(FEED, { headers: { 'User-Agent': 'surgeforce-hackathon/0.5' }, signal: AbortSignal.timeout(60000) })).text();
const tag = (s, t) => (s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? '';
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, s]) => {
  const sender = (tag(s, 'author').match(/\(([^)]+)\)/) || [])[1] || tag(s, 'author');
  const title = tag(s, 'title');
  return { title, category: tag(s, 'category'), sender, link: tag(s, 'link'), time: new Date(tag(s, 'pubDate')).toISOString(),
    telangana: /telangana|hyderabad|rangareddy|medchal|sangareddy/i.test(`${title} ${sender}`) };
});
if (!items.length) throw new Error('SACHET feed returned no items');
await writeFile(new URL('../data/sachet.json', import.meta.url), JSON.stringify({ fetchedAt: new Date().toISOString(), source: FEED, items }));
console.log(`${items.length} alerts, ${items.filter((i) => i.telangana).length} for Telangana`);
