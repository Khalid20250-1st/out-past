// KB — Kidus Brain
// A brain baked inside Out Past. Distilled lessons from 40+ respected people, kept
// as plain text. KAI (Grow AI) answers from this brain with pure code:
//   1. match the question to a lesson (intent + synonyms, no AI)
//   2. read the user's real calendar numbers (no AI)
//   3. assemble a sharp, personalized hit (no AI)
// Cost of a KB answer = $0. KAI only calls the paid AI when KB has NOTHING
// on the topic (a true miss). No lazy middle tier.

import { analyzeDay, analyzeRange, lastNDays } from './analysis.js'
import { fmtDuration, fmtTime } from './format.js'

// ---- the brain ------------------------------------------------------------
// Each entry: person, source, tags (canonical topics), triggers (phrases users
// actually type), lesson (the teaching, spoken in the person's spirit), action
// (one concrete step). Multiple entries can share a topic from different giants.

export const KB = [
  // ---- discipline / mental toughness ----
  { person: 'David Goggins', source: "Can't Hurt Me",
    tags: ['quit','discipline','pain','motivation','hard','weak','give up'],
    triggers: ['want to quit','feel like quitting','give up','too hard','can\'t do it','wanna quit','so hard'],
    lesson: "When your mind says you're done, you're only at about 40 percent of what you can actually give. The urge to quit shows up long before your real limit.",
    action: "Push past the first wave of pain. Do 10 more minutes than you wanted to. That's where the growth lives." },

  { person: 'Jocko Willink', source: 'Discipline Equals Freedom',
    tags: ['discipline','motivation','routine','early','wake','structure'],
    triggers: ['no motivation','not motivated','need motivation','discipline','wake up early','can\'t wake up'],
    lesson: "Don't wait for motivation. Motivation is unreliable, it comes and goes. Discipline is what shows up every single day whether you feel like it or not.",
    action: "Pick the time you'll start tomorrow and make it non-negotiable. Set the alarm across the room. Get up. Go." },

  { person: 'Marcus Aurelius', source: 'Meditations',
    tags: ['control','worry','anxiety','stress','overwhelm','stoic'],
    triggers: ['stressed','anxious','worried','overwhelmed','too much','can\'t handle'],
    lesson: "You don't control what happens, only how you respond. Waste no energy on what is outside your power, and pour everything into what is.",
    action: "Write down the one thing in front of you that you can act on right now. Ignore the rest until it's done." },

  { person: 'Ryan Holiday', source: 'The Obstacle Is the Way',
    tags: ['obstacle','problem','stuck','fear','blocked'],
    triggers: ['i\'m stuck','stuck','obstacle','in my way','blocked','can\'t get past'],
    lesson: "The thing blocking your path is the path. The obstacle isn't in the way of the work, it is the work. Every problem is training.",
    action: "Name the obstacle out loud, then ask: what's the first small move through it? Make that move today." },

  { person: 'Kobe Bryant', source: 'Mamba Mentality',
    tags: ['excellence','effort','best','obsession','work','greatness'],
    triggers: ['be the best','get better','improve','be great','mamba','level up'],
    lesson: "Greatness isn't a switch you flip. It's the boring, obsessive repetition of the fundamentals while everyone else is asleep. The work is the reward.",
    action: "Show up early. Do the rep nobody sees. Repeat it until it's automatic." },

  { person: 'Angela Duckworth', source: 'Grit',
    tags: ['consistency','persistence','grit','long term','stick'],
    triggers: ['keep going','stay consistent','stick with it','long term','don\'t give up'],
    lesson: "Talent is common. What's rare is grit, the stamina to chase one goal for years, not weeks. Passion plus perseverance beats raw ability every time.",
    action: "Pick one goal and commit to showing up for it daily for the next 30 days. No skipping." },

  { person: 'William McRaven', source: 'Make Your Bed',
    tags: ['start','small','morning','habit','win'],
    triggers: ['where do i start','how to start','first step','small win','morning routine'],
    lesson: "If you want to change the world, start by making your bed. One small task done well gives you a win, and wins compound into a day, then a life.",
    action: "Complete one tiny task perfectly right now. Bed, dishes, one email. Feel the first win, then chain it." },

  // ---- consistency / habits ----
  { person: 'James Clear', source: 'Atomic Habits',
    tags: ['procrastination','habit','start','small','consistency','system'],
    triggers: ['procrastinate','procrastinating','putting off','can\'t start','keep delaying','lazy','always late'],
    lesson: "You don't rise to the level of your goals, you fall to the level of your systems. Make the habit so small you can't say no, then let it grow.",
    action: "Shrink the task to two minutes. Just start. Two minutes of the thing beats an hour of planning it." },

  { person: 'James Clear', source: 'Atomic Habits',
    tags: ['identity','who','change','consistency'],
    triggers: ['who i am','change myself','become','new person','identity'],
    lesson: "Every action is a vote for the person you want to become. You don't need to be perfect, you need to prove your new identity with small daily reps.",
    action: "Ask 'what would a disciplined person do right now?' then do that one thing. Cast the vote." },

  { person: 'BJ Fogg', source: 'Tiny Habits',
    tags: ['habit','small','build','routine','stack'],
    triggers: ['build a habit','new habit','make it stick','routine','how to be consistent'],
    lesson: "Big change comes from tiny habits anchored to things you already do. Celebrate the small win the instant you do it, and your brain wires it in.",
    action: "Attach the new habit to an existing one: 'after I pour my coffee, I write one line.' Start absurdly small." },

  { person: 'Darren Hardy', source: 'The Compound Effect',
    tags: ['consistency','small','compound','patience','results'],
    triggers: ['no results','not seeing results','slow progress','giving up','nothing changing','start strong','starting strong','strong then','die by','lose steam','lose momentum','fall off','fade out','fizzle','fizzle out','burn out midweek','can\'t keep it up','can\'t stay consistent','lose steam by'],
    lesson: "Small, smart choices plus consistency plus time equals radical difference. The results are invisible for a while, then they explode. Don't quit before the compound hits.",
    action: "Keep doing the small right thing for 90 more days before you judge it. The curve is coming." },

  { person: 'Jerry Seinfeld', source: "Don't Break the Chain",
    tags: ['consistency','daily','streak','habit'],
    triggers: ['every day','daily habit','keep the streak','stay consistent','skip a day'],
    lesson: "Do the work every day and mark an X on the calendar. Soon you have a chain. Your only job is: don't break the chain.",
    action: "Do the smallest version today so the chain survives. Never miss twice in a row." },

  // ---- focus / distraction ----
  { person: 'Cal Newport', source: 'Deep Work',
    tags: ['focus','distraction','deep','phone','concentrate','attention'],
    triggers: ['can\'t focus','distracted','distractions','phone','concentrate','keep getting distracted','social media'],
    lesson: "The ability to focus without distraction on one hard thing is becoming rare, and rare things are valuable. Shallow busyness is the enemy of deep results.",
    action: "Block 60 minutes, phone in another room, one task only. Protect that hour like it's your job. It is." },

  { person: 'Andrew Huberman', source: 'Huberman Lab',
    tags: ['focus','dopamine','distraction','phone','reward','scrolling'],
    triggers: ['addicted to phone','scrolling','no dopamine','can\'t focus','bored','instant gratification'],
    lesson: "Cheap dopamine from your phone rewires you to crave the easy hit and drop the hard work. Earn dopamine from effort and your drive comes back.",
    action: "Do the hard task first, before the phone. Let the reward come after the work, not before." },

  { person: 'Nir Eyal', source: 'Indistractable',
    tags: ['distraction','focus','trigger','avoid','discomfort'],
    triggers: ['keep getting distracted','avoid work','why do i get distracted','escape','uncomfortable'],
    lesson: "Distraction isn't about the phone, it's about escaping discomfort. You reach for the phone to run from a feeling. Master the feeling and you master focus.",
    action: "Next time you drift, name the discomfort you're avoiding. Sit with it for 10 seconds, then return to the task." },

  // ---- fear / confidence / doubt ----
  { person: 'Mel Robbins', source: 'The 5 Second Rule',
    tags: ['fear','doubt','hesitate','overthink','courage','act'],
    triggers: ['scared','afraid','overthinking','hesitate','doubt myself','nervous','can\'t decide'],
    lesson: "The moment you feel the pull to act, you have about 5 seconds before your brain talks you out of it. Count down 5-4-3-2-1 and move before fear wins.",
    action: "Count 5-4-3-2-1 and take the physical first step right now, before you can think yourself out of it." },

  { person: 'Brené Brown', source: 'Daring Greatly',
    tags: ['fear','vulnerable','failure','shame','courage','judged'],
    triggers: ['afraid to fail','scared of judgment','not good enough','embarrassed','vulnerable'],
    lesson: "Courage and comfort can't coexist. The willingness to show up and be seen, without a guarantee it works, is the birthplace of everything that matters.",
    action: "Do the brave thing at small scale today. Send it. Share it. Ask. Let it be imperfect." },

  { person: 'Tony Robbins', source: 'Awaken the Giant Within',
    tags: ['motivation','stuck','change','decision','power','state'],
    triggers: ['feel stuck','need a push','change my life','no energy','unmotivated','lost'],
    lesson: "It's in your moments of decision that your destiny is shaped. Change happens the second you make a true decision and back it with immediate action.",
    action: "Decide right now, out loud, what you're doing, and take one action in the next 5 minutes to lock it in." },

  { person: 'Carol Dweck', source: 'Mindset',
    tags: ['failure','learning','growth','mistake','can\'t','yet'],
    triggers: ['i failed','bad at this','not talented','can\'t do it','made a mistake','not smart'],
    lesson: "You're not bad at it, you're bad at it yet. A growth mindset treats every failure as data, not a verdict. Ability grows with effort.",
    action: "Add the word 'yet' to your complaint. Then find the one lesson in the last failure and apply it now." },

  // ---- purpose / meaning / direction ----
  { person: 'Simon Sinek', source: 'Start With Why',
    tags: ['why','purpose','meaning','direction','lost','goal'],
    triggers: ['no purpose','why bother','what\'s the point','lost','no direction','no goals'],
    lesson: "People don't burn out from doing too much, they burn out from doing too much of what doesn't matter. Start with why, and the how gets easier.",
    action: "Write one sentence: why this goal matters to you. Read it before every session. Let it pull you." },

  { person: 'Viktor Frankl', source: "Man's Search for Meaning",
    tags: ['meaning','suffering','purpose','hard','why','pain'],
    triggers: ['what\'s the point','suffering','why me','no meaning','hopeless','pointless'],
    lesson: "Those who have a why to live can bear almost any how. Meaning isn't found in comfort, it's forged in how you carry the hard thing.",
    action: "Connect today's hard task to someone or something you love. Do it for that reason." },

  { person: 'Jim Rohn', source: 'The Art of Exceptional Living',
    tags: ['discipline','growth','self','habit','change','goal'],
    triggers: ['change my life','become better','self improvement','grow','who i become'],
    lesson: "Success is a few simple disciplines practiced every day. Don't wish it were easier, wish you were better. Work harder on yourself than on your job.",
    action: "Pick one discipline to run daily this week: reading, training, or your craft. Guard it." },

  // ---- money / business / entrepreneurship ----
  { person: 'Alex Hormozi', source: '$100M Offers',
    tags: ['business','money','offer','value','sell','clients'],
    triggers: ['grow my business','make money','get clients','sell more','my offer','no sales'],
    lesson: "You don't have a money problem, you have a value problem. Make an offer so good people feel stupid saying no, then tell more people about it.",
    action: "List the top 3 outcomes your work delivers, then make your offer about those, not your features." },

  { person: 'Naval Ravikant', source: 'The Almanack of Naval',
    tags: ['money','wealth','leverage','business','freedom','work'],
    triggers: ['get rich','build wealth','make money','financial freedom','leverage'],
    lesson: "You won't get rich renting out your time. Build or buy equity, get leverage through code, media, or capital, and get paid for the value you create while you sleep.",
    action: "Ask: what can I build once that keeps paying? Spend 30 minutes on that asset today." },

  { person: 'Warren Buffett', source: 'letters & interviews',
    tags: ['money','patience','long term','invest','discipline','wealth'],
    triggers: ['invest','save money','get rich quick','patience','long term wealth'],
    lesson: "The stock market is a device for transferring money from the impatient to the patient. Wealth is built slowly, by people who don't need to look smart today.",
    action: "Make one boring, patient money decision today and let it compound. Skip the get-rich-quick noise." },

  { person: 'Gary Vaynerchuk', source: 'Crush It',
    tags: ['business','patience','work','hustle','content','brand'],
    triggers: ['want it now','impatient','build a brand','start a business','post content'],
    lesson: "Be patient with the vision and impatient with the actions. Micro-speed, macro-patience. Put in absurd work now and stop expecting the result tomorrow.",
    action: "Ship one piece of work publicly today. Volume beats perfection. Then do it again tomorrow." },

  { person: 'Robert Kiyosaki', source: 'Rich Dad Poor Dad',
    tags: ['money','assets','financial','wealth','freedom'],
    triggers: ['financial freedom','assets','make money work','get out of debt','build wealth'],
    lesson: "The rich buy assets that put money in their pocket. The poor and middle class buy liabilities they think are assets. Learn the difference and act on it.",
    action: "Identify one asset you could start building this month and take the first step toward it." },

  { person: 'Sara Blakely', source: 'Spanx founder talks',
    tags: ['failure','fear','start','business','risk'],
    triggers: ['afraid to start','fear of failure','what if it fails','take a risk','start a business'],
    lesson: "Failure isn't the outcome, failure is not trying. Redefine failure as not attempting, and suddenly the scary thing becomes the only safe move.",
    action: "Take the imperfect first step on the idea you keep postponing. Done beats perfect." },

  { person: 'Steve Jobs', source: 'Stanford commencement',
    tags: ['passion','work','purpose','death','time','love'],
    triggers: ['hate my job','no passion','wasting my life','what should i do','love what i do'],
    lesson: "Your time is limited, so don't waste it living someone else's life. The only way to do great work is to love what you do. Stay hungry, stay foolish.",
    action: "Ask: if today were my last, would I do this? If no, change one thing about how you spend today." },

  // ---- time / hard work / effort ----
  { person: 'Jocko Willink', source: 'Extreme Ownership',
    tags: ['excuse','blame','ownership','responsibility','fault'],
    triggers: ['not my fault','excuses','blame','someone else','wasn\'t my fault'],
    lesson: "There are no bad teams, only bad leaders. Own everything in your world. The moment you stop making excuses is the moment you gain the power to fix it.",
    action: "Take full ownership of the thing you were blaming. Ask 'what could I have done?' then do it." },

  { person: 'Elon Musk', source: 'interviews',
    tags: ['work','hard','effort','hours','grind','intensity'],
    triggers: ['work harder','not enough hours','grind','how much work','lazy'],
    lesson: "If others are putting in 40 hours and you put in 100, you'll achieve in months what takes them years, even at the same skill. Intensity bends time.",
    action: "Add one focused hour to today that you'd normally waste. Protect it and attack." },

  { person: 'Dwayne Johnson', source: 'interviews',
    tags: ['work','discipline','early','effort','consistency','grind'],
    triggers: ['wake up early','out-work','hardest worker','put in work','be the hardest worker'],
    lesson: "Be the hardest worker in the room. Success isn't about being the most talented, it's about out-working everyone when nobody is watching.",
    action: "Start 30 minutes earlier tomorrow and use it on the thing that scares you most." },

  { person: 'Seneca', source: 'On the Shortness of Life',
    tags: ['time','waste','wasted','procrastination','hours','life'],
    triggers: ['wasting time','waste of time','no time','running out of time','wasted my day'],
    lesson: "It's not that we have a short time to live, but that we waste much of it. Life is long enough if you invest it well instead of leaking it away.",
    action: "Guard the next hour like it's your last resource. Put it into the one thing that matters most." },

  // ---- burnout / rest / balance ----
  { person: 'Arianna Huffington', source: 'Thrive',
    tags: ['burnout','rest','sleep','tired','exhausted','recover'],
    triggers: ['burnt out','burned out','exhausted','tired','no energy','need rest'],
    lesson: "Burnout is not the price of success. Running yourself into the ground doesn't prove commitment, it wrecks the very engine you need. Rest is part of the work.",
    action: "Protect your sleep tonight and take one real break tomorrow. Recovery is fuel, not weakness." },

  { person: 'Cal Newport', source: 'Digital Minimalism',
    tags: ['burnout','overwhelm','busy','too much','simplify'],
    triggers: ['too busy','overwhelmed','too much on my plate','can\'t keep up','spread thin'],
    lesson: "Busyness is not productivity. Doing more of the wrong things faster just burns you out. Cut the noise down to the few things that actually move the needle.",
    action: "List everything you're doing, then cross off the bottom half. Go all in on what's left." },

  // ---- comparison / patience / self ----
  { person: 'Theodore Roosevelt', source: 'speeches',
    tags: ['comparison','envy','jealous','others','compare','behind'],
    triggers: ['comparing myself','everyone else','behind','jealous','they\'re ahead','feel behind'],
    lesson: "Comparison is the thief of joy. Someone will always be ahead and someone behind. The only fair race is against who you were yesterday.",
    action: "Close the app you compare on. Beat your own number from yesterday. That's the only scoreboard." },

  { person: 'Naval Ravikant', source: 'The Almanack of Naval',
    tags: ['happiness','peace','desire','present','calm'],
    triggers: ['not happy','unhappy','peace','calm','always wanting more','never satisfied'],
    lesson: "A calm mind, a fit body, and a house full of love. These things can't be bought, they must be earned. Desire is a contract you make to be unhappy until you get what you want.",
    action: "Pick one desire and let it go for today. Do the work from peace, not from lack." },

  { person: 'Eckhart Tolle', source: 'The Power of Now',
    tags: ['present','worry','future','past','overthink','anxiety'],
    triggers: ['worried about the future','stuck in the past','overthinking','anxious about tomorrow','can\'t be present'],
    lesson: "Most suffering is created by resisting this moment. The past is a memory, the future a projection. Your power is only ever in the now.",
    action: "Bring all your attention to the single task in front of you right now. Just this, nothing else." },

  { person: 'Epictetus', source: 'Enchiridion',
    tags: ['control','stoic','worry','external','response'],
    triggers: ['out of my control','can\'t control','worried about','what others think','unfair'],
    lesson: "Some things are within our power, and some are not. Peace comes from working hard on what you control and releasing your grip on everything else.",
    action: "Draw a line: your effort on one side, everything else on the other. Work only your side today." },

  // ---- reading / learning / growth ----
  { person: 'Charlie Munger', source: 'Poor Charlie\'s Almanack',
    tags: ['learn','read','knowledge','smarter','grow','study'],
    triggers: ['want to learn','get smarter','read more','study','improve my mind'],
    lesson: "Go to bed a little wiser than when you woke up. The people who compound knowledge daily end up miles ahead of the ones chasing the shortcut.",
    action: "Read or study one focused chapter today. Small daily learning compounds into an edge." },

  { person: 'Will Smith', source: 'interviews',
    tags: ['fear','discipline','build','brick','consistency','work'],
    triggers: ['huge goal','overwhelmed by goal','too big','where to start','big dream'],
    lesson: "You don't set out to build a wall. You lay one brick as perfectly as you can, then the next. Do that every day and one day you look up and you've built a wall.",
    action: "Forget the whole goal. Lay one perfect brick today, the single next action, and lay it well." },

  { person: 'Muhammad Ali', source: 'interviews',
    tags: ['pain','training','discipline','suffer','effort','champion'],
    triggers: ['don\'t want to train','hate the work','suffering now','why keep going','it hurts'],
    lesson: "I hated every minute of training, but I said, don't quit. Suffer now and live the rest of your life as a champion. The pain you dodge today is the regret you carry tomorrow.",
    action: "Do the rep you're dreading right now, while it's uncomfortable. That discomfort is the price of the crown." },

  { person: 'Toni Morrison', source: 'interviews',
    tags: ['fear','create','make','start','doubt','work'],
    triggers: ['afraid to create','scared to make','doubt my work','not good enough to start'],
    lesson: "If you have some power, then your job is to empower somebody else. Don't wait to feel ready or fearless. Make the thing, then make the next thing.",
    action: "Create the rough, ugly first version today. You can only edit something that exists." },

  { person: 'Denzel Washington', source: 'commencement speech',
    tags: ['fail','fall','risk','try','fear','forward'],
    triggers: ['fell short','failed again','scared to try','play it safe','afraid to fall'],
    lesson: "If you're going to fail, fail forward. Every pro was once an amateur. You will fall, so fall in the direction of your dreams and get back up.",
    action: "Take the risk you've been avoiding. Fail forward. A fall that moves you counts as progress." },
]

