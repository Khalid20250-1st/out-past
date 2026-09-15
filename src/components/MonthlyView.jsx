import React from 'react'
import StatBars from './StatBars.jsx'
import { fmtDuration, fmtDay } from '../lib/format.js'

// green at increasing opacity by completion %
function heatColor(pct, elapsed) {
  if (!elapsed) return 'var(--track)'
  const a = Math.max(0.08, Math.min(1, pct / 100))
  return `rgba(46, 224, 106, ${a})`
}

export default function MonthlyView({ range }) {
  const { perDay, totalProductive, totalWasted, totalDone, avgCompletion, avgProductive } = range
  const monthWindow = perDay.reduce((a, d) => a + (d.windowMinutes || 0), 0) || 1

  const top5 = [...perDay]
    .filter((d) => d.elapsed > 0)
    .sort((a, b) => b.completion - a.completion)
    .slice(0, 5)

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>This Month</h1>
          <div className="sub">
            Last 30 days · {Math.round(avgCompletion)}% avg · {fmtDuration(avgProductive)} productive/day
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h3>Monthly totals</h3>
          <StatBars
            productive={totalProductive}
            wasted={totalWasted}
            done={totalDone}
            scaleMax={monthWindow}
            doneMax={Math.max(totalDone, 1)}
          />
        </div>
        <div className="panel">
          <h3>Averages</h3>
          <div className="tiles">
            <div className="tile">
              <div className="k">Avg completion</div>
              <div className="v teal">{Math.round(avgCompletion)}%</div>
            </div>
            <div className="tile">
              <div className="k">Avg productive</div>
              <div className="v">{fmtDuration(avgProductive)}</div>
            </div>
            <div className="tile">
              <div className="k">Total wasted</div>
              <div className="v red">{fmtDuration(totalWasted)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ flex: 1, alignItems: 'start' }}>
        <div className="panel">
          <h3>Heatmap</h3>
          <div className="heatmap">
            {perDay.map((d) => (
              <div
                key={d.key}
                className="heat-cell"
                title={`${fmtDay(d.date)} · ${Math.round(d.completion)}%`}
                style={{ background: heatColor(d.completion, d.elapsed) }}
              >
                {d.date.getDate()}
              </div>
            ))}
          </div>
          <div className="heat-legend">
            <span>Less</span>
            <div className="scale">
              {[0.1, 0.3, 0.55, 0.8, 1].map((a) => (
                <span key={a} style={{ background: `rgba(46,224,106,${a})` }} />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>

        <div className="panel">
          <h3>Top 5 days</h3>
          <div className="topdays">
            {top5.length === 0 && <div className="empty">No data yet</div>}
            {top5.map((d, i) => (
              <div key={d.key} className="topday">
                <div className="rank">{i + 1}</div>
                <div className="d">{fmtDay(d.date)}</div>
                <div className="v">{Math.round(d.completion)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
