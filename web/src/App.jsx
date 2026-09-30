import { useMemo, useState } from 'react'
import data from './ews.json'

const { thresholds: T, actions: ACTIONS, cohortActions: COHORT_ACTIONS, partners, cohorts, students } = data
const RISK = ['High Risk', 'Watch', 'On track']
const RISK_COLOR = { 'High Risk': 'var(--critical)', Watch: 'var(--warning)', 'On track': 'var(--good)' }
const ALERT_COLOR = { Red: 'var(--critical)', Amber: 'var(--warning)', Green: 'var(--good)', 'Too small': 'var(--muted)' }
const ALERT_ORDER = { Red: 0, Amber: 1, Green: 2, 'Too small': 3 }

const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`)
const num = (v) => (v == null ? '–' : Math.round(v).toLocaleString())
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const quantile = (s, q) => {
  const i = (s.length - 1) * q, lo = Math.floor(i)
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo)
}

const Dot = ({ color }) => <span className="dot" style={{ background: color }} />
const Status = ({ alert }) => <span className="status"><Dot color={ALERT_COLOR[alert]} />{alert}</span>

function Tile({ label, value, sub }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

function Method() {
  return (
    <details className="card method">
      <summary>What does a flag mean? (method in 30 seconds)</summary>
      <p>Each <b>completer</b> is checked against three simple signals:</p>
      <div className="scroll">
        <table>
          <thead><tr><th>Signal</th><th>Rule</th><th>Why it matters</th></tr></thead>
          <tbody>
            <tr><td><b>Fast</b></td><td>Finished in &lt; {pct(T.fast)} of planned time (planned = course hours ÷ planned hours/week; ≈25 days for the 109-hour course)</td><td>Too little time for the content</td></tr>
            <tr><td><b>Compressed assessments</b></td><td>All module assessments submitted on ≤ {T.compressed} days</td><td>Modules done in one sitting</td></tr>
            <tr><td><b>Low lesson coverage</b></td><td>&lt; {pct(T.lessons)} of lessons logged complete</td><td>Passed assessments without the content</td></tr>
          </tbody>
        </table>
      </div>
      <p><b>On track</b> = 0 signals · <b>Watch</b> = 1 signal · <b>High Risk</b> = 2 or more. A <i>Fast only</i> student who did the lessons and spread the assessments out is treated as a likely genuine fast learner (Watch, not High Risk).</p>
      <p><b>Cohort alert</b> = share of completers who are High Risk: Red ≥ {pct(T.red)} · Amber ≥ {pct(T.amber)} · Green below that · fewer than {T.min} completers = too small to rate (students still reviewed individually). A flag is a prompt to verify, <b>not</b> proof of misconduct.</p>
    </details>
  )
}

// Horizontal bars in plain CSS; `marks` draws dashed threshold lines.
function HBars({ rows, max, format, marks = [] }) {
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.key} title={r.title}>
          <div className="hbar-label">{r.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
            {marks.map((m) => <div key={m.label} className="hbar-mark" style={{ left: `${(m.value / max) * 100}%`, borderColor: m.color }} />)}
          </div>
          <div className="hbar-value">{format(r.value)}</div>
        </div>
      ))}
      {marks.length > 0 && (
        <div className="hbar hbar-legend">
          <div className="hbar-label" />
          <div className="hbar-track bare">
            {marks.map((m) => <span key={m.label} style={{ left: `${(m.value / max) * 100}%`, color: m.color }}>{m.label}</span>)}
          </div>
          <div className="hbar-value" />
        </div>
      )}
    </div>
  )
}

function Legend({ items }) {
  return <div className="legend">{items.map(([l, c]) => <span key={l}><Dot color={c} />{l}</span>)}</div>
}

function Histogram({ rows, planned }) {
  const MAXD = 60, W = 600, H = 280, m = { l: 40, r: 10, t: 24, b: 34 }
  const bins = Array.from({ length: MAXD }, (_, i) => ({ d: i + 1, 'High Risk': 0, Watch: 0, 'On track': 0 }))
  rows.forEach((s) => { if (s.days_to_complete <= MAXD) bins[s.days_to_complete - 1][s.risk]++ })
  const top = Math.max(...bins.map((b) => RISK.reduce((a, k) => a + b[k], 0)))
  const yMax = Math.ceil(top / 50) * 50
  const x = (d) => m.l + ((d - 1) / MAXD) * (W - m.l - m.r)
  const y = (v) => H - m.b - (v / yMax) * (H - m.t - m.b)
  const bw = (W - m.l - m.r) / MAXD - 1
  const vline = (d, label, color, dash) => (
    <g>
      <line x1={x(d)} x2={x(d)} y1={m.t - 6} y2={H - m.b} stroke={color} strokeDasharray={dash} strokeWidth="1.5" />
      <text x={x(d) + 4} y={m.t - 8} className="svg-note" fill={color}>{label}</text>
    </g>
  )
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Histogram of days to complete by risk">
      {Array.from({ length: yMax / 50 + 1 }, (_, i) => i * 50).map((v) => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={m.l - 6} y={y(v) + 4} textAnchor="end" className="svg-tick">{v}</text>
        </g>
      ))}
      {bins.map((b) => {
        let acc = 0
        return RISK.map((k) => {
          if (!b[k]) return null
          const y0 = y(acc), y1 = y((acc += b[k]))
          return (
            <rect key={`${b.d}${k}`} x={x(b.d)} y={y1} width={bw} height={y0 - y1} fill={RISK_COLOR[k]}>
              <title>{`${b.d} days · ${k}: ${b[k]} students`}</title>
            </rect>
          )
        })
      })}
      {[10, 20, 30, 40, 50, 60].map((d) => <text key={d} x={x(d) + bw / 2} y={H - m.b + 16} textAnchor="middle" className="svg-tick">{d}</text>)}
      <text x={(W + m.l) / 2} y={H - 4} textAnchor="middle" className="svg-tick">Days from joining to final assessment</text>
      {vline(planned * T.fast, 'Fast threshold', 'var(--critical)', '3 3')}
      {vline(planned, `Planned ≈ ${Math.round(planned)} days`, 'var(--ink)', '6 4')}
    </svg>
  )
}

function BoxPlot({ rows }) {
  const W = 600, H = 280, m = { l: 40, r: 10, t: 16, b: 34 }, lo = 60, hi = 100
  const y = (v) => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b)
  const colW = (W - m.l - m.r) / RISK.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Quiz score distribution by risk">
      {[60, 70, 80, 90, 100].map((v) => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={m.l - 6} y={y(v) + 4} textAnchor="end" className="svg-tick">{v}</text>
        </g>
      ))}
      {RISK.map((k, i) => {
        const s = rows.filter((r) => r.risk === k && r.average_quiz_score != null).map((r) => r.average_quiz_score).sort((a, b) => a - b)
        const q1 = quantile(s, 0.25), q2 = quantile(s, 0.5), q3 = quantile(s, 0.75), iqr = q3 - q1
        const wlo = s.find((v) => v >= q1 - 1.5 * iqr), whi = [...s].reverse().find((v) => v <= q3 + 1.5 * iqr)
        const cx = m.l + colW * (i + 0.5), bw = colW * 0.4, c = RISK_COLOR[k]
        return (
          <g key={k}>
            <title>{`${k}: median ${q2}, middle half ${q1}–${q3} (n=${s.length})`}</title>
            <line x1={cx} x2={cx} y1={y(whi)} y2={y(wlo)} stroke={c} strokeWidth="2" />
            <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(whi)} y2={y(whi)} stroke={c} strokeWidth="2" />
            <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(wlo)} y2={y(wlo)} stroke={c} strokeWidth="2" />
            <rect x={cx - bw / 2} y={y(q3)} width={bw} height={y(q1) - y(q3)} fill={c} fillOpacity="0.25" stroke={c} strokeWidth="2" rx="4" />
            <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(q2)} y2={y(q2)} stroke={c} strokeWidth="3" />
            <text x={cx} y={H - m.b + 18} textAnchor="middle" className="svg-tick">{k}</text>
          </g>
        )
      })}
      <text x={12} y={(H - m.b + m.t) / 2} transform={`rotate(-90 12 ${(H - m.b + m.t) / 2})`} textAnchor="middle" className="svg-tick">Average quiz score</text>
    </svg>
  )
}

export default function App() {
  const rated = cohorts.filter((c) => c.alert !== 'Too small')
  const planned = median(students.map((s) => s.planned_days))
  const count = (k) => students.filter((s) => s.risk === k).length

  const signals = useMemo(() => {
    const m = {}
    students.forEach((s) => { if (s.signals) m[s.signals] = (m[s.signals] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [])

  const options = useMemo(
    () => [...cohorts].sort((a, b) => ALERT_ORDER[a.alert] - ALERT_ORDER[b.alert] || (b.pct_high_risk ?? -1) - (a.pct_high_risk ?? -1)),
    [],
  )
  const [bid, setBid] = useState(options[0].batch_id)
  const [flaggedOnly, setFlaggedOnly] = useState(true)
  const row = options.find((c) => c.batch_id === bid)
  const shown = students
    .filter((s) => s.batch_id === bid && (!flaggedOnly || s.risk !== 'On track'))
    .sort((a, b) => RISK.indexOf(a.risk) - RISK.indexOf(b.risk) || a.days_to_complete - b.days_to_complete)

  return (
    <main>
      <header>
        <h1>Early Completion Warning System</h1>
        <p className="muted">UDFI Philippines · Employability Skills course · prototype on supplied LMS extract (Feb–May 2025)</p>
      </header>

      <Method />

      <section className="tiles">
        <Tile label="Completers assessed" value={students.length.toLocaleString()} sub={`of ${data.enrolled.toLocaleString()} enrolled`} />
        <Tile label="High Risk completers" value={pct(count('High Risk') / students.length)} sub={`${count('High Risk')} students`} />
        <Tile label="Red cohorts" value={rated.filter((c) => c.alert === 'Red').length} sub={`of ${rated.length} rated cohorts`} />
        <Tile label="Median days to complete" value={median(students.map((s) => s.days_to_complete))} sub={`planned ≈ ${Math.round(planned)}`} />
        <Tile label="Completed < half planned time" value={pct(students.filter((s) => s.flag_fast).length / students.length)} sub="Fast signal" />
      </section>

      <h2>Risk overview</h2>
      <section className="grid2">
        <div className="card">
          <h3>Completers by risk category</h3>
          <HBars rows={RISK.map((k) => ({ key: k, label: k, value: count(k), color: RISK_COLOR[k] }))}
                 max={Math.max(...RISK.map(count))} format={num} />
        </div>
        <div className="card">
          <h3>What triggered the flags</h3>
          <div className="scroll">
            <table>
              <thead><tr><th>Signal combination</th><th className="r">Students</th></tr></thead>
              <tbody>{signals.map(([k, v]) => <tr key={k}><td>{k}</td><td className="r">{v}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <h2>Partner &amp; cohort view</h2>
      <div className="card scroll">
        <table>
          <thead>
            <tr><th>Partner</th><th className="r">Enrolled</th><th className="r">Completers</th><th>% High Risk</th><th className="r">% Fast</th>
              <th className="r">% Compressed</th><th className="r">% Low lessons</th><th className="r">Median days</th><th className="r">Avg quiz score</th><th>Alert</th></tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.institute_name}>
                <td>{p.institute_name}</td><td className="r">{p.enrolled}</td><td className="r">{p.completers}</td>
                <td><div className="minibar"><div style={{ width: pct(p.pct_high_risk ?? 0) }} /></div>{pct(p.pct_high_risk)}</td>
                <td className="r">{pct(p.pct_fast)}</td><td className="r">{pct(p.pct_compressed)}</td><td className="r">{pct(p.pct_low_lessons)}</td>
                <td className="r">{num(p.median_days)}</td><td className="r">{num(p.avg_score)}</td><td><Status alert={p.alert} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>% of completers High Risk, by cohort (cohorts with ≥ {T.min} completers)</h3>
        <Legend items={['Red', 'Amber', 'Green'].map((a) => [a, ALERT_COLOR[a]])} />
        <HBars
          rows={[...rated].sort((a, b) => b.pct_high_risk - a.pct_high_risk).map((c) => ({
            key: c.batch_id, label: c.batch_name, value: c.pct_high_risk, color: ALERT_COLOR[c.alert],
            title: `${c.batch_name} · ${c.institute_name} · ${c.completers} completers · median ${c.median_days} days`,
          }))}
          max={1} format={pct}
          marks={[{ value: T.amber, label: 'Amber 15%', color: 'var(--warning-ink)' }, { value: T.red, label: 'Red 30%', color: 'var(--critical)' }]}
        />
      </div>

      <h2>Completion pacing</h2>
      <section className="grid2">
        <div className="card">
          <h3>Days from joining to final assessment (completers)</h3>
          <Legend items={RISK.map((k) => [k, RISK_COLOR[k]])} />
          <Histogram rows={students} planned={planned} />
        </div>
        <div className="card">
          <h3>Quiz scores do not separate rushed from engaged learners</h3>
          <BoxPlot rows={students} />
        </div>
      </section>
      <p className="muted small">High Risk students score as high as (or higher than) On-track students, so passing the quiz is not, on its own, evidence of learning. Assessment design and proctoring should be reviewed alongside the EWS.</p>

      <h2>Cohort drill-down</h2>
      <label className="field">
        <span>Select cohort (sorted by risk)</span>
        <select value={bid} onChange={(e) => setBid(Number(e.target.value))}>
          {options.map((c) => <option key={c.batch_id} value={c.batch_id}>{`${c.alert} · ${c.batch_name} — ${c.institute_name}`}</option>)}
        </select>
      </label>
      <section className="tiles">
        <Tile label="Alert" value={<Status alert={row.alert} />} />
        <Tile label="Completers" value={`${row.completers} / ${row.enrolled}`} />
        <Tile label="% High Risk" value={row.completers ? pct(row.pct_high_risk) : '–'} />
        <Tile label="Median days" value={row.completers ? num(row.median_days) : '–'} />
        <Tile label="Scheduled batch window" value={`${row.scheduled_window_days} days`} />
      </section>
      <div className="callout"><b>Recommended action:</b> {row.action}</div>
      <label className="toggle">
        <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} /> Show flagged students only
      </label>
      <div className="card scroll">
        <table>
          <thead>
            <tr><th>Student ID</th><th>Risk</th><th>Signals</th><th className="r">Days</th><th className="r">Assessment days</th>
              <th className="r">Lessons done</th><th className="r">Avg score</th><th>Action</th></tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan="8" className="muted">No students to show.</td></tr>}
            {shown.map((s) => (
              <tr key={s.student_id}>
                <td className="mono">{s.student_id}</td>
                <td><span className="status"><Dot color={RISK_COLOR[s.risk]} />{s.risk}</span></td>
                <td>{s.signals}</td><td className="r">{s.days_to_complete}</td><td className="r">{s.assessment_days}</td>
                <td className="r">{pct(s.lesson_pct)}</td><td className="r">{num(s.average_quiz_score)}</td><td>{ACTIONS[s.risk]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Recommended actions (per SOP)</h2>
      <section className="grid2">
        <div>
          <h3>Student level</h3>
          <ul>{Object.entries(ACTIONS).map(([k, v]) => <li key={k}><Dot color={RISK_COLOR[k]} /><b>{k}</b> → {v}</li>)}</ul>
        </div>
        <div>
          <h3>Cohort level</h3>
          <ul>{Object.entries(COHORT_ACTIONS).map(([k, v]) => <li key={k}><Dot color={ALERT_COLOR[k]} /><b>{k}</b> → {v}</li>)}</ul>
        </div>
      </section>
    </main>
  )
}
