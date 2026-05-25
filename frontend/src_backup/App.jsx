import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import {
  Shield, ShieldAlert, Activity, DollarSign, AlertTriangle,
  TrendingUp, Wifi, WifiOff, Play, Square, RefreshCw, Zap
} from 'lucide-react'
import axios from 'axios'
import './App.css'

const BACKEND_WS  = 'ws://localhost:8002/ws'
const BACKEND_API = 'http://localhost:8002'
const BANK_API    = 'http://localhost:8000'

// ── helpers
const fmt = (n) => n?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '0'
const fmtAmt = (n) => '$' + (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
const scoreColor = (s) => s >= 0.7 ? '#ef4444' : s >= 0.4 ? '#f59e0b' : '#10b981'
const scoreLabel = (s) => s >= 0.5 ? 'FRAUD' : 'LEGIT'
const timeStr = (ts) => ts ? new Date(ts).toLocaleTimeString() : ''

export default function App() {
  const [connected, setConnected]       = useState(false)
  const [streaming, setStreaming]       = useState(false)
  const [transactions, setTransactions] = useState([])
  const [stats, setStats]               = useState({ total:0, fraud_detected:0, total_amount:0, fraud_amount:0 })
  const [scoreHistory, setScoreHistory] = useState([])
  const [fraudAlerts, setFraudAlerts]   = useState([])
  const [rateHistory, setRateHistory]   = useState([])
  const ws = useRef(null)
  const tickRef = useRef(0)

  // ── WebSocket connection
  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return
    const socket = new WebSocket(BACKEND_WS)
    socket.onopen = () => setConnected(true)
    socket.onclose = () => { setConnected(false); setTimeout(connect, 3000) }
    socket.onerror = () => socket.close()

    socket.onmessage = (evt) => {
      const msg = JSON.parse(evt.data)
      if (msg.type === 'history') {
        setTransactions(msg.transactions.reverse())
        setStats(msg.stats)
      } else if (msg.type === 'transaction') {
        const tx = msg.data
        setTransactions(prev => [tx, ...prev].slice(0, 200))
        setStats(msg.stats)

        tickRef.current += 1
        setScoreHistory(prev => [...prev, {
          t: tickRef.current,
          score: tx.fraud_score,
          amt: tx.TransactionAmt,
        }].slice(-80))

        if (tx.synthetic_flag) {
          setFraudAlerts(prev => [tx, ...prev].slice(0, 20))
        }

        setRateHistory(prev => {
          const fraudRate = msg.stats.total > 0
            ? (msg.stats.fraud_detected / msg.stats.total * 100) : 0
          return [...prev, { t: tickRef.current, rate: +fraudRate.toFixed(2) }].slice(-60)
        })
      }
    }
    ws.current = socket
  }, [])

  useEffect(() => { connect(); return () => ws.current?.close() }, [connect])

  // ── Bank controls
  const startStream = async () => {
    try { await axios.post(`${BANK_API}/start?delay=0.4`); setStreaming(true) }
    catch { alert('Bank simulator not running on :8000') }
  }
  const stopStream = async () => {
    try { await axios.post(`${BANK_API}/stop`); setStreaming(false) }
    catch {}
  }

  const fraudRate = stats.total > 0
    ? (stats.fraud_detected / stats.total * 100).toFixed(2) : '0.00'

  return (
    <div className="app">
      {/* ── HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <Shield size={28} color="#3b82f6" />
            <span>FraudShield</span>
            <span className="logo-sub">Graph Intelligence</span>
          </div>
        </div>
        <div className="header-right">
          <div className={`ws-badge ${connected ? 'ws-on' : 'ws-off'}`}>
            {connected ? <Wifi size={14}/> : <WifiOff size={14}/>}
            {connected ? 'Live' : 'Disconnected'}
          </div>
          {!streaming
            ? <button className="btn btn-green" onClick={startStream}><Play size={14}/> Start Stream</button>
            : <button className="btn btn-red"   onClick={stopStream}><Square size={14}/> Stop</button>
          }
        </div>
      </header>

      <main className="main">
        {/* ── STAT CARDS */}
        <div className="stat-grid">
          <StatCard icon={<Activity size={20}/>}   label="Total Transactions" value={fmt(stats.total)}           accent="#3b82f6" />
          <StatCard icon={<ShieldAlert size={20}/>} label="Fraud Detected"     value={fmt(stats.fraud_detected)} accent="#ef4444" sub={`${fraudRate}% fraud rate`} />
          <StatCard icon={<DollarSign size={20}/>}  label="Total Volume"       value={fmtAmt(stats.total_amount)} accent="#10b981" />
          <StatCard icon={<AlertTriangle size={20}/>} label="Fraud Amount"     value={fmtAmt(stats.fraud_amount)} accent="#f59e0b" sub="blocked value" />
        </div>

        {/* ── CHARTS ROW */}
        <div className="charts-row">
          <div className="card chart-card">
            <div className="card-title"><Zap size={15}/> Live Fraud Scores</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={scoreHistory} margin={{top:5,right:5,left:-20,bottom:0}}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2d45"/>
                <XAxis dataKey="t" hide/>
                <YAxis domain={[0,1]} tick={{fill:'#64748b',fontSize:11}}/>
                <Tooltip
                  contentStyle={{background:'#111827',border:'1px solid #1f2d45',borderRadius:'8px'}}
                  labelStyle={{color:'#94a3b8'}}
                  formatter={(v) => [v.toFixed(3),'Score']}
                />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" fill="url(#sg)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card chart-card">
            <div className="card-title"><TrendingUp size={15}/> Fraud Rate % (rolling)</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={rateHistory} margin={{top:5,right:5,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2d45"/>
                <XAxis dataKey="t" hide/>
                <YAxis tick={{fill:'#64748b',fontSize:11}} unit="%"/>
                <Tooltip
                  contentStyle={{background:'#111827',border:'1px solid #1f2d45',borderRadius:'8px'}}
                  formatter={(v) => [`${v}%`,'Rate']}
                />
                <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card alerts-card">
            <div className="card-title"><ShieldAlert size={15}/> Fraud Alerts</div>
            <div className="alerts-list">
              {fraudAlerts.length === 0
                ? <div className="no-alerts">No fraud detected yet</div>
                : fraudAlerts.map((tx, i) => (
                  <AlertRow key={i} tx={tx}/>
                ))
              }
            </div>
          </div>
        </div>

        {/* ── TRANSACTION TABLE */}
        <div className="card table-card">
          <div className="card-title">
            <Activity size={15}/> Live Transaction Feed
            <span className="tx-count">{transactions.length} transactions</span>
          </div>
          <div className="table-wrap">
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Tx ID</th>
                  <th>Amount</th>
                  <th>Card</th>
                  <th>Device</th>
                  <th>Email Domain</th>
                  <th>Fraud Score</th>
                  <th>Card Risk</th>
                  <th>Device Risk</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 100).map((tx, i) => (
                  <TxRow key={tx.TransactionID ?? i} tx={tx} fresh={i === 0}/>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, accent, sub }) {
  return (
    <div className="stat-card" style={{'--accent-c': accent}}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  )
}

function AlertRow({ tx }) {
  return (
    <div className="alert-row">
      <div className="alert-id">TX {tx.TransactionID}</div>
      <div className="alert-meta">
        <span className="alert-amt">{fmtAmt(tx.TransactionAmt)}</span>
        <span className="alert-score" style={{color: scoreColor(tx.fraud_score)}}>
          {(tx.fraud_score * 100).toFixed(0)}%
        </span>
      </div>
      <div className="alert-time">{timeStr(tx.timestamp)}</div>
    </div>
  )
}

function TxRow({ tx, fresh }) {
  const score = tx.fraud_score ?? 0
  const isFraud = tx.synthetic_flag
  return (
    <tr className={`tx-row ${isFraud ? 'tx-fraud' : ''} ${fresh ? 'tx-fresh' : ''}`}>
      <td className="td-muted">{timeStr(tx.timestamp)}</td>
      <td className="td-id">{tx.TransactionID}</td>
      <td className="td-amt">{fmtAmt(tx.TransactionAmt)}</td>
      <td className="td-muted">{String(tx.card1).slice(0,8)}</td>
      <td className="td-muted">{String(tx.DeviceType)}</td>
      <td className="td-muted">{String(tx.P_emaildomain).slice(0,18)}</td>
      <td>
        <div className="score-bar-wrap">
          <div className="score-bar" style={{width:`${score*100}%`, background: scoreColor(score)}}/>
          <span className="score-num" style={{color: scoreColor(score)}}>{score.toFixed(3)}</span>
        </div>
      </td>
      <td>
        <span className="risk-pill" style={{background: score >= 0.3 ? '#451a1a' : '#0f2d1a', color: scoreColor(tx.card_fraud_rate ?? 0)}}>
          {((tx.card_fraud_rate ?? 0)*100).toFixed(1)}%
        </span>
      </td>
      <td>
        <span className="risk-pill" style={{background: '#1a1f2d', color: scoreColor(tx.device_fraud_rate ?? 0)}}>
          {((tx.device_fraud_rate ?? 0)*100).toFixed(1)}%
        </span>
      </td>
      <td>
        <span className={`decision-badge ${isFraud ? 'badge-decline' : 'badge-approve'}`}>
          {isFraud ? 'DECLINE' : 'APPROVE'}
        </span>
      </td>
    </tr>
  )
}