// ---- synonym / intent map ------------------------------------------------
// Maps messy human phrasing to canonical topic tokens. Deep matching: even if
// the user never types the exact tag, we understand the meaning.

const SYNONYMS = {
  procrastination: ['procrastinate','procrastinating','putting off','put off','delay','delaying','keep delaying','stalling','avoiding','avoid','lazy','laziness','later','do it tomorrow','never start'],
  focus: ['focus','focused','concentrate','concentration','attention','pay attention','zone in','lock in','can\'t focus','losing focus'],
  distraction: ['distracted','distraction','distractions','phone','instagram','tiktok','social media','scrolling','scroll','notifications','keep checking'],
  quit: ['quit','quitting','give up','giving up','gave up','stop trying','want to stop','can\'t do it','too hard','so hard','breaking point'],
  discipline: ['discipline','disciplined','consistent','consistency','stick to','stay on track','self control','willpower','routine'],
  motivation: ['motivation','motivated','unmotivated','no drive','no energy','feel like','can\'t be bothered','need a push','inspire','inspiration'],
  fear: ['scared','afraid','fear','nervous','anxious','anxiety','doubt','doubting','self doubt','worried','worry','hesitate','hesitating'],
  failure: ['fail','failed','failing','failure','mistake','messed up','not good enough','bad at','suck at','keep losing'],
  time: ['time','wasting time','waste of time','no time','running out of time','wasted','wasted my day','hours gone','time management'],
  burnout: ['burnout','burnt out','burned out','exhausted','tired','drained','overwhelmed','overwhelm','too much','can\'t keep up','spread thin','busy'],
  money: ['money','rich','wealth','wealthy','broke','income','financial','finances','get paid','earn','cash'],
  business: ['business','clients','customers','sell','selling','sales','offer','startup','company','brand','marketing'],
  habit: ['habit','habits','routine','stick','streak','every day','daily','build a habit','make it stick'],
  comparison: ['comparing','compare','comparison','jealous','jealousy','envy','everyone else','behind','falling behind','they\'re ahead'],
  purpose: ['purpose','why','meaning','point','direction','lost','no goals','what should i do','reason'],
  overthink: ['overthink','overthinking','over thinking','stuck in my head','can\'t stop thinking','racing thoughts'],
  present: ['present','the now','be present','in the moment','future','past','tomorrow','yesterday'],
  work: ['work harder','hard work','effort','grind','hustle','put in the work','lazy','out-work','not enough'],
  learn: ['learn','learning','read','reading','study','studying','smarter','knowledge','grow','improve my mind'],
  start: ['start','starting','begin','beginning','first step','where do i start','how do i start','get started','kick off'],
  control: ['control','out of my control','can\'t control','unfair','what others think','not my fault'],
  stuck: ['stuck','blocked','plateau','not moving','spinning','no progress','trapped'],
}

