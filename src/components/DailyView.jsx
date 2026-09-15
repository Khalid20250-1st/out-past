import { fmtDuration, fmtTime, fmtFullDate } from '../lib/format.js'
import React from 'react'
import Rings from './Rings.jsx'
import { loadTargetHours, targetLabel } from '../lib/targets.js'
import StatBars from './StatBars.jsx'

const WINDOW_MINUTES = 24 * 60          // full day, midnight to midnight
const WINDOW_START_HOUR = 0
const WINDOW_END_HOUR = 24
// Your daily productive capacity, set in Settings (defaults to 19h). Everything you
// actually do counts toward it (showers, meetings, meals, work). The bar fills with
// the sum of your scheduled events against this goal.

function checkGoalScheduled(goal, day) {
  const all = [...(day.doneEvents||[]), ...(day.upcomingEvents||[]), ...(day.pushedEvents||[])]
  if (!all.length) return false
  const words = goal.toLowerCase().split(' ').filter(w => w.length > 2)
  const text = all.map(e => (e.summary||'').toLowerCase()).join(' ')
  return words.some(w => text.includes(w))
}

export default function DailyView({ day, run, goals }) {
  const nowPct = (day.elapsed / 1440) * 100   // position of "now" across the 24h day
  // Hero system:
  //   BIG NUMBER = the exact time you worked = the sum of your event durations
  //                (two 4h events = 8h). Not reduced by sleep.
  //   DONE ring  = that worked time as a % of your target capacity.
  //   WASTED     = unchanged — how much you burned.
  const targetHours = loadTargetHours()
  const goalMins = Math.round(targetHours * 60)
  const goalLabel = targetLabel(targetHours)
  const doneMins = day.worked || 0            // sum of event durations so far
  const goalPct = Math.min(100, (doneMins / goalMins) * 100)
  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Today</h1>
          <div className="sub">{fmtFullDate(day.date)}</div>
        </div>
        <div className="badge">{fmtDuration(doneMins)} of {goalLabel}</div>
      </div>
      <div className="grid cols-2">
        <div className="panel">
          <h3>Productivity Today</h3>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'clamp(16px,2vw,40px)',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:200}}>
              <div style={{fontFamily:'var(--display)',fontWeight:800,letterSpacing:'-2px',lineHeight:1,fontSize:'clamp(44px,5vw,76px)',color:'var(--done)'}}>{fmtDuration(doneMins)}</div>
              <div style={{color:'var(--muted)',fontSize:'clamp(12px,0.9vw,15px)',marginTop:10}}>
                worked today · <span style={{color:'var(--done)',fontWeight:700}}>{Math.round(goalPct)}%</span> of your {goalLabel} capacity
              </div>
              <div style={{display:'flex',gap:'clamp(14px,1.5vw,28px)',marginTop:20}}>
                <div>
                  <div style={{fontFamily:'var(--display)',fontWeight:800,fontSize:'clamp(18px,1.4vw,24px)',color:'var(--red)'}}>{fmtDuration(day.wasted)}</div>
                  <div style={{color:'var(--muted)',fontSize:11,letterSpacing:1,textTransform:'uppercase',marginTop:2}}>Wasted</div>
                </div>
                <div>
                  <div style={{fontFamily:'var(--display)',fontWeight:800,fontSize:'clamp(18px,1.4vw,24px)',color:'var(--muted-2)'}}>{fmtDuration(day.sleepMinutes)}</div>
                  <div style={{color:'var(--muted)',fontSize:11,letterSpacing:1,textTransform:'uppercase',marginTop:2}}>Sleep</div>
                </div>
              </div>
              <CurrentRun run={run} />
            </div>
            <Rings donePct={goalPct} wastedPct={day.wastedPct} doneValue={fmtDuration(doneMins)} wastedValue={fmtDuration(day.wasted)} size={104} />
          </div>
        </div>
        <div className="panel">
          <h3>Breakdown</h3>
          <StatBars productive={doneMins} wasted={day.wasted} done={day.doneCount} scaleMax={goalMins} doneMax={Math.max(day.doneCount + day.upcomingEvents.length, 1)} productiveMax={goalMins} productiveTarget={goalLabel} />
        </div>
      </div>
      <div className="panel">
        <h3>Non-Negotiables</h3>
        {goals && goals.length === 3 ? (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
            {goals.map((g,i) => {
              const ok = checkGoalScheduled(g, day)
              return (
                <React.Fragment key={i}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,minHeight:'86px',padding:'22px 8px',borderRadius:'10px',boxShadow:ok?'none':'0 0 18px 4px rgba(255,60,60,0.45)',border:ok?'1px solid transparent':'1px solid rgba(255,60,60,0.4)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                      <span style={{color:['var(--gold)','var(--gold)','var(--gold-2)'][i],fontWeight:900,fontSize:'22px'}}>{i+1}.</span>
                      <span style={{color:'var(--text)',fontSize:'18px',fontWeight:800}}>{g}</span>
                    </div>
                    {!ok && <span style={{color:'rgba(255,100,100,0.9)',fontSize:'11px',fontWeight:600,marginTop:'4px'}}>Not scheduled</span>}
                  </div>
                  {i < 2 && <div style={{width:'1px',height:'56px',background:'var(--line)',flexShrink:0}}/>}
                </React.Fragment>
              )
            })}
          </div>
        ) : (
          <div className="timeline">
            <div className="bar">
              {day.intervals.map((iv, i) => (
                <div key={i} className="seg prod" style={{left:((iv[0]/1440)*100)+'%',width:(((iv[1]-iv[0])/1440)*100)+'%'}} />
              ))}
              {day.isToday && <div className="seg now" style={{left:nowPct+'%'}} />}
            </div>
            <div className="ticks">{tickHours().map(h => <span key={h}>{fmtHour(h)}</span>)}</div>
          </div>
        )}
      </div>
      <div className="panel">
        <div className="event-cols">
          <EventColumn title="Done" cls="done" events={day.doneEvents.map(e => ({type:'event',ev:e}))} empty="Nothing completed yet" />
          <EventColumn title="Wasted Gaps" cls="wasted" events={[...day.gaps.map(g => ({type:'gap',gap:g})),...day.pushedEvents.map(e => ({type:'pushed',ev:e}))]} empty="No wasted time" />
          <EventColumn title="Coming Up" cls="up" events={day.upcomingEvents.map(e => ({type:'event',ev:e}))} empty="Nothing left scheduled" />
        </div>
      </div>
    </div>
  )
}

