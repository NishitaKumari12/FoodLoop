import { useCallback, useEffect, useState } from 'react'
import { AxiosError } from 'axios'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BadgeCheck, Bell, ChartColumnIncreasing, HeartHandshake, LoaderCircle, MapPin, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'

import {
  createCommunityReport,
  confirmPledgeDistribution,
  confirmPickup,
  getAdminCommunityReports,
  getCommunityPledges,
  getCommunityNeeds,
  getImpactOverview,
  getLeaderboard,
  getMyCommunityReports,
  getPredictionHistory,
  pledgeCommunityMeals,
  predictSurplus,
  uploadCommunityPhoto,
  verifyCommunityNeed,
  getAdminUsers,
  setUserActive,
  getNotifications,
  markNotificationRead,
  rejectCommunityReport,
} from '../api/client'
import FoodMap from './FoodMap'

function errorText(error) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join('. ')
    if (!error.response) return 'Cannot reach the FoodLoop API. Check the backend terminal.'
  }
  return 'Something went wrong. Please try again.'
}

function Panel({ icon: Icon, label, title, action, children }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow"><Icon size={14} /> {label}</p><h2 className="mt-2 text-xl font-semibold text-forest">{title}</h2></div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function DashboardTools({ role, user }) {
  return (
    <div className="mt-7 space-y-6">
      <ImpactPanel />
      <NotificationsPanel />
      {role === 'donor' && <PredictionPanel />}
      {role !== 'admin' && <CommunityPanel role={role} user={user} />}
      {role === 'admin' && <><AdminUsersPanel /><AdminCommunityPanel /></>}
      <FoodMap />
      <LeaderboardPanel />
      {role === 'volunteer' && <VolunteerVerificationPanel />}
    </div>
  )
}

function ImpactPanel() {
  const [impact, setImpact] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setImpact(await getImpactOverview()) } catch (requestError) { setError(errorText(requestError)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  return (
    <Panel icon={ChartColumnIncreasing} label="Your impact" title="Every shared meal adds up" action={<button type="button" onClick={refresh} className="button-secondary !px-3" aria-label="Refresh impact"><RefreshCw size={16} /></button>}>
      {loading ? <p className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={17} /> Loading verified impact…</p> : error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p> : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ImpactStat value={impact.meals_saved} label="Meals saved" />
            <ImpactStat value={`${impact.food_waste_prevented_kg} kg`} label="Food waste prevented*" />
            <ImpactStat value={`${impact.co2_avoided_kg} kg`} label="Estimated CO₂ avoided*" />
            <ImpactStat value={impact.completed_donations} label="Verified handoffs" />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>{impact.ngos_onboarded} approved NGOs</span><span>{impact.community_needs_fulfilled} needs fulfilled</span><span>{impact.active_donations} active donations</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">* Demo estimates: 0.4 kg food and 1.0 kg CO₂e per verified meal. Replace with locally validated factors before public reporting.</p>
        </>
      )}
    </Panel>
  )
}

