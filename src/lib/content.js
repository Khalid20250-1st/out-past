import { GAI_WORKER_URL } from '../config.js'
// Content engine. Each topic holds a big roster of well-known people (search
// seeds). Generate picks a RANDOM person (never the same one twice in a row),
// searches their videos on that topic, and shows one. So you draw from 100+
// people per topic, not one person's deck. $0, keyless (see main content:search).

export const TOPICS = [
  { id: 'discipline', label: 'Discipline & Mindset', emoji: '🔥' },
  { id: 'procrastination', label: 'Beat Procrastination', emoji: '⏰' },
  { id: 'business', label: 'Build a Business', emoji: '🏗️' },
  { id: 'money', label: 'Money & Wealth', emoji: '💰' },
  { id: 'marketing', label: 'Marketing', emoji: '📣' },
  { id: 'sales', label: 'Sales & Closing', emoji: '🤝' },
  { id: 'leadership', label: 'Leadership', emoji: '👑' },
  { id: 'documentaries', label: 'Founder Stories', emoji: '🎬' },
  { id: 'ai', label: 'AI & Tools', emoji: '🤖' }
]

// Keyword appended to each seed to keep the search on-topic.
export const TOPIC_Q = {
  discipline: 'motivation', procrastination: 'productivity', business: 'business advice',
  money: 'wealth', marketing: 'marketing', sales: 'sales', leadership: 'leadership',
  documentaries: 'documentary', ai: 'tutorial'
}

// On-topic words per section. After a search we keep only videos whose TITLE
// contains one of these (whole-word match), so a marketing section only ever
// shows marketing, even if a loose name sneaks in. Falls back to unfiltered if
// nothing matches, so a section never goes empty.
export const TOPIC_KEYWORDS = {
  discipline: ['discipline', 'disciplined', 'mindset', 'motivation', 'motivated', 'motivational', 'habit', 'habits', 'mental', 'focus', 'consistency', 'consistent', 'grind', 'stoic', 'stoicism', 'tough', 'toughness', 'excuses', 'comfort', 'success', 'successful', 'grit', 'willpower', 'mentality', 'discipline'],
  procrastination: ['procrastination', 'procrastinate', 'productivity', 'productive', 'focus', 'habit', 'habits', 'time', 'distraction', 'distractions', 'lazy', 'laziness', 'discipline', 'deep', 'routine', 'system', 'systems', 'motivation'],
  business: ['business', 'businesses', 'startup', 'startups', 'entrepreneur', 'entrepreneurship', 'company', 'scale', 'scaling', 'founder', 'build', 'building', 'revenue', 'profit', 'sell', 'strategy', 'grow', 'growth', 'money', 'brand', 'ceo', 'hustle'],
  money: ['money', 'wealth', 'wealthy', 'invest', 'investing', 'investment', 'investments', 'finance', 'financial', 'rich', 'cash', 'stock', 'stocks', 'income', 'save', 'saving', 'savings', 'budget', 'networth', 'worth', 'asset', 'assets', 'portfolio', 'million', 'millionaire', 'dividend', 'crypto', 'tax', 'taxes', 'debt', 'passive'],
  marketing: ['marketing', 'market', 'brand', 'branding', 'ad', 'ads', 'advertising', 'advertise', 'funnel', 'funnels', 'copywriting', 'copy', 'seo', 'campaign', 'campaigns', 'positioning', 'offer', 'offers', 'audience', 'content', 'customer', 'customers', 'social', 'leads', 'conversion', 'viral'],
  sales: ['sales', 'sell', 'selling', 'sale', 'closing', 'close', 'closer', 'objection', 'objections', 'negotiation', 'negotiate', 'prospecting', 'prospect', 'cold', 'pitch', 'pitching', 'deal', 'deals', 'client', 'clients', 'quota', 'revenue', 'persuasion', 'persuade'],
  leadership: ['leader', 'leaders', 'leadership', 'manage', 'management', 'manager', 'team', 'teams', 'culture', 'lead', 'leading', 'influence', 'ownership', 'vision', 'coach', 'coaching', 'decision', 'decisions', 'accountability', 'mentor', 'executive'],
  documentaries: ['story', 'documentary', 'history', 'founder', 'founders', 'built', 'building', 'rise', 'fall', 'empire', 'billion', 'billionaire', 'company', 'startup', 'brand', 'inside', 'origin', 'how', 'created', 'collapse', 'downfall', 'success'],
  ai: ['ai', 'chatgpt', 'gpt', 'claude', 'openai', 'automation', 'automate', 'automating', 'agent', 'agents', 'prompt', 'prompts', 'prompting', 'nocode', 'llm', 'machine', 'learning', 'tool', 'tools', 'tutorial', 'coding', 'code', 'cursor', 'midjourney', 'n8n', 'zapier', 'workflow', 'workflows']
}
export function matchesTopic(title, topicId) {
  const kws = TOPIC_KEYWORDS[topicId]
  if (!kws) return true
  const words = new Set((title || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean))
  return kws.some((k) => words.has(k))
}