function EventColumn({ title, cls, events, empty }) {
  return (
    <div>
      <div className="col-title">{title}<span className="count">{events.length}</span></div>
      <div className="event-list">
        {events.length === 0 && <div className="empty">{empty}</div>}
        {events.map((item, i) => {
          if (item.type === 'gap') {
            return (
              <div key={'g'+i} className="event wasted">
                <div className="t">Empty gap</div>
                <div className="meta"><span>{fmtTime(item.gap.start)} - {fmtTime(item.gap.end)}</span><span>{fmtDuration(item.gap.minutes)}</span></div>
              </div>
            )
          }
          const ev = item.ev
          const isPushed = item.type === 'pushed'
          return (
            <div key={ev.id+i} className={'event '+cls}>
              <div className="t">{ev.summary}{isPushed ? ' · pushed →' : ''}</div>
              <div className="meta">
                {isPushed ? <span>was {fmtTime(ev.originalStart)} moved to {fmtTime(ev.start)}</span> : ev.allDay ? <span>all day</span> : <span>{fmtTime(ev.start)} - {fmtTime(ev.end)}</span>}
                <span className="cal">{ev.calendarName}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function tickHours() {
  const out = []
  for (let h = WINDOW_START_HOUR; h <= WINDOW_END_HOUR; h += 3) out.push(h)
  if (out[out.length-1] !== WINDOW_END_HOUR) out.push(WINDOW_END_HOUR)
  return out
}

function fmtHour(h) {
  const ampm = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 === 0 ? 12 : h % 12
  return hr + ampm
}

// The run you are on right now: time since you last woke up, and how much of it
// you worked. This is the one number midnight does not reset. Stay up through
// the night and it keeps climbing, because nothing about you started over at
// 12am. It only goes back to zero when you actually sleep.
function CurrentRun({ run }) {
  if (!run) return null
  if (run.asleep) {
    return (
      <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--line)',color:'var(--muted)',fontSize:12}}>
        Asleep right now. Your run starts again when you wake up.
      </div>
    )
  }
  const pct = run.awake > 0 ? Math.round((run.worked / run.awake) * 100) : 0
  return (
    <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--line)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
        <span style={{color:'var(--muted)',fontSize:11,letterSpacing:1,textTransform:'uppercase'}}>Current run</span>
        {run.crossedMidnight && (
          <span style={{color:'var(--gold)',fontSize:10,fontWeight:800,letterSpacing:0.6,textTransform:'uppercase',border:'1px solid var(--gold)',borderRadius:6,padding:'1px 6px'}}>through the night</span>
        )}
      </div>
      <div style={{display:'flex',gap:'clamp(14px,1.5vw,28px)'}}>
        <div>
          <div style={{fontFamily:'var(--display)',fontWeight:800,fontSize:'clamp(18px,1.4vw,24px)',color:'var(--text)'}}>{fmtDuration(run.awake)}</div>
          <div style={{color:'var(--muted)',fontSize:11,letterSpacing:1,textTransform:'uppercase',marginTop:2}}>Awake</div>
        </div>
        <div>
          <div style={{fontFamily:'var(--display)',fontWeight:800,fontSize:'clamp(18px,1.4vw,24px)',color:'var(--done)'}}>{fmtDuration(run.worked)}</div>
          <div style={{color:'var(--muted)',fontSize:11,letterSpacing:1,textTransform:'uppercase',marginTop:2}}>Worked</div>
        </div>
        <div>
          <div style={{fontFamily:'var(--display)',fontWeight:800,fontSize:'clamp(18px,1.4vw,24px)',color:'var(--red)'}}>{fmtDuration(run.wasted)}</div>
          <div style={{color:'var(--muted)',fontSize:11,letterSpacing:1,textTransform:'uppercase',marginTop:2}}>Wasted</div>
        </div>
      </div>
      <div style={{color:'var(--muted)',fontSize:12,marginTop:10}}>
        Up since {fmtTime(run.since)} · <span style={{color:'var(--done)',fontWeight:700}}>{pct}%</span> of it worked
      </div>
    </div>
  )
}