// ---- matching -------------------------------------------------------------

function normalize(text) {
  return ' ' + text.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
}

// Crude but effective stemmer: collapse word variants to one root so
// motivate / motivated / motivation all match the same concept.
function stem(w) {
  w = w.toLowerCase()
  if (w.length <= 4) return w
  for (const s of ['ations','ation','ements','ement','ness','ings','ing','edly','ies','ied','ers','er','ed','es','ly','s']) {
    if (w.endsWith(s) && w.length - s.length >= 3) return w.slice(0, -s.length)
  }
  return w
}

// Edit distance, capped — used for typo tolerance.
function lev(a, b) {
  const m = a.length, n = b.length
  if (Math.abs(m - n) > 2) return 3
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[m]
}

// Typo-tolerant equality: exact for short words, 1-2 edits for longer ones.
// Catches "laazy" -> "lazy", "procastinate" -> "procrastinate", etc.
function near(a, b) {
  if (a === b) return true
  const n = Math.max(a.length, b.length)
  if (n < 6) return false // short words must match exactly (avoids pasta≈past)
  const d = lev(a, b)
  return d <= 1 || (n >= 9 && d <= 2)
}

function qStems(question) {
  return normalize(question).trim().split(' ').filter(Boolean).map(stem)
}

// Does the question contain this keyword? Multi-word -> substring. Single word
// -> stem + typo-tolerant match against every word the user typed.
function hasWord(question, keyword, stems) {
  const kw = keyword.toLowerCase().trim()
  if (kw.includes(' ')) return normalize(question).includes(' ' + kw)
  const ks = stem(kw)
  return stems.some(s => near(s, ks))
}

