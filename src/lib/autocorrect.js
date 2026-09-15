// KAI's grammar brain. Coded, instant, free, offline. Fixes common spelling
// mistakes and basic mechanics (capitalization, spacing, "i" -> "I",
// missing apostrophes) automatically when you finish typing a note. Safe by
// design: it only touches known typos and mechanics, never rewrites your words.

// The most common English misspellings + missing-apostrophe contractions.
const FIX = {
  teh: 'the', hte: 'the', adn: 'and', nad: 'and', taht: 'that', thre: 'their', thier: 'their',
  recieve: 'receive', recieved: 'received', beleive: 'believe', beleived: 'believed',
  definately: 'definitely', defiantly: 'definitely', seperate: 'separate', seperately: 'separately',
  occured: 'occurred', occuring: 'occurring', occurance: 'occurrence', neccessary: 'necessary',
  accross: 'across', arguement: 'argument', begining: 'beginning', beleiving: 'believing',
  calender: 'calendar', collegue: 'colleague', comming: 'coming', commited: 'committed',
  commitee: 'committee', completly: 'completely', concious: 'conscious', decison: 'decision',
  desicion: 'decision', dissapoint: 'disappoint', embarass: 'embarrass', enviroment: 'environment',
  existance: 'existence', experiance: 'experience', familiar: 'familiar', finaly: 'finally',
  foriegn: 'foreign', freind: 'friend', freinds: 'friends', goverment: 'government',
  grammer: 'grammar', gaurantee: 'guarantee', happend: 'happened', harrass: 'harass',
  immediatly: 'immediately', independant: 'independent', interupt: 'interrupt', knowlege: 'knowledge',
  knowlegde: 'knowledge', liason: 'liaison', libary: 'library', maintainance: 'maintenance',
  maintenence: 'maintenance', millenium: 'millennium', mispell: 'misspell', neccesary: 'necessary',
  noticable: 'noticeable', occassion: 'occasion', persistant: 'persistent', posession: 'possession',
  prefered: 'preferred', priviledge: 'privilege', probaly: 'probably', probally: 'probably',
  pronounciation: 'pronunciation', publicly: 'publicly', recomend: 'recommend', recommend: 'recommend',
  refered: 'referred', relevent: 'relevant', religous: 'religious', remeber: 'remember',
  rember: 'remember', repitition: 'repetition', restaraunt: 'restaurant', rhythm: 'rhythm',
  succesful: 'successful', successfull: 'successful', suprise: 'surprise', suprised: 'surprised',
  tommorow: 'tomorrow', tommorrow: 'tomorrow', truely: 'truly', untill: 'until',
  unfortunatly: 'unfortunately', usualy: 'usually', wich: 'which', wierd: 'weird',
  writting: 'writing', writen: 'written', yeild: 'yield', alot: 'a lot', becuase: 'because',
  becasue: 'because', bussiness: 'business', buisness: 'business', wanna: 'want to', gonna: 'going to',
  gotta: 'got to', kinda: 'kind of', sorta: 'sort of', cuz: 'because', tho: 'though',
  thru: 'through', ur: 'your', u: 'you', r: 'are', pls: 'please', plz: 'please', thx: 'thanks',
  goign: 'going', wokr: 'work', wrok: 'work', jsut: 'just', jstu: 'just', liek: 'like', vry: 'very',
  abt: 'about', bcz: 'because', bc: 'because', wtih: 'with', wiht: 'with', taks: 'task', tasl: 'task',
  peopel: 'people', poeple: 'people', becoem: 'become', mkae: 'make', mesage: 'message', mroe: 'more',
  yuo: 'you', youre: "you're", theyre: "they're", theres: "there's", wasnt: "wasn't", isnt: "isn't",
  arent: "aren't", werent: "weren't", hasnt: "hasn't", havent: "haven't", hadnt: "hadn't",
  dont: "don't", doesnt: "doesn't", didnt: "didn't", cant: "can't", couldnt: "couldn't",
  wouldnt: "wouldn't", shouldnt: "shouldn't", wont: "won't", im: "I'm", ive: "I've", ill: "I'll",
  id: "I'd", youve: "you've", youll: "you'll", youd: "you'd", weve: "we've", well: 'well',
  wed: "we'd", theyve: "they've", theyll: "they'll", thats: "that's", whats: "what's",
  hes: "he's", shes: "she's", its: 'its', lets: "let's", couldve: "could've", wouldve: "would've",
  shouldve: "should've", gimme: 'give me', lemme: 'let me',
}

function matchCase(orig, repl) {
  if (orig.length > 1 && orig === orig.toUpperCase()) return repl.toUpperCase()
  if (orig[0] === orig[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1)
  return repl
}

export function autocorrect(text) {
  if (!text || typeof text !== 'string') return text
  let out = text

  // 1) known misspellings + missing apostrophes, whole word, preserve caps.
  for (const wrong in FIX) {
    out = out.replace(new RegExp('\\b' + wrong + '\\b', 'gi'), (m) => matchCase(m, FIX[wrong]))
  }

  // 2) standalone "i" -> "I"
  out = out.replace(/\bi\b/g, 'I')

  // 3) remove stray space before punctuation
  out = out.replace(/[ \t]+([,.!?;:])/g, '$1')

  // 4) collapse runs of spaces/tabs (keep newlines)
  out = out.replace(/[ \t]{2,}/g, ' ')

  // 5) capitalize the first letter of the text and of each new sentence / line
  out = out.replace(/(^\s*|[.!?]\s+|\n[ \t]*)([a-z])/g, (m, pre, c) => pre + c.toUpperCase())

  return out
}
