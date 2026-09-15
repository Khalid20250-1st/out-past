import React from 'react'
import StatBars from './StatBars.jsx'
import { fmtDuration, fmtDayShort, fmtDay } from '../lib/format.js'

export default function WeeklyView({ range }) {
  const { perDay, totalProductive, totalWasted, totalDone, avgCompletion } = range
  const weekWindow = perDay.reduce((a, d) => a + (d.windowMinutes || 0), 0) || 1

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>This Week</h1>
          <div className="sub">Last 7 days · {Math.round(avgCompletion)}% average completion</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h3>Weekly totals</h3>
          <StatBars
            productive={totalProductive}
            wasted={totalWasted}
            done={totalDone}
            scaleMax={weekWindow}
            doneMax={Math.max(totalDone, 1)}
          />
        </div>
        <div className="panel">
          <h3>At a glance</h3>
          <div className="tiles">
            <div className="tile">
              <div className="k">Productive</div>
              <div className="v teal">{fmtDuration(totalProductive)}</div>
            </div>
            <div className="tile">
              <div className="k">Wasted</div>
              <div className="v red">{fmtDuration(totalWasted)}</div>
            </div>
            <div className="tile">
              <div className="k">Events done</div>
              <div className="v">{totalDone}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ flex: 1 }}>
        <h3>7-day breakdown</h3>
        <div className="weekbars">
          {perDay.map((d) => {
            const pPct = d.completion   // productive share of that day's awake time
            const wPct = d.wastedPct    // wasted share of that day's awake time
            return (
              <div key={d.key} className={`weekbar ${d.isToday ? 'today' : ''}`}>
                <div className="pct">{Math.round(d.completion)}%</div>
                <div className="stack" title={`${fmtDuration(d.productive)} productive`}>
                  <div className="p" style={{ height: `${pPct}%` }} />
                  <div className="w" style={{ height: `${wPct}%` }} />
                </div>
                <div className="lbl">{fmtDayShort(d.date)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