// Rosters — well-known people / channels per topic (the pool Generate draws from).
export const PEOPLE = {
  discipline: ['David Goggins', 'Jocko Willink', 'Andrew Huberman', 'Jordan Peterson', 'Tony Robbins', 'Eric Thomas', 'Les Brown', 'Ed Mylett', 'Andy Frisella', 'Chris Williamson', 'Cameron Hanes', 'Wim Hof', 'Kobe Bryant', 'Michael Jordan', 'Arnold Schwarzenegger', 'Denzel Washington', 'Will Smith', 'Matthew McConaughey', 'Conor McGregor', 'Mike Tyson', 'Muhammad Ali', 'Ryan Holiday', 'Robin Sharma', 'Brian Tracy', 'Jim Rohn', 'Zig Ziglar', 'Wayne Dyer', 'Mel Robbins', 'Jay Shetty', 'Tom Bilyeu', 'Lewis Howes', 'Rich Roll', 'David Sinclair', 'Marcus Aurelius stoicism', 'Ryan Serhant', 'Goggins never finished', 'Sadhguru', 'Nick Bare', 'Steven Bartlett', 'Alex Hormozi', 'Gary Vaynerchuk', 'Simon Sinek', 'Joe Rogan', 'Chris Bumstead', 'Rich Froning', 'Kai Greene', 'Ronnie Coleman', 'Bruce Lee philosophy', 'Elliott Hulse', 'Hamza']
  ,
  procrastination: ['Tim Urban', 'Andrew Huberman', 'Mel Robbins', 'Ali Abdaal', 'Thomas Frank', 'Matt D\'Avella', 'Cal Newport', 'James Clear', 'Nir Eyal', 'BJ Fogg', 'Charles Duhigg', 'Tim Ferriss', 'Chris Bailey', 'Nathaniel Drew', 'Better Ideas', 'David Allen GTD', 'Jim Kwik', 'Jordan Peterson', 'Mark Manson', 'Struthless', 'Better Than Yesterday', 'Improvement Pill', 'Freedom in Thought', 'Justin Sung', 'Ali Abdaal deep work', 'Cal Newport deep work', 'Andrew Kirby', 'Chris Williamson', 'Mel Robbins 5 second rule', 'Brian Tracy eat that frog', 'Robin Sharma 5am', 'Dan Koe', 'Hamza', 'Iman Gadzhi discipline', 'Thomas Frank focus', 'Matt D\'Avella habits']
  ,
  business: ['Alex Hormozi', 'Gary Vaynerchuk', 'Steve Jobs', 'Elon Musk', 'Jeff Bezos', 'Richard Branson', 'Sara Blakely', 'Daymond John', 'Mark Cuban', 'Barbara Corcoran', 'Kevin O\'Leary', 'Peter Thiel', 'Paul Graham', 'Sam Altman', 'Naval Ravikant', 'Codie Sanchez', 'Patrick Bet-David', 'Grant Cardone', 'Robert Kiyosaki', 'Tai Lopez', 'Ramit Sethi', 'Noah Kagan', 'Marie Forleo', 'Tim Ferriss', 'Reid Hoffman', 'Ben Horowitz', 'Marc Andreessen', 'Guy Raz how I built this', 'Simon Squibb', 'Steven Bartlett', 'Y Combinator startup', 'Leila Hormozi', 'Iman Gadzhi', 'Dan Martell', 'Russell Brunson', 'Ali Abdaal business', 'Warren Buffett business', 'Jack Ma', 'Ray Dalio principles', 'Bill Gates', 'Michael Dell', 'Howard Schultz', 'Phil Knight', 'Reed Hastings', 'Brian Chesky', 'Tobi Lutke', 'Dharmesh Shah', 'Rob Dyrdek', 'Codie Sanchez boring business', 'Myron Golden']
  ,
  money: ['Naval Ravikant', 'Warren Buffett', 'Charlie Munger', 'Ray Dalio', 'Robert Kiyosaki', 'Dave Ramsey', 'Graham Stephan', 'Andrei Jikh', 'Meet Kevin', 'Ramit Sethi', 'Codie Sanchez', 'Patrick Bet-David', 'Grant Cardone', 'Peter Lynch', 'Benjamin Graham', 'Tony Robbins money', 'Morgan Housel', 'George Kamel', 'Ben Felix', 'Nick Maggiulli', 'Mark Cuban', 'Kevin O\'Leary', 'Jaspreet Singh Minority Mindset', 'Humphrey Yang', 'The Plain Bagel', 'Ken McElroy', 'Grant Sabatier', 'Vivian Tu', 'Tori Dunlap', 'Alex Hormozi money', 'Chris Hogan', 'Aswath Damodaran', 'Mohnish Pabrai', 'Guy Spier', 'Howard Marks', 'Cathie Wood', 'Robert Greene power', 'Gary Vaynerchuk money', 'Tom Bilyeu money', 'BiggerPockets', 'Coffeezilla', 'Nate O\'Brien', 'Minority Mindset', 'Chris Sain', 'Sallie Krawcheck']
  ,
  marketing: ['Seth Godin', 'Gary Vaynerchuk', 'Neil Patel', 'Alex Hormozi', 'Russell Brunson', 'Donald Miller', 'Ann Handley', 'Rand Fishkin', 'Marie Forleo', 'Amy Porterfield', 'Pat Flynn', 'Brendon Burchard', 'Grant Cardone', 'Sabri Suby', 'Dan Kennedy', 'David Ogilvy', 'Simon Sinek', 'Ryan Deiss', 'Eugene Schwartz', 'Alex Cattoni', 'Vanessa Lau', 'Adam Erhart', 'HubSpot marketing', 'Gary Vee attention', 'Iman Gadzhi agency', 'Charlie Morgan', 'Sabri Suby scaling', 'Codie Sanchez marketing', 'Marketing Against the Grain', 'Storybrand', 'Kipp Bodnar', 'April Dunford positioning', 'Seth Godin purple cow', 'Dan Martell marketing', 'Nick Theriot']
  ,
  sales: ['Grant Cardone', 'Jordan Belfort', 'Brian Tracy', 'Zig Ziglar', 'Jeb Blount', 'Jeffrey Gitomer', 'Chris Voss', 'Alex Hormozi', 'Andy Elliott', 'Jeremy Miner', 'Dan Lok', 'Patrick Bet-David', 'Tom Hopkins', 'Blair Singer', 'Grant Cardone closing', 'Jordan Belfort straight line', 'Chris Voss negotiation', 'Victor Antonio', 'Ryan Serhant', 'Sandler sales', 'Cardone objections', 'Jeremy Miner NEPQ', 'Andy Elliott closing', 'Sell it like Serhant', 'Dan Lok high ticket', 'Myron Golden sales', 'Bob Burg', 'Marcus Sheridan', 'Deb Calvert', 'Mark Hunter']
  ,
  leadership: ['Simon Sinek', 'Jocko Willink', 'John Maxwell', 'Brené Brown', 'Robin Sharma', 'Patrick Lencioni', 'Ray Dalio', 'Jeff Bezos', 'Satya Nadella', 'Steve Jobs', 'Bill Gates', 'Indra Nooyi', 'Sheryl Sandberg', 'Adam Grant', 'Marshall Goldsmith', 'Simon Sinek infinite game', 'General Stanley McChrystal', 'Bill Campbell trillion dollar coach', 'Jim Collins good to great', 'Ben Horowitz', 'Reed Hastings culture', 'Ray Dalio principles', 'Colin Powell leadership', 'Jocko extreme ownership', 'Craig Groeschel leadership', 'David Marquet', 'Liz Wiseman', 'Amy Edmondson', 'Daniel Goleman', 'Robin Sharma leader who had no title']
  ,
  documentaries: ['Instagram', 'YouTube company', 'Airbnb', 'Nike', 'Netflix', 'Apple', 'Amazon', 'Tesla', 'Google', 'Facebook Meta', 'Uber', 'Spotify', 'Starbucks', 'McDonald\'s', 'Coca-Cola', 'Disney', 'Microsoft', 'SpaceX', 'Stripe', 'Shopify', 'WhatsApp', 'Snapchat', 'Reddit', 'Dropbox', 'Slack', 'Zoom', 'Robinhood', 'Coinbase', 'Red Bull', 'Rolex', 'Lego', 'Ferrari', 'Lamborghini', 'Supreme brand', 'Gymshark', 'Duolingo', 'Notion app', 'Canva', 'Revolut', 'Monzo', 'Klarna', 'OpenAI', 'Nvidia', 'IKEA', 'Toyota', 'Rockstar Games', 'PayPal', 'Twitter', 'TikTok', 'WeWork']
  ,
  ai: ['Claude AI', 'ChatGPT', 'n8n automation', 'Make.com', 'Zapier', 'Midjourney', 'Perplexity AI', 'Cursor AI', 'Notion AI', 'AI automation agency', 'AI agents', 'prompt engineering', 'Matthew Berman', 'Riley Brown', 'David Ondrej', 'Liam Ottley', 'Nick Saraev', 'Wes Roth', 'MattVidPro', 'AI Foundations', 'Julian Goldie AI', 'Income stream surfers AI', 'AI Jason', 'Fireship AI', 'Greg Isenberg AI', 'The AI Advantage', 'Skill Leap AI', 'Corbin Brown AI', 'All About AI', 'Helena Liu AI', 'ChatGPT for business', 'Claude Code', 'automate business with AI', 'AI side hustle', 'build AI agent', 'no code AI app']
}