function ImpactStat({ value, label }) {
  return <div className="rounded-2xl bg-[#f7f8f5] p-4"><p className="text-2xl font-semibold tracking-tight text-forest">{Number.isFinite(value) ? value.toLocaleString() : value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{label}</p></div>
}

function NotificationsPanel() {
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setNotifications(await getNotifications()) } catch (requestError) { setError(errorText(requestError)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  async function markRead(id) {
    try {
      await markNotificationRead(id)
      setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, is_read: true } : notification))
    } catch (requestError) { setError(errorText(requestError)) }
  }
  return <Panel icon={Bell} label="Updates" title="Your notifications" action={<button type="button" onClick={refresh} className="button-secondary !px-3" aria-label="Refresh notifications"><RefreshCw size={16} /></button>}>{loading ? <p className="py-5 text-sm text-slate-500">Loading updates…</p> : error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : notifications.length === 0 ? <p className="mt-4 text-sm text-slate-500">No updates yet. You’ll see donation and pickup updates here.</p> : <div className="mt-4 divide-y divide-slate-100">{notifications.slice(0, 5).map((item) => <div key={item.id} className={`flex items-start gap-3 py-3 ${item.is_read ? 'opacity-65' : ''}`}><Bell className="mt-0.5 shrink-0 text-orange" size={16} /><div className="flex-1"><p className="text-sm font-semibold text-forest">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-slate-600">{item.message}</p></div>{!item.is_read && <button type="button" onClick={() => markRead(item.id)} className="text-xs font-semibold text-forest underline">Mark read</button>}</div>)}</div>}</Panel>
}

function PredictionPanel() {
  const [form, setForm] = useState({ day_of_week: String((new Date().getDay() + 1) % 7), attendance: '150', special_event: false, historical_surplus: '18', menu_category: 'rice' })
  const [history, setHistory] = useState([])
  const [prediction, setPrediction] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try { setHistory(await getPredictionHistory()) } catch (requestError) { setError(errorText(requestError)) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setPrediction(null)
    try {
      const result = await predictSurplus({
        ...form,
        day_of_week: Number(form.day_of_week),
        attendance: Number(form.attendance),
        historical_surplus: Number(form.historical_surplus),
      })
      setPrediction(result)
      await refresh()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }

  const chartData = history.slice(0, 8).reverse().map((item) => ({
    day: new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    'Historical surplus': item.historical_surplus,
    'Predicted surplus': item.predicted_meals,
  }))

  return (
    <Panel icon={Sparkles} label="Surplus forecast" title="Plan tomorrow with a little more confidence">
      <form className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={submit}>
        <label className="form-label">Day
          <select className="form-select" value={form.day_of_week} onChange={(event) => setForm({ ...form, day_of_week: event.target.value })}>
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
        </label>
        <label className="form-label">Expected attendance<input className="workspace-input" type="number" min="0" max="100000" required value={form.attendance} onChange={(event) => setForm({ ...form, attendance: event.target.value })} /></label>
        <label className="form-label">Past surplus<input className="workspace-input" type="number" min="0" max="100000" required value={form.historical_surplus} onChange={(event) => setForm({ ...form, historical_surplus: event.target.value })} /></label>
        <label className="form-label">Menu category
          <select className="form-select" value={form.menu_category} onChange={(event) => setForm({ ...form, menu_category: event.target.value })}>{['rice', 'bread', 'curry', 'snacks', 'mixed', 'other'].map((category) => <option key={category}>{category}</option>)}</select>
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium text-slate-600"><input className="h-4 w-4 accent-[#174c37]" type="checkbox" checked={form.special_event} onChange={(event) => setForm({ ...form, special_event: event.target.checked })} /> Special event</label>
        <div className="sm:col-span-2 lg:col-span-5"><button type="submit" disabled={loading} className="button-primary disabled:opacity-60">{loading ? <><LoaderCircle size={16} className="animate-spin" /> Forecasting…</> : <><Sparkles size={16} /> Predict surplus</>}</button></div>
      </form>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {prediction && <p className="mt-4 rounded-xl border border-forest/10 bg-[#f5f8f3] p-4 text-sm text-forest"><b>Expected surplus: {prediction.predicted_meals} meals.</b> {prediction.training_data}</p>}
      {chartData.length > 0 && <div className="mt-6 h-64" aria-label="Historical and predicted surplus chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="Historical surplus" fill="#b9c9ad" radius={[5, 5, 0, 0]} /><Bar dataKey="Predicted surplus" fill="#174c37" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>}
      <p className="mt-3 text-xs text-slate-400">Random Forest trained on clearly identified synthetic demo data. Forecasts are illustrative, not food-safety guidance.</p>
    </Panel>
  )
}

function CommunityPanel({ role, user }) {
  const [needs, setNeeds] = useState([])
  const [myReports, setMyReports] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [meals, setMeals] = useState('20')
  const [adults, setAdults] = useState('12')
  const [children, setChildren] = useState('8')
  const [latitude, setLatitude] = useState('12.9716')
  const [longitude, setLongitude] = useState('77.5946')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [items, own] = await Promise.all([getCommunityNeeds(), getMyCommunityReports()])
      setNeeds(items)
      setMyReports(own)
    } catch (requestError) { setError(errorText(requestError)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function submitReport(event) {
    event.preventDefault()
    setWorking('report')
    setError('')
    try {
      await createCommunityReport({ title, description, requested_meals: Number(meals), adults: Number(adults), children: Number(children), latitude: Number(latitude), longitude: Number(longitude), photo_url: photoUrl || null })
      setTitle('')
      setDescription('')
      await refresh()
    } catch (requestError) { setError(errorText(requestError)) } finally { setWorking('') }
  }

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setPhotoBusy(true)
    try {
      const result = await uploadCommunityPhoto(file)
      setPhotoUrl(result.photo_url)
    } catch (requestError) { setError(errorText(requestError)) } finally { setPhotoBusy(false); event.target.value = '' }
  }

  async function runAction(key, action) {
    setWorking(key)
    setError('')
    try { await action(); await refresh() } catch (requestError) { setError(errorText(requestError)) } finally { setWorking('') }
  }

  return (
    <Panel icon={HeartHandshake} label="Community needs" title="Verified needs and meal pledges" action={<button type="button" onClick={refresh} className="button-secondary !px-3" aria-label="Refresh community needs"><RefreshCw size={16} /></button>}>
      {role === 'volunteer' && <form onSubmit={submitReport} className="mt-5 rounded-2xl bg-[#f7f8f5] p-5">
        <h3 className="font-semibold text-forest">Report a community food need</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">Reports stay private until an approved NGO verifies them. Do not include names, phone numbers, or identifying details.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="form-label sm:col-span-2">Report title<input className="workspace-input" required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Meals needed in the community" /></label>
          <label className="form-label sm:col-span-2">Need description<textarea className="workspace-input min-h-20" required minLength={10} maxLength={3000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the need without identifiable personal information." /></label>
          <label className="form-label">Meals requested<input className="workspace-input" type="number" min="1" required value={meals} onChange={(event) => setMeals(event.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">Adults<input className="workspace-input" type="number" min="0" required value={adults} onChange={(event) => setAdults(event.target.value)} /></label>
            <label className="form-label">Children<input className="workspace-input" type="number" min="0" required value={children} onChange={(event) => setChildren(event.target.value)} /></label>
          </div>
          <label className="form-label">Latitude<input className="workspace-input" type="number" min="-90" max="90" step="any" required value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
          <label className="form-label">Longitude<input className="workspace-input" type="number" min="-180" max="180" step="any" required value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
          <label className="form-label sm:col-span-2">Community photo <span className="font-normal text-slate-400">optional; must not show identifiable faces</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={choosePhoto} className="text-sm text-slate-600" />{photoBusy && <span className="text-xs text-slate-500">Uploading…</span>}{photoUrl && <span className="text-xs text-forest">Photo added</span>}<span className="text-xs text-slate-400">Face removal is not automatic: only submit a photo after checking it yourself.</span></label>
        </div>
        <button type="submit" disabled={working === 'report' || photoBusy} className="button-primary mt-4 disabled:opacity-60">{working === 'report' ? <LoaderCircle size={16} className="animate-spin" /> : <MapPin size={16} />} Submit for NGO review</button>
      </form>}

      {role === 'ngo' && !user?.is_approved && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">An administrator must approve your NGO before you can review needs or coordinate pledges.</p>}
      {loading ? <p className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" /> Loading community reports…</p> : error ? <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p> : (
        <>
          <div className="mt-5 space-y-3">
            {needs.filter((need) => role === 'ngo' && user?.is_approved ? need.status === 'pending' || need.status === 'verified' : ['verified', 'fulfilled'].includes(need.status)).map((need) => <CommunityNeedCard key={need.id} need={need} role={role} approved={user?.is_approved} working={working} onAction={runAction} />)}
            {needs.filter((need) => role === 'ngo' && user?.is_approved ? need.status === 'pending' || need.status === 'verified' : ['verified', 'fulfilled'].includes(need.status)).length === 0 && <p className="rounded-2xl bg-[#f7f8f5] p-6 text-center text-sm text-slate-500">No visible community reports yet.</p>}
          </div>
          {role === 'volunteer' && myReports.length > 0 && <div className="mt-6 border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-forest">Your submitted reports</h3><div className="mt-3 space-y-2">{myReports.map((report) => <div key={report.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f8f5] p-3 text-sm"><span>{report.title}</span><span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium capitalize text-slate-600">{report.status}</span></div>)}</div></div>}
        </>
      )}
    </Panel>
  )
}

function CommunityNeedCard({ need, role, approved, working, onAction }) {
  const [pledgeMeals, setPledgeMeals] = useState('10')
  const remaining = Math.max(0, need.requested_meals - need.pledged_meals)
  return (
    <article className="rounded-2xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-forest">{need.title}</h3><span className="rounded-full bg-[#f7f5ee] px-2 py-1 text-[11px] font-semibold capitalize text-slate-600">{need.status}</span></div><p className="mt-1 text-sm leading-5 text-slate-600">{need.description}</p></div>
        {need.photo_url && <a className="text-xs font-semibold text-forest underline" href={need.photo_url} target="_blank" rel="noreferrer">View community photo</a>}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><span>{need.adults} adults · {need.children} children</span><span>{need.pledged_meals}/{need.requested_meals} meals pledged</span><span>{remaining} still needed</span></div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {role === 'ngo' && approved && need.status === 'pending' && <button type="button" disabled={working === `verify-${need.id}`} onClick={() => onAction(`verify-${need.id}`, () => verifyCommunityNeed(need.id))} className="button-primary !py-2">{working === `verify-${need.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <BadgeCheck size={15} />} Verify need</button>}
        {role === 'donor' && need.status === 'verified' && remaining > 0 && <><input aria-label="Meal pledge quantity" className="workspace-input !min-h-10 !w-28" type="number" min="1" max={remaining} value={pledgeMeals} onChange={(event) => setPledgeMeals(event.target.value)} /><button type="button" disabled={working === `pledge-${need.id}`} onClick={() => onAction(`pledge-${need.id}`, () => pledgeCommunityMeals(need.id, Number(pledgeMeals)))} className="button-primary !py-2">{working === `pledge-${need.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <HeartHandshake size={15} />} Pledge meals</button></>}
      </div>
      {role === 'ngo' && approved && need.status !== 'pending' && <NGOPledges needId={need.id} working={working} onAction={onAction} />}
    </article>
  )
}

function NGOPledges({ needId, working, onAction }) {
  const [pledges, setPledges] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getCommunityPledges(needId).then((result) => { if (active) setPledges(result) }).catch((requestError) => { if (active) setError(errorText(requestError)) })
    return () => { active = false }
  }, [needId])
  return <div className="mt-4 border-t border-slate-100 pt-3">{pledges.map((pledge) => <div key={pledge.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span>{pledge.meals} meals · pledged by {pledge.donor_name} · {pledge.status}</span>{pledge.status !== 'distributed' && <button type="button" disabled={working === `distribution-${pledge.id}`} onClick={() => onAction(`distribution-${pledge.id}`, async () => { await confirmPledgeDistribution(pledge.id); setPledges(await getCommunityPledges(needId)) })} className="font-semibold text-forest underline">Confirm distributed</button>}</div>)}{error && <p className="text-xs text-red-600">{error}</p>}</div>
}

function VolunteerVerificationPanel() {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      setResult(await confirmPickup(token.trim()))
      setToken('')
    } catch (requestError) { setError(errorText(requestError)) } finally { setLoading(false) }
  }
  return <Panel icon={BadgeCheck} label="Authorized pickup" title="Confirm a handoff">
    <p className="mt-3 text-sm leading-6 text-slate-500">Enter the one-time token provided by the NGO for your authorized pickup. Tokens expire and can only be used once.</p>
    <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
      <label className="sr-only" htmlFor="pickup-token">Pickup verification token</label>
      <input id="pickup-token" className="workspace-input" minLength={20} maxLength={200} required value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste the pickup token here" />
      <button type="submit" disabled={loading} className="button-primary shrink-0 disabled:opacity-60">{loading ? <LoaderCircle size={16} className="animate-spin" /> : <BadgeCheck size={16} />} Confirm pickup</button>
    </form>
    {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    {result && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">Handoff verified. Certificate {result.certificate_number} has been issued to the donor and NGO.</p>}
  </Panel>
}

function AdminUsersPanel() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setUsers(await getAdminUsers()) } catch (requestError) { setError(errorText(requestError)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  async function toggleUser(user) {
    setBusy(user.id)
    setError('')
    try {
      await setUserActive(user.id, !user.is_active)
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, is_active: !item.is_active } : item))
    } catch (requestError) { setError(errorText(requestError)) } finally { setBusy(null) }
  }
  return <Panel icon={ShieldCheck} label="Platform administration" title="User access" action={<button type="button" onClick={refresh} className="button-secondary !px-3" aria-label="Refresh users"><RefreshCw size={16} /></button>}>{loading ? <p className="py-6 text-sm text-slate-500">Loading users…</p> : error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : <div className="mt-4 divide-y divide-slate-100">{users.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-forest">{item.full_name} <span className="ml-1 rounded-full bg-[#f7f8f5] px-2 py-1 text-[10px] uppercase text-slate-500">{item.role}</span></p><p className="text-xs text-slate-500">{item.email}{item.role === 'ngo' ? ` · ${item.is_approved ? 'approved' : 'pending approval'}` : ''}</p></div><button type="button" disabled={busy === item.id} onClick={() => toggleUser(item)} className={item.is_active ? 'button-secondary !py-2 !text-xs' : 'button-primary !py-2 !text-xs'}>{busy === item.id ? <LoaderCircle size={14} className="animate-spin" /> : null}{item.is_active ? 'Deactivate' : 'Reactivate'}</button></div>)}</div>}</Panel>
}

function AdminCommunityPanel() {
  const [reports, setReports] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getAdminCommunityReports().then((items) => { if (active) setReports(items) }).catch((requestError) => { if (active) setError(errorText(requestError)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  async function rejectReport(id) {
    try {
      await rejectCommunityReport(id)
      setReports((items) => items.filter((report) => report.id !== id))
    } catch (requestError) { setError(errorText(requestError)) }
  }
  return <Panel icon={ShieldCheck} label="Admin review" title="Community reports awaiting verification">{loading ? <p className="py-6 text-sm text-slate-500">Loading reports…</p> : error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : reports.length ? <div className="mt-4 space-y-2">{reports.map((report) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f8f5] p-3" key={report.id}><div><p className="font-semibold text-forest">{report.title}</p><p className="text-xs text-slate-500">{report.requested_meals} meals · {report.reporter_name}</p></div><button type="button" onClick={() => rejectReport(report.id)} className="button-secondary !py-2 text-xs text-red-700">Reject report</button></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No reports awaiting review.</p>}</Panel>
}

function LeaderboardPanel() {
  const [period, setPeriod] = useState('weekly')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    getLeaderboard(period).then((entries) => { if (active) setRows(entries) }).catch((requestError) => { if (active) setError(errorText(requestError)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period])
  return (
    <Panel icon={BadgeCheck} label="Food heroes" title="Leaderboard · verified donations only" action={<select aria-label="Leaderboard period" className="form-select !h-10" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>}>
      {loading ? <p className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" /> Loading leaderboard…</p> : error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : rows.length === 0 ? <p className="mt-5 rounded-2xl bg-[#f7f8f5] p-6 text-center text-sm text-slate-500">Completed, verified handoffs will appear here. Be the first Food Hero!</p> : <div className="mt-4 divide-y divide-slate-100">{rows.map((entry, index) => <div className="flex items-center gap-3 py-3" key={entry.donor_id}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf1e9] text-sm font-bold text-forest">{index + 1}</span><div className="flex-1"><p className="font-semibold text-forest">{entry.donor_name}</p><p className="text-xs text-slate-500">{entry.meals_saved.toLocaleString()} meals · {entry.badge} Food Hero</p></div><BadgeCheck className="text-orange" size={19} /></div>)}</div>}
    </Panel>
  )
}