// Expand a raw question into the set of canonical topics it touches.
function topicsIn(question) {
  const stems = qStems(question)
  const found = new Set()
  for (const [topic, phrases] of Object.entries(SYNONYMS)) {
    for (const p of phrases) {
      if (hasWord(question, p, stems)) { found.add(topic); break }
    }
  }
  return found
}

// Distinctive name tokens — safe to match on their own (not common English
// words). If a question names one of these people, KB owns it for free.
const SAFE_NAMES = new Set(['goggins','hormozi','jocko','willink','huberman','kiyosaki','vaynerchuk','gary vee','ravikant','naval','duckworth','aurelius','marcus aurelius','epictetus','seneca','frankl','viktor frankl','munger','buffett','warren buffett','blakely','bezos','jeff bezos','sinek','kobe','bryant','mamba','mcraven','fogg','duhigg','darren hardy','ziglar','cardone','grant cardone','robin sharma','mel robbins','tony robbins','dweck','eckhart','tolle','carnegie','dale carnegie','maxwell','brian tracy','gladwell','drucker','napoleon hill','jim rohn','ryan holiday','cal newport','nir eyal','brene','brené','toni morrison','denzel','muhammad ali','seinfeld','arianna','huffington','roosevelt','elon musk','steve jobs','james clear','atomic habits','charlie munger','will smith','dwayne johnson','the rock'])

// Score every entry against the question. Name hits and trigger phrases weigh
// heaviest, then topic overlap, then tag word hits.
export function matchKB(question) {
  if (!question || !question.trim()) return null
  const raw = normalize(question)
  const stems = qStems(question)
  const topics = topicsIn(question)
  let best = null, bestScore = 0

  for (const entry of KB) {
    let score = 0
    // Name match: full name, or a distinctive token from the person's name,
    // or a safe alias tied to this person. Any of these = free KB answer.
    const full = entry.person.toLowerCase()
    if (raw.includes(full)) score += 10
    for (const tok of full.split(' ')) {
      if (SAFE_NAMES.has(tok) && raw.includes(' ' + tok)) score += 7
    }
    if (SAFE_NAMES.has(full) && raw.includes(full)) score += 3
    if (entry.source && SAFE_NAMES.has(entry.source.toLowerCase()) && raw.includes(entry.source.toLowerCase())) score += 6
    for (const t of entry.triggers) { if (raw.includes(normalize(t).trim())) score += 5 }
    for (const tag of entry.tags) {
      if (topics.has(tag)) score += 3
      else if (hasWord(question, tag, stems)) score += 2
    }
    if (score > bestScore) { bestScore = score; best = entry }
  }
  // Threshold: below this it's a true miss → KAI hands off to the paid AI.
  return bestScore >= 3 ? best : null
}

// ---- personalization (pure code, no tokens) -------------------------------