// Curated fallback (used only if the internet search fails).
export const LIBRARY = {
  discipline: [{ id: 'aIVvx9kNOqw', title: 'Discipline Your Mind', channel: 'David Goggins' }],
  procrastination: [{ id: 'Rk5C149J9C0', title: 'Why You Procrastinate', channel: 'Tim Urban · TED' }],
  business: [{ id: 'xDkAbAP5_wI', title: 'How To Start Your First Business', channel: 'Alex Hormozi' }],
  money: [{ id: '6Mya4C3Yr7I', title: 'How To Get Rich Without Luck', channel: 'Naval Ravikant' }],
  marketing: [{ id: 'kQ9w8drft-s', title: 'This Is Marketing', channel: 'Seth Godin' }],
  sales: [{ id: 'gjHv4pM8WEQ', title: 'Watch Me Close on the Phone', channel: 'Grant Cardone' }],
  leadership: [{ id: 'qp0HIF3SfI4', title: 'How Great Leaders Inspire Action', channel: 'Simon Sinek · TED' }],
  documentaries: [{ id: 'bglIiiGj8Bs', title: 'The Insane Story of Instagram', channel: 'Documentary' }],
  ai: [{ id: 'CTy6Nutj1ZE', title: 'How to Use Claude AI for Business', channel: 'Tutorial' }]
}

export function thumbFor(id) { return `https://img.youtube.com/vi/${id}/hqdefault.jpg` }

// Search order: official YouTube Data API via the Worker (reliable, cached, real
// dates) → keyless scrape in the main process (fallback) → nothing. The API key
// lives only on the Worker; if it's not set yet the Worker returns empty and we
// fall straight to the scrape, so the app keeps working either way.
const WORKER_URL = GAI_WORKER_URL
export async function searchVideos(query) {
  // With a worker configured, try the keyed YouTube Data API first. Without one,
  // skip straight to the keyless in-process scrape, so search still works.
  if (WORKER_URL) {
    try {
      const res = await fetch(WORKER_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'ytsearch', query }) })
      const data = await res.json()
      if (data && Array.isArray(data.videos) && data.videos.length) return data.videos
    } catch (e) {}
  }
  try { const r = await window.kd.content.search(query); if (r && r.length) return r } catch (e) {}
  return []
}
