import { useState, useEffect, useRef } from 'react'

export default function Goals({ onDone }) {
  const [goals, setGoals] = useState(['', '', ''])
  const [visible, setVisible] = useState([false, false, false, false, false])
  const [inputWidths, setInputWidths] = useState([0, 0, 0])
  const [fading, setFading] = useState(false)
  const allFilled = goals.every(g => g.trim().length > 0)
  const colors = ['#d98a68', '#c4633f', '#a94e2e']
  const placeholders = ['First non-negotiable...', 'Second non-negotiable...', 'Third non-negotiable...']

  useEffect(() => {
    [300, 500, 700].forEach((d, i) => {
      setTimeout(() => {
        setVisible(prev => { const n=[...prev]; n[i]=true; return n })
        setTimeout(() => setInputWidths(prev => { const n=[...prev]; n[i]=100; return n }), 80)
      }, d)
    })
    setTimeout(() => setVisible(prev => { const n=[...prev]; n[3]=true; return n }), 400)
    setTimeout(() => setVisible(prev => { const n=[...prev]; n[4]=true; return n }), 600)
  }, [])

  function update(i, val) {
    const n = [...goals]; n[i] = val; setGoals(n)
  }

  function submit() {
    if (!allFilled) return
    setFading(true)
    setTimeout(() => {
      localStorage.setItem('grow_daily_goals', JSON.stringify({ date: new Date().toDateString(), goals }))
      onDone()
    }, 700)
  }

  function skip() {
    setFading(true)
    setTimeout(() => { onDone() }, 500)
  }

  const blurOut = { opacity: fading ? 0 : 1, filter: fading ? 'blur(10px)' : 'blur(0px)', transform: fading ? 'scale(0.97)' : 'scale(1)', transition: 'opacity 0.6s ease, filter 0.6s ease, transform 0.6s ease' }

  return (
    <div style={{ width:'100%', height:'100vh', background:'linear-gradient(135deg,var(--bg-2) 0%,var(--bg) 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 32px', boxSizing:'border-box', fontFamily:'Inter,sans-serif', ...blurOut }}>
      <div style={{ color:'var(--muted)', fontSize:'11px', letterSpacing:'4px', textTransform:'uppercase', marginBottom:'14px', opacity:visible[3]?1:0, filter:visible[3]?'blur(0)':'blur(8px)', transform:visible[3]?'translateY(0)':'translateY(6px)', transition:'opacity 0.7s ease, filter 0.7s ease, transform 0.7s ease' }}>
        Good morning, Kidus
      </div>
      <div style={{ color:'var(--text)', fontSize:'26px', fontWeight:900, textAlign:'center', marginBottom:'6px', maxWidth:'460px', lineHeight:1.3, opacity:visible[3]?1:0, filter:visible[3]?'blur(0)':'blur(10px)', transform:visible[3]?'translateY(0)':'translateY(8px)', transition:'opacity 0.7s ease 0.1s, filter 0.7s ease 0.1s, transform 0.7s ease 0.1s' }}>
        What are your 3 non-negotiables today?
      </div>
      <div style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', marginBottom:'40px', opacity:visible[3]?1:0, filter:visible[3]?'blur(0)':'blur(6px)', transition:'opacity 0.6s ease 0.2s, filter 0.6s ease 0.2s' }}>
        These must get done. No exceptions.
      </div>

      <div style={{ width:'100%', maxWidth:'480px', display:'flex', flexDirection:'column', gap:'14px', marginBottom:'32px' }}>
        {goals.map((g, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', height:'52px', opacity:visible[i]?1:0, filter:visible[i]?'blur(0)':'blur(10px)', transform:visible[i]?'translateX(0)':'translateX(-12px)', transition:'opacity 0.6s ease, filter 0.6s ease, transform 0.6s ease' }}>
            <div style={{ padding:'14px 0', background:'var(--panel-2)', border:'1px solid var(--line)', borderRight:'none', borderRadius:'12px 0 0 12px', minWidth:'48px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:colors[i], fontWeight:900, fontSize:'22px' }}>{i+1}</span>
            </div>
            <div style={{ overflow:'hidden', width:inputWidths[i]+'%', transition:'width 0.6s cubic-bezier(0.4,0,0.2,1)' }}>
              <input
                value={g}
                onChange={e => update(i, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder={placeholders[i]}
                style={{ width:'100%', background:'var(--panel-2)', border:'1px solid var(--line)', borderLeft:'none', borderRadius:'0 12px 12px 0', padding:'14px 18px', color:'var(--text)', fontSize:'14px', fontFamily:'Inter,sans-serif', outline:'none', boxShadow:'inset 0 1px 0 var(--line)' }}
              />
            </div>
          </div>
        ))}
      </div>

      <button onClick={submit} style={{ background:'linear-gradient(180deg,#d98a68 0%,#a94e2e 100%)', color:'#000', border:'none', padding:'15px 52px', borderRadius:'12px', fontSize:'15px', fontWeight:900, cursor:allFilled?'pointer':'default', letterSpacing:'1.5px', opacity:allFilled?1:0, transform:allFilled?'translateY(0) scale(1)':'translateY(10px) scale(0.95)', transition:'opacity 0.5s ease, transform 0.5s ease', pointerEvents:allFilled?'all':'none' }}>
        LET'S GO →
      </button>

      <button onClick={skip} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'13px', fontWeight:600, letterSpacing:'0.5px', cursor:'pointer', marginTop:'20px', padding:'8px 16px', opacity:visible[4]?0.8:0, transition:'opacity 0.6s ease 0.3s, color 0.2s ease' }} onMouseEnter={e=>e.currentTarget.style.color='#d98a68'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}>
        Skip for now →
      </button>
    </div>
  )
}
