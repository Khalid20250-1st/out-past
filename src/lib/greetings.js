// KAI daily war-cry. A fresh line every day, chosen by the calendar day so it
// rotates and never repeats back to back. Pure code, ZERO tokens.

const LINES = [
  "Good sleep or none. Doesn't change the mission. Attack.",
  "You're awake. That's the only edge you need today. Move.",
  "Rested or wrecked, we go to war. Pick your first target.",
  "New day, same fire. Let's take what's ours.",
  "The world slept. Did you? Doesn't matter. Get ahead of it now.",
  "Eyes open means it's on. No warm up. First strike now.",
  "Yesterday is dead. Today you build the empire. Start.",
  "You didn't wake up to be average. Prove it in the first hour.",
  "Discipline doesn't ask how you feel. Show up and swing.",
  "Winners are already working. Close the gap. Go.",
  "One life, one shot, one more day of ammo. Don't waste a round.",
  "The grind missed you. Time to feed it.",
  "No motivation? Good. Motivation is for amateurs. Move on discipline.",
  "Every hour you attack today is an hour they can't catch you.",
  "You want it or you don't. The next 60 minutes answers that.",
  "Soft mornings build soft lives. Not today. Sharpen up.",
  "The mission doesn't care that you're tired. Lace up.",
  "Others are hitting snooze. You're hitting targets. Begin.",
  "Comfort is the enemy. Go do the hard thing first.",
  "Build the day you'll be proud of tonight. Move now.",
  "Your future is watching this morning. Make it flinch.",
  "Small hinges swing big doors. Swing the first one now.",
  "You're not behind. You're just not started yet. Fix that.",
  "Attack the thing you're avoiding. That's where the growth hides.",
  "Nobody is coming to save your day. You are. Get up.",
  "Turn the pain of yesterday into today's fuel. Ignite.",
  "The best in the world are boring and consistent. Be boring today.",
  "Win the morning, own the war. First move, right now.",
  "Doubt shows up every day. Beat it to the desk.",
  "You against you. Beat yesterday's number. Go.",
  "Momentum is built, not found. Lay the first brick now.",
  "Tired is a feeling. Progress is a choice. Choose.",
  "Standards over feelings. Execute the plan.",
  "The clock is bleeding. Put it to work before it runs.",
  "Greatness is a habit, not a mood. Practice it now.",
  "Move before your mind talks you out of it. 5,4,3,2,1, go.",
  "Every giant started exactly where you are. Take the step.",
  "You get out what you put in. Load up and go.",
  "Make today so good it scares your excuses.",
  "The version of you that wins is built in the next hour. Build it.",
  "Show the day who's in charge. First action, now.",
  "No zero days. Whatever happens, put points on the board today.",
  "War, work, or worship the grind. Just start swinging.",
  "You were made for hard things. Go find one and beat it.",
]

// Deterministic per calendar day: stable all day, new tomorrow, rotates the
// whole pool before repeating.
export function dailyGreeting(name) {
  const dayIndex = Math.floor(Date.now() / 86400000)
  const line = LINES[dayIndex % LINES.length]
  const who = name && name.trim() ? name.trim() : ''
  return { who, line }
}