export function computeStats(events) {
  try {
    const now = new Date()
    const today = analyzeDay(events || [], now, now)
    const week = analyzeRange(events || [], lastNDays(7, now), now)
    return {
      wastedTodayH: Math.round((today.wasted / 60) * 10) / 10,
      completionToday: Math.round(today.completion),
      wastedWeekH: Math.round(week.totalWasted / 60),
      completionWeek: Math.round(week.avgCompletion),
      hasData: (events && events.length > 0),
    }
  } catch {
    return { wastedTodayH: 0, completionToday: 0, wastedWeekH: 0, completionWeek: 0, hasData: false }
  }
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// Build the opening line from real calendar numbers. This is what makes the
// same lesson feel personal every time, for free.
function opener(stats, name) {
  const n = name ? name : 'listen'
  if (stats.hasData && stats.wastedTodayH >= 2) {
    return pick([
      `${name || 'Hey'}, you've already burned ${stats.wastedTodayH} hours today. That's the wake-up call.`,
      `You've let ${stats.wastedTodayH} hours slip today. Let's stop the bleed right now.`,
      `${stats.wastedTodayH} hours gone today already. Read this, then move.`,
    ])
  }
  if (stats.hasData && stats.wastedWeekH >= 8) {
    return pick([
      `You wasted about ${stats.wastedWeekH} hours this week. That's a part-time job of nothing.`,
      `${stats.wastedWeekH} hours lost this week. That number changes today.`,
    ])
  }
  if (stats.hasData && stats.completionWeek >= 55) {
    return pick([
      `You're actually moving, ${stats.completionWeek}% of your week is real work. Now push.`,
      `Solid week so far at ${stats.completionWeek}%. Don't coast, level up.`,
    ])
  }
  return pick([
    `${name || 'Listen'}, straight up.`,
    `Here's what you need.`,
    `No fluff, ${n}.`,
  ])
}

function render(entry, events, profile) {
  const stats = computeStats(events)
  const name = profile && profile.name ? profile.name : ''
  const top = opener(stats, name)
  const body = `${entry.lesson}`
  const who = `— ${entry.person}${entry.source ? `, ${entry.source}` : ''}`
  const move = `Do this now: ${entry.action}`
  return { text: `${top}\n\n${body}\n${who}\n\n${move}`, person: entry.person, matched: true }
}

// Assemble the full sharp answer. Boom: opener + lesson + who said it + action.
export function answerFromKB(question, events, profile) {
  const entry = matchKB(question)
  if (!entry) return null
  return render(entry, events, profile)
}

// Safety net. When nothing matches (a typo, a vague message), KAI still hits
// back for free with a universal power lesson. No error, no paid call, ever.
const GENERAL = KB.filter(e =>
  ['David Goggins','Jocko Willink','James Clear','Kobe Bryant','Jim Rohn','Marcus Aurelius']
    .includes(e.person))

export function generalAnswer(events, profile) {
  const entry = pick(GENERAL.length ? GENERAL : KB)
  return render(entry, events, profile)
}

// ---- free stats review ----------------------------------------------------
// "review my days / what should I fix" — answered from the app's own numbers
// (productive, wasted, gaps, completion). Pure code, ZERO tokens.

const REVIEW_PATTERNS = [
  'my day', 'my days', 'my week', 'my stats', 'my calendar', 'my schedule',
  'my time', 'review', 'analyze', 'analyse', 'look at my', 'see my', 'check my',
  'what to fix', 'what should i fix', 'what to improve', 'what should i improve',
  'what to change', 'what should i change', 'how am i doing', 'how was my',
  'what am i wasting', 'where am i losing', 'fix tomorrow', 'improve tomorrow',
  'am i productive', 'how productive'
]

export function isReviewQuestion(q) {
  if (!q) return false
  const s = ' ' + q.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  return REVIEW_PATTERNS.some(p => s.includes(p))
}

function dayName(d) { return new Date(d).toLocaleDateString('en-US', { weekday: 'long' }) }

// Which timeframe the question is about. Default is TODAY unless week/month said.
function reviewScope(q) {
  const s = ' ' + (q || '').toLowerCase() + ' '
  if (s.includes('week') || s.includes('7 day') || s.includes('last 7') || s.includes('past 7')) return 'week'
  if (s.includes('month') || s.includes('30 day') || s.includes('past 30')) return 'month'
  return 'day'
}

export function reviewMyDays(events, profile, question) {
  const now = new Date()
  const name = profile && profile.name ? profile.name : ''
  if (!(events && events.length > 0)) {
    return { text: `I can't see your day yet — no calendar data is synced. Hit refresh up top (or Reconnect Google if it's red), then ask me again.`, matched: true }
  }
  const scope = reviewScope(question)
  if (scope === 'week') return reviewRange(events, name, now, 7, 'last 7 days', 'this week')
  if (scope === 'month') return reviewRange(events, name, now, 30, 'last 30 days', 'this month')
  return reviewDay(events, name, now)
}

// ---- TODAY ----
function reviewDay(events, name, now) {
  const d = analyzeDay(events, now, now)
  let big = null
  for (const g of (d.gaps || [])) { if (!big || g.minutes > big.minutes) big = g }
  const up = (d.upcomingEvents || []).length
  const lines = []
  lines.push(`${name ? name + ", h" : "H"}ere's your day so far, no sugar.`)
  lines.push(`${fmtDuration(d.productive)} productive, ${fmtDuration(d.wasted)} wasted, ${Math.round(d.completion)}% of your awake day used.`)
  if (big && big.minutes >= 30) {
    lines.push(`Biggest leak today: ${fmtDuration(big.minutes)} empty, ${fmtTime(big.start)} to ${fmtTime(big.end)}. Nothing scheduled there, so it bled out.`)
  } else if (d.wasted < 30) {
    lines.push(`Barely any wasted time today. Good. Keep the pressure on.`)
  }
  if (up > 0) lines.push(`You've still got ${up} thing${up > 1 ? 's' : ''} scheduled ahead today. Don't fumble the back half.`)
  lines.push(`Fix for tomorrow: put your empty stretches on the calendar tonight, before the day starts. A gap on the calendar is a gap in your life — decide the work in advance so tomorrow you just execute.`)
  return { text: lines.join('\n\n'), matched: true }
}

// ---- SLEEP: KAI knows exactly when you slept + gives a KB-backed opinion -----
// Free, coded, no tokens. Your target is ~5h — a grind schedule, not 8.

// The most recent real sleep the app clocked (shutdown / manual timer).
export function lastSleepInterval(sleepData) {
  const ivs = (sleepData && Array.isArray(sleepData.intervals)) ? sleepData.intervals : []
  if (!ivs.length) return null
  let last = ivs[0]
  for (const iv of ivs) if (iv.end > last.end) last = iv
  return last
}

// Your ideal sleep + age come from onboarding (localStorage). Under/at your
// ideal = approved. Over it = wasted oversleep, KAI calls it out — UNLESS you're
// over 40, in which case KAI respects whatever you choose and never pushes.
function sleepConfig() {
  let ideal = 5, age = 0
  try { ideal = parseFloat(localStorage.getItem('grow_ideal_sleep')) || 5; age = parseInt(localStorage.getItem('grow_user_age'), 10) || 0 } catch (e) {}
  return { ideal, age }
}
export function sleepOpinion(hours) {
  const { ideal, age } = sleepConfig()
  if (age > 40) {
    if (hours <= ideal + 0.75) return pick([
      `${hours.toFixed(1)}h — right where you set it. At your stage that's wisdom, not weakness. Rest well, then go build.`,
      `Solid rest at ${hours.toFixed(1)}h. You've earned the right to recover on your terms. Now attack the day.`,
    ])
    return pick([`${hours.toFixed(1)}h, a little over your ${ideal}h — and that's fine at your stage. Recovery is smart. Just don't let it slide into drift.`])
  }
  if (hours <= ideal) {
    if (hours < ideal - 1.5) return pick([
      `${hours.toFixed(1)}h. That's warrior sleep, under your own target. Jocko's up at 4:30 while the world dreams — you're cut from that. Don't run the tank fully dry though.`,
      `Below your line and already up. Goggins calls that callousing the mind. Respect. Use every awake hour like you fought for it.`,
    ])
    return pick([
      `Right on your ${ideal}h line and up hunting — discipline, not luck. Jocko: discipline equals freedom. You just bought a longer day.`,
      `Dialed in at your target. Kobe trained at 4am on sleep like this. You've got more day than everyone else — spend it.`,
    ])
  }
  const over = Math.round((hours - ideal) * 10) / 10
  if (hours <= ideal + 1.5) return pick([
    `That's ${over}h past your ${ideal}h target — logged as wasted, not rest. Not a disaster, but set the alarm earlier and take that time back.`,
    `Over your line by ${over}h. That extra is reps someone else is putting in while you're down. Cut it tomorrow.`,
  ])
  return pick([
    `${over}h over your ${ideal}h target — that whole overage counts as wasted, not sleep. Discipline equals freedom. Fix the wake-up tonight.`,
    `Way past your line, ${over}h too much, all of it wasted. Nobody outworks you while you're asleep that long. James Clear: you fall to your systems — tighten it.`,
  ])
}

// Detect when you're SETTING or asking about the sleep rule ("if I sleep more
// than 5 hours that's not ok", "I oversleep", "sleep too much"). Answered free.
const SLEEP_RULE = [
  ' sleep more than', ' sleeping more than', ' if i sleep more', ' over 5 hour', ' over five hour',
  ' more than 5 hour', ' more than five hour', ' oversleep', ' over sleep', ' sleep too much',
  ' too much sleep', ' 5 hours is', ' five hours is', ' 5 hour is', ' sleep over 5', ' more than 5 hr'
]
export function isSleepRule(q) {
  if (!q) return false
  const s = ' ' + q.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  return SLEEP_RULE.some(p => s.includes(p))
}

// KAI confirms the rule and, if it has a record, judges last night against it.
export function answerSleepRule(sleepData, profile) {
  const name = profile && profile.name ? profile.name : ''
  const { ideal } = sleepConfig()
  const last = lastSleepInterval(sleepData)
  const head = `Locked in${name ? ', ' + name : ''}. More than ${ideal} hours is over your line — I'll call it out every time, and the overage logs as wasted, not rest.`
  if (!last) {
    return { text: `${head}\n\nThe next time you sleep, I clock the exact window and hold you to it.`, matched: true }
  }
  const hours = (last.end - last.start) / 3600000
  const hm = fmtDuration(Math.round((last.end - last.start) / 60000))
  const verdict = hours <= ideal
    ? `Last night you were at ${hm} — under the line. That's the standard. Hold it.`
    : `And last night? ${hm}. That's over. ${sleepOpinion(hours)}`
  return { text: `${head}\n\n${verdict}`, matched: true }
}

const SLEEP_Q = [
  ' how much did i sleep', ' how long did i sleep', ' how many hours did i sleep',
  ' my sleep', ' did i sleep', ' hours of sleep', ' how much sleep', ' how was my sleep',
  ' sleep last night', ' when did i sleep', ' did i get enough sleep', ' how long was i asleep',
  ' how much did i rest', ' how many hours of sleep'
]
export function isSleepQuestion(q) {
  if (!q) return false
  const s = ' ' + q.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  return SLEEP_Q.some(p => s.includes(p))
}

// Full KAI sleep answer: exact window (from → to), duration, then the opinion.
export function answerSleep(sleepData, profile) {
  const last = lastSleepInterval(sleepData)
  const name = profile && profile.name ? profile.name : ''
  if (!last) {
    return { text: `I don't have a sleep record yet. The moment your Mac shuts down — or you type "sleep" and use the timer — I clock it exactly. Then I'll tell you the window and what I think of it.`, matched: true }
  }
  const ms = last.end - last.start
  const hours = ms / 3600000
  const hm = fmtDuration(Math.round(ms / 60000))
  const from = fmtTime(last.start), to = fmtTime(last.end)
  return {
    text: `${name ? name + ', you' : 'You'} slept from ${from} to ${to} — that's ${hm}.\n\n${sleepOpinion(hours)}`,
    matched: true
  }
}

// ---- type-to-create: "add gym 6 to 7", "schedule script writing 8pm-10pm" ---
const CREATE_VERBS = /\b(add|schedule|create|block|put|set|plan)\b/
// Clean a messy spoken title down to the core name. "i had a meeeting in it" ->
// "Meeeting". Drops filler words, pronouns, bare numbers, leftover time words.
const TITLE_STOP = new Set(['i', 'ill', 'im', 'a', 'an', 'the', 'my', 'me', 'for', 'on', 'at', 'in', 'to', 'of', 'this', 'next', 'will', 'have', 'had', 'has', 'having', 'gonna', 'want', 'wanna', 'need', 'gotta', 'please', 'it', 'that', 'there', 'some', 'and', 'with', 'do', 'does', 'did', 'put', 'get', 'got', 'make', 'made', 'let', 'us', 'we', 'from', 'today', 'tomorrow', 'all', 'day', 'oclock', 'clock', 'am', 'pm', 'is', 'are', 'was', 'be', 'been', 'so', 'just', 'like', 'about', 'into', 'up', 'out', 'been', 'set', 'block', 'add', 'schedule', 'hold', 'book', 'reserve'])
function cleanEventTitle(t) {
  const words = (t || '').replace(/[^a-z0-9'\s]/gi, ' ').split(/\s+/)
    .map((w) => w.trim()).filter(Boolean)
    .filter((w) => !/^\d+$/.test(w))
    .filter((w) => !TITLE_STOP.has(w.toLowerCase()))
  if (!words.length) return 'Block'
  return words.join(' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function parseClock(str, inherit) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(str)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const mer = m[3] || inherit || null
  if (h > 23) return null
  if (mer === 'pm' && h < 12) h += 12
  else if (mer === 'am' && h === 12) h = 0
  else if (!mer && h >= 1 && h <= 7) h += 12   // bare small hour -> evening (gym 6 to 7)
  return { min: h * 60 + min, mer }
}
export function parseEventCommand(text, now = new Date()) {
  if (!text) return null
  const s = text.toLowerCase().trim()
  if (!CREATE_VERBS.test(s)) return null
  const dayOffset = /\btomorrow\b/.test(s) ? 1 : 0
  const range = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|till|until|-|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/.exec(s)
  if (!range) return null
  const b = parseClock(range[2])
  const a = parseClock(range[1], b && b.mer)
  if (!a || !b) return null
  let startMin = a.min, endMin = b.min
  if (endMin <= startMin) endMin += 12 * 60
  if (endMin <= startMin || endMin > 1440) return null
  let title = s.slice(s.search(CREATE_VERBS)).replace(CREATE_VERBS, '')
  title = title.slice(0, title.indexOf(range[0]))
  title = cleanEventTitle(title)
  const base = new Date(now); base.setDate(base.getDate() + dayOffset); base.setHours(0, 0, 0, 0)
  return {
    summary: title,
    start: new Date(base.getTime() + startMin * 60000).toISOString(),
    end: new Date(base.getTime() + endMin * 60000).toISOString(),
    dayOffset
  }
}

// ---- calendar assistant: obey commands (day names, all-day, times) ----------
const DOW = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 }
const CAL_VERBS = /\b(block|add|schedule|create|put|set|reserve|hold|book)\b/

export function parseCalendarCommand(text, now = new Date()) {
  if (!text) return null
  const s = text.toLowerCase().trim()
  if (!CAL_VERBS.test(s)) return null
  const base = new Date(now); base.setHours(0, 0, 0, 0)
  let date = new Date(base)
  if (/\btomorrow\b/.test(s)) date.setDate(base.getDate() + 1)
  const dow = Object.keys(DOW).find((k) => new RegExp('\\b' + k + '\\b').test(s))
  if (dow) { let diff = (DOW[dow] - base.getDay() + 7) % 7; if (diff === 0 && !/\btoday\b/.test(s)) diff = 7; date = new Date(base); date.setDate(base.getDate() + diff) }
  const allDay = /\ball\s?day\b/.test(s)
  const range = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|till|until|-|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/.exec(s)
  let startMin, endMin, single
  if (!allDay && range) { const b = parseClock(range[2]); const a = parseClock(range[1], b && b.mer); if (a && b) { startMin = a.min; endMin = b.min; if (endMin <= startMin) endMin += 12 * 60 } }
  if (!allDay && startMin == null) { single = /\b(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/.exec(s); if (single) { const t = parseClock(single[1]); if (t) { startMin = t.min; endMin = t.min + 60 } } }
  let title = s.replace(CAL_VERBS, ' ')
  if (range) title = title.replace(range[0], ' ')
  if (single) title = title.replace(single[0], ' ')
  if (dow) title = title.replace(new RegExp('\\b' + dow + '\\b', 'g'), ' ')
  title = cleanEventTitle(title)
  if (allDay) return { summary: title, start: new Date(date).toISOString(), end: new Date(date).toISOString(), allDay: true }
  if (startMin == null) { startMin = 9 * 60; endMin = 10 * 60 }
  return { summary: title, start: new Date(date.getTime() + startMin * 60000).toISOString(), end: new Date(date.getTime() + endMin * 60000).toISOString(), allDay: false }
}

// The ONE thing the calendar assistant pushes back on: blocking a business day
// for rest / vacation. Everything else it just does.
const REST_TERMS = [' vacation', ' day off', ' rest day', ' take the day off', ' do nothing', ' skip work', ' cancel everything', ' cancel all', ' chill all day', ' relax all day', ' nothing all day', ' holiday', ' time off', ' lazy day', ' off day', ' take a break all', ' break all day', ' no work']
const OVERRIDE_TERMS = [' anyway', ' confirm', ' i said', ' do it', ' book it', ' just do', ' override', ' i mean it', ' yes book']
export function isRestRequest(q) {
  if (!q) return false
  const s = ' ' + q.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  if (OVERRIDE_TERMS.some((p) => s.includes(p))) return false   // they insisted -> obey
  return REST_TERMS.some((p) => s.includes(p))
}
export function restPushback(profile) {
  const name = profile && profile.name ? profile.name : ''
  return { text: `Hold up${name ? ', ' + name : ''}. You're telling me to block a whole work day for rest. If this is a real, planned recovery day, say it again with "confirm" and I'll book it, no argument. But if you're about to torch a business day on nothing, that's the one I won't rubber-stamp. What's the reason?`, matched: true }
}

// ---- "do I have time for X" — free gap finder, coded, no tokens -------------
const TIME_Q = [' do i have time', ' any time for', ' can i fit', ' room for', ' time for', ' am i free', ' free slot', ' free time', ' when am i free', ' where can i fit', ' do i have room', ' any room', ' my schedule', ' analyze my', ' analyse my', ' free today', ' what does my day', ' how does my day look', ' whats open', ' what is open']
export function isTimeQuestion(q) {
  if (!q) return false
  const s = ' ' + q.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  return TIME_Q.some(p => s.includes(p))
}
export function answerFreeTime(events, profile, question) {
  const now = new Date()
  const name = profile && profile.name ? profile.name : ''
  const gaps = futureGaps(events, now).filter(g => g.minutes >= 20)
  const mm = /(\d+)\s*(min|minute|hour|hr|h)\b/.exec((question || '').toLowerCase())
  const want = mm ? (/h/.test(mm[2]) ? parseInt(mm[1], 10) * 60 : parseInt(mm[1], 10)) : null
  if (!gaps.length) return { text: `${name ? name + ', y' : 'Y'}ou're packed for the rest of today. No open gap left. If something matters, move a block or trade it out.`, matched: true }
  const lines = []
  lines.push(`${name ? name + ", h" : "H"}ere's your open time left today:`)
  gaps.slice(0, 5).forEach(g => lines.push(`• ${fmtTime(g.start)} - ${fmtTime(g.end)}  (${fmtDuration(g.minutes)})`))
  if (want) {
    const fit = gaps.find(g => g.minutes >= want)
    lines.push(fit
      ? `A ${fmtDuration(want)} block fits best at ${fmtTime(fit.start)}. Want me to book it? Say "schedule it".`
      : `Nothing open fits a full ${fmtDuration(want)} though — biggest is ${fmtDuration(Math.max(...gaps.map(g => g.minutes)))}.`)
  }
  return { text: lines.join('\n'), matched: true }
}

// ---- smart scheduling: business gets priority, personal fills open gaps ------
// KB is educated on what reads as business vs personal so KAI can decide where
// to put a thing: business earns a prime-hours priority slot; personal just
// drops into any open gap without stealing prime time.
const BUSINESS_TERMS = ['meeting', 'client', 'call', 'deal', 'pitch', 'deadline', 'project', 'revenue', 'sales', 'customer', 'contract', 'proposal', 'invoice', 'launch', 'presentation', 'present', 'interview', 'email', 'emails', 'work', 'strategy', 'marketing', 'investor', 'demo', 'onboarding', 'report', 'standup', 'sprint', 'negotiation', 'negotiate', 'partnership', 'partner', 'stakeholder', 'budget', 'payroll', 'hire', 'hiring', 'recruit', 'conference', 'webinar', 'workshop', 'lead', 'leads', 'outreach', 'follow up', 'followup', 'quota', 'kpi', 'vendor', 'supplier', 'order', 'campaign', 'brand', 'biz', 'business', 'payment', 'cold call', 'discovery call', 'sales call', 'stand up', 'sync', '1:1', 'one on one']
const PERSONAL_TERMS = ['gym', 'workout', 'work out', 'run', 'running', 'jog', 'nap', 'rest', 'game', 'gaming', 'movie', 'netflix', 'date', 'dinner', 'lunch', 'breakfast', 'friend', 'friends', 'family', 'shower', 'relax', 'walk', 'read', 'reading', 'hobby', 'shopping', 'clean', 'cleaning', 'laundry', 'sleep', 'break', 'fun', 'play', 'meditate', 'meditation', 'pray', 'church', 'haircut', 'doctor', 'coffee', 'chill', 'music', 'guitar', 'draw', 'paint', 'groceries']

function hasTerm(s, terms) {
  for (const t of terms) {
    const re = new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')
    if (re.test(s)) return t
  }
  return null
}
export function classifyTask(text) {
  const s = ' ' + (text || '').toLowerCase() + ' '
  const biz = hasTerm(s, BUSINESS_TERMS)
  const per = hasTerm(s, PERSONAL_TERMS)
  if (biz && !per) return { business: true, reason: `"${biz.trim()}" reads as business` }
  if (per && !biz) return { business: false, reason: `"${per.trim()}" reads as personal` }
  if (biz && per) return { business: true, reason: `business signal "${biz.trim()}" wins` }
  return { business: false, reason: 'no clear business signal, treated as personal' }
}

const SCHEDULE_Q = [' find time for', ' schedule a ', ' schedule an ', ' schedule my ', ' schedule the ', ' book time', ' fit in ', ' squeeze in', ' slot in', ' set up a ', ' set up an ', ' find me time', ' add time for', ' book a ', ' book an ', ' plan a ', ' plan an ', ' make time for', ' find a slot', ' where can i put', ' find a spot for']
export function isScheduleRequest(q) {
  if (!q) return false
  const s = ' ' + q.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  return SCHEDULE_Q.some((p) => s.includes(p))
}

function taskDuration(q) {
  const m = /(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs|h)\b/.exec((q || '').toLowerCase())
  if (!m) return 60
  const n = parseInt(m[1], 10)
  return /h/.test(m[2]) ? n * 60 : n
}
function taskTitle(q) {
  let s = (q || '').toLowerCase()
  s = s.replace(/\b(find time for|schedule|book time for|fit in|squeeze in|slot in|set up|find me time for|add time for|make time for|find a slot for|find a spot for|where can i put|book|plan|put|for|a|an|the|me|some|today|tomorrow|please|in|on|can you|could you|i want to|i need to|my)\b/g, ' ')
  s = s.replace(/\b\d+\s*(min|minute|minutes|hour|hours|hr|hrs|h)\b/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : 'New block'
}

// Free gaps from NOW to the evening — the actual open slots you can still fill
// today (not the past wasted gaps analyzeDay reports).
export function futureGaps(events, now, endHour = 23) {
  const base = new Date(now); base.setHours(0, 0, 0, 0)
  const baseMs = base.getTime()
  const nowMin = Math.max(0, (now.getTime() - baseMs) / 60000)
  const endMin = endHour * 60
  const key = (d) => { const x = new Date(d); return x.getFullYear() + '-' + x.getMonth() + '-' + x.getDate() }
  const iv = (events || [])
    .filter((e) => !e.allDay && key(e.start) === key(now))
    .map((e) => [(new Date(e.start).getTime() - baseMs) / 60000, (new Date(e.end).getTime() - baseMs) / 60000])
    .filter(([s, e]) => e > nowMin)
    .sort((a, b) => a[0] - b[0])
  const merged = []
  for (const [s, e] of iv) { const last = merged[merged.length - 1]; if (last && s <= last[1]) last[1] = Math.max(last[1], e); else merged.push([s, e]) }
  const gaps = []; let cur = nowMin
  for (const [s, e] of merged) { if (s > cur) gaps.push([cur, Math.min(s, endMin)]); cur = Math.max(cur, e); if (cur >= endMin) break }
  if (cur < endMin) gaps.push([cur, endMin])
  return gaps.filter(([s, e]) => e - s >= 5).map(([s, e]) => ({ start: new Date(baseMs + s * 60000), end: new Date(baseMs + e * 60000), minutes: Math.round(e - s) }))
}

export function pickSlot(events, now, dur, business) {
  const fits = futureGaps(events, now).filter((g) => g.minutes >= dur)
  if (!fits.length) return null
  const startMin = (g) => { const x = new Date(g.start); return x.getHours() * 60 + x.getMinutes() }
  let chosen
  if (business) {
    // Priority: earliest, preferring prime focus hours (before 2pm).
    const prime = fits.filter((g) => startMin(g) < 14 * 60)
    chosen = (prime.length ? prime : fits).sort((a, b) => new Date(a.start) - new Date(b.start))[0]
  } else {
    // Personal: don't steal prime time — take the latest open gap that fits.
    chosen = fits.slice().sort((a, b) => new Date(b.start) - new Date(a.start))[0]
  }
  const gapStart = Math.max(new Date(chosen.start).getTime(), now.getTime())
  const gapEnd = new Date(chosen.end).getTime()
  const startMs = business ? gapStart : Math.max(gapStart, gapEnd - dur * 60000)  // biz ASAP, personal at the tail
  let endMs = startMs + dur * 60000
  if (endMs > gapEnd) endMs = gapEnd
  return { start: new Date(startMs), end: new Date(endMs) }
}

export function smartSchedule(events, profile, question, now = new Date()) {
  const name = profile && profile.name ? profile.name : ''
  const dur = taskDuration(question)
  const title = taskTitle(question)
  const cls = classifyTask(question)
  if (!(events && events.length)) {
    return { text: `I can't see your calendar yet. Hit refresh up top, then ask me to schedule it again.`, matched: true }
  }
  const slot = pickSlot(events, now, dur, cls.business)
  if (!slot) {
    return { text: `${name ? name + ', n' : 'N'}o open ${fmtDuration(dur)} block left today. ${cls.business ? "This is business, so it deserves a real slot — clear something and I'll put it first." : "It's personal, so no stress — try tomorrow or trim something."}`, matched: true }
  }
  const when = `${fmtTime(slot.start)} to ${fmtTime(slot.end)}`
  const why = cls.business
    ? `It's business (${cls.reason}), so I gave it a priority slot in your prime hours.`
    : `It's personal (${cls.reason}), so I dropped it in an open gap and kept your prime hours free.`
  return {
    create: { summary: title, start: slot.start.toISOString(), end: slot.end.toISOString() },
    text: `Done. "${title}" is booked ${when}.\n\n${why}`,
    matched: true
  }
}

// ---- WEEK / MONTH ----
function reviewRange(events, name, now, n, label, word) {
  const range = analyzeRange(events, lastNDays(n, now), now)
  const prodH = Math.round(range.totalProductive / 60)
  const wastedH = Math.round(range.totalWasted / 60)
  const avg = Math.round(range.avgCompletion)
  let biggest = null
  for (const d of range.perDay) {
    for (const g of (d.gaps || [])) {
      if (!biggest || g.minutes > biggest.minutes) biggest = { minutes: g.minutes, start: g.start, end: g.end, date: d.date }
    }
  }
  const elapsedDays = range.perDay.filter(d => d.elapsed > 0)
  let best = null, worst = null
  for (const d of elapsedDays) {
    if (!best || d.completion > best.completion) best = d
    if (!worst || d.completion < worst.completion) worst = d
  }
  const lines = []
  lines.push(`${name ? name + ", h" : "H"}ere's your ${label}, no sugar.`)
  lines.push(`${prodH}h productive, ${wastedH}h wasted, ${avg}% of your awake time actually used.`)
  if (biggest && biggest.minutes >= 30) {
    lines.push(`Your biggest leak: ${fmtDuration(biggest.minutes)} empty on ${dayName(biggest.date)}, ${fmtTime(biggest.start)} to ${fmtTime(biggest.end)}. Nothing on the calendar, so it bled out.`)
  }
  if (best && worst && best.key !== worst.key) {
    lines.push(`Best day: ${dayName(best.date)} at ${Math.round(best.completion)}%. Worst: ${dayName(worst.date)} at ${Math.round(worst.completion)}%. You already know the difference between them.`)
  }
  lines.push(`Fix for tomorrow: block your empty stretches tonight, before the day starts. Decide the work in advance so tomorrow you just execute. Wasted ${wastedH}h ${word} is ${wastedH} hours your competition didn't.`)
  return { text: lines.join('\n\n'), matched: true }
}
