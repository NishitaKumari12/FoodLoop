import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, BadgeCheck, CalendarClock, Check, Clock3, ImagePlus, LoaderCircle, MapPin, PackageCheck, Plus, RefreshCw, ShieldCheck, UtensilsCrossed, X } from 'lucide-react'
import { AxiosError } from 'axios'

import { approveNGO, authorizePickupVolunteer, claimDonation, confirmPickup, createDonation, downloadCertificate, generatePickupQr, getActiveVolunteers, getDonations, getPendingNGOs, rateDonation, rejectNGO, uploadDonationImage } from '../api/client'

function messageFromError(error) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join('. ')
    if (!error.response) return 'Cannot reach FoodLoop. Check that the backend is running and try again.'
  }
  return 'Something went wrong. Please try again.'
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const safetyChecklist = [
  ['cooked_safely', 'Food was prepared hygienically and within a safe time window.'],
  ['kept_at_safe_temperature', 'Food was kept at a safe temperature after preparation.'],
  ['sealed_packaging', 'Food is packed securely for transport.'],
  ['allergens_disclosed', 'Known allergens and ingredients are disclosed in the description.'],
]

const emptyForm = () => {
  const now = new Date()
  const deadline = new Date(now.getTime() + 60 * 60 * 1000)
  const toLocalInput = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  return {
    name: '',
    description: '',
    quantity_meals: '',
    food_type: 'vegetarian',
    prepared_at: toLocalInput(now),
    storage_instructions: '',
    packaging: '',
    pickup_deadline: toLocalInput(deadline),
    pickup_address: '',
    latitude: '',
    longitude: '',
    image_url: '',
    cooked_safely: false,
    kept_at_safe_temperature: false,
    sealed_packaging: false,
    allergens_disclosed: false,
  }
}

export default function DonationWorkspace({ role, user }) {
  if (role === 'donor') return <DonorWorkspace />
  if (role === 'ngo') return <NGOWorkspace user={user} />
  if (role === 'volunteer') return <VolunteerWorkspace />
  return <AdminWorkspace />
}

function WorkspaceCard({ icon: Icon, label, title, action, children }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-orange"><Icon size={15} /> {label}</p>
          <h2 className="mt-2 text-xl font-semibold text-forest">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function DonorWorkspace() {
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDonations(await getDonations())
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <WorkspaceCard
      icon={UtensilsCrossed}
      label="Donor workspace"
      title="Your food donations"
      action={
        <div className="flex gap-2">
          <button type="button" onClick={refresh} className="button-secondary !px-3" aria-label="Refresh donations"><RefreshCw size={16} /></button>
          <button type="button" onClick={() => setFormOpen((open) => !open)} className="button-primary !py-2.5">
            {formOpen ? <X size={16} /> : <Plus size={16} />} {formOpen ? 'Close form' : 'Post surplus food'}
          </button>
        </div>
      }
    >
      {formOpen && <DonationForm onCreated={(donation) => { setDonations((current) => [donation, ...current]); setFormOpen(false) }} />}
      <DonationList donations={donations} loading={loading} error={error} onRetry={refresh} audience="donor" />
    </WorkspaceCard>
  )
}

function DonationForm({ onCreated }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageName, setImageName] = useState('')

  function setValue(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const uploaded = await uploadDonationImage(file)
      setValue('image_url', uploaded.image_url)
      setImageName(file.name)
    } catch (uploadError) {
      setError(messageFromError(uploadError))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        quantity_meals: Number(form.quantity_meals),
        prepared_at: new Date(form.prepared_at).toISOString(),
        pickup_deadline: new Date(form.pickup_deadline).toISOString(),
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      }
      const donation = await createDonation(payload)
      onCreated(donation)
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-forest/10 bg-[#fbfcfa] p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-label sm:col-span-2">Food name
          <input className="workspace-input" required minLength={2} maxLength={120} value={form.name} onChange={(event) => setValue('name', event.target.value)} placeholder="e.g. Fresh vegetable rice bowls" />
        </label>
        <label className="form-label">Quantity (meals)
          <input className="workspace-input" type="number" min="1" max="100000" required value={form.quantity_meals} onChange={(event) => setValue('quantity_meals', event.target.value)} placeholder="40" />
        </label>
        <label className="form-label">Food preference
          <select className="form-select" value={form.food_type} onChange={(event) => setValue('food_type', event.target.value)}>
            <option value="vegetarian">Vegetarian</option>
            <option value="non_vegetarian">Non-vegetarian</option>
          </select>
        </label>
        <label className="form-label sm:col-span-2">Description and ingredients / allergens
          <textarea className="workspace-input min-h-24 py-3" required minLength={10} maxLength={4000} value={form.description} onChange={(event) => setValue('description', event.target.value)} placeholder="Describe the food, ingredients, and any known allergens." />
        </label>
        <label className="form-label">Prepared at
          <input className="workspace-input" type="datetime-local" required value={form.prepared_at} onChange={(event) => setValue('prepared_at', event.target.value)} />
        </label>
        <label className="form-label">Pickup deadline
          <input className="workspace-input" type="datetime-local" required value={form.pickup_deadline} onChange={(event) => setValue('pickup_deadline', event.target.value)} />
        </label>
        <label className="form-label">Storage instructions
          <input className="workspace-input" required maxLength={500} value={form.storage_instructions} onChange={(event) => setValue('storage_instructions', event.target.value)} placeholder="Keep refrigerated, serve warm…" />
        </label>
        <label className="form-label">Packaging
          <input className="workspace-input" required maxLength={300} value={form.packaging} onChange={(event) => setValue('packaging', event.target.value)} placeholder="Sealed, food-safe containers" />
        </label>
        <label className="form-label sm:col-span-2">Pickup address
          <input className="workspace-input" required minLength={5} maxLength={300} value={form.pickup_address} onChange={(event) => setValue('pickup_address', event.target.value)} placeholder="Street address and pickup instructions" />
          <span className="text-xs font-normal text-slate-500">The exact address is only shared with your account, administrators, and approved NGOs while the food is available.</span>
        </label>
        <label className="form-label">Latitude <span className="font-normal text-slate-400">(optional)</span>
          <input className="workspace-input" type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setValue('latitude', event.target.value)} placeholder="12.9716" />
        </label>
        <label className="form-label">Longitude <span className="font-normal text-slate-400">(optional)</span>
          <input className="workspace-input" type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setValue('longitude', event.target.value)} placeholder="77.5946" />
        </label>
        <div className="sm:col-span-2">
          <label className="form-label">Food photo <span className="font-normal text-slate-400">(optional · JPEG, PNG or WebP up to 5 MB)</span>
            <span className="flex flex-wrap items-center gap-3">
              <span className="relative inline-flex cursor-pointer items-center gap-2 rounded-xl border border-forest/15 bg-white px-4 py-2.5 text-sm font-semibold text-forest hover:bg-forest/5">
                {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                {uploading ? 'Uploading…' : 'Choose image'}
                <input className="absolute inset-0 cursor-pointer opacity-0" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={handleImage} aria-label="Upload food photo" />
              </span>
              {imageName && <span className="text-xs text-slate-500">Uploaded: {imageName}</span>}
            </span>
          </label>
        </div>
      </div>

      <fieldset className="mt-6 rounded-2xl border border-[#e4e9df] bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-forest">Food safety checklist — confirm every item to publish</legend>
        <div className="mt-1 grid gap-3">
          {safetyChecklist.map(([field, label]) => (
            <label key={field} className="flex items-start gap-3 text-sm leading-5 text-slate-600">
              <input className="mt-1 h-4 w-4 accent-[#174c37]" type="checkbox" required checked={form[field]} onChange={(event) => setValue(field, event.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500">Listings require a future pickup deadline.</span>
        <button type="submit" disabled={saving || uploading} className="button-primary disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <><LoaderCircle size={17} className="animate-spin" /> Publishing…</> : <>Publish donation <Check size={17} /></>}
        </button>
      </div>
    </form>
  )
}

function DonationList({ donations, loading, error, onRetry, audience }) {
  if (loading) {
    return <div className="flex items-center gap-3 py-12 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-forest" /> Loading donations…</div>
  }
  if (error) {
    return <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert"><p>{error}</p><button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 font-semibold"><RefreshCw size={14} /> Try again</button></div>
  }
  if (!donations.length) {
    return <div className="mt-6 rounded-2xl bg-[#f7f8f5] px-5 py-9 text-center"><PackageCheck className="mx-auto text-forest/35" size={28} /><p className="mt-3 font-semibold text-forest">{audience === 'donor' ? 'No donations yet' : 'No available donations right now'}</p><p className="mt-1 text-sm text-slate-500">{audience === 'donor' ? 'Post your first surplus listing to start the loop.' : 'Check again soon for nearby surplus food.'}</p></div>
  }
  return <div className="mt-6 space-y-3">{donations.map((donation) => <DonationCard key={donation.id} donation={donation} audience={audience} onClaimed={onRetry} />)}</div>
}

function DonationCard({ donation, audience, onClaimed }) {
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')
  const [qr, setQr] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [success, setSuccess] = useState('')
  const [volunteers, setVolunteers] = useState([])
  const [volunteerId, setVolunteerId] = useState('')
  const [authorizing, setAuthorizing] = useState(false)
  const [rating, setRating] = useState('5')
  const [rated, setRated] = useState(false)
  const statusStyles = {
    available: 'bg-emerald-50 text-emerald-800',
    claimed: 'bg-amber-50 text-amber-800',
    completed: 'bg-slate-100 text-slate-700',
    expired: 'bg-red-50 text-red-700',
  }

  useEffect(() => {
    if (audience !== 'ngo' || donation.status !== 'claimed') return
    let active = true
    getActiveVolunteers().then((items) => { if (active) setVolunteers(items) }).catch((requestError) => { if (active) setError(messageFromError(requestError)) })
    return () => { active = false }
  }, [audience, donation.status])

  async function handleClaim() {
    setClaiming(true)
    setError('')
    try {
      await claimDonation(donation.id)
      onClaimed()
    } catch (claimError) {
      setError(messageFromError(claimError))
    } finally {
      setClaiming(false)
    }
  }

  async function handleGenerateQr() {
    setError('')
    setSuccess('')
    setClaiming(true)
    try {
      setQr(await generatePickupQr(donation.id))
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setClaiming(false)
    }
  }

  async function handleAuthorizeVolunteer() {
    if (!volunteerId) return
    setAuthorizing(true)
    setError('')
    try {
      await authorizePickupVolunteer(donation.id, Number(volunteerId))
      setSuccess('Volunteer is authorized for this pickup.')
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setAuthorizing(false)
    }
  }

  async function handleConfirmPickup() {
    if (!qr?.token) return
    setConfirming(true)
    setError('')
    setSuccess('')
    try {
      const result = await confirmPickup(qr.token)
      setSuccess(`Pickup verified. Certificate ${result.certificate_number} is ready.`)
      setQr(null)
      onClaimed()
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setConfirming(false)
    }
  }

  async function handleDownloadCertificate() {
    setError('')
    try {
      const file = await downloadCertificate(donation.id)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = `foodloop-donation-${donation.id}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(messageFromError(requestError))
    }
  }

  async function handleRate() {
    setError('')
    try {
      await rateDonation(donation.id, { score: Number(rating) })
      setRated(true)
    } catch (requestError) {
      setError(messageFromError(requestError))
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        {donation.image_url && <img className="h-28 w-full rounded-xl object-cover sm:h-24 sm:w-28" src={donation.image_url} alt={donation.name} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-forest">{donation.name}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusStyles[donation.status] ?? 'bg-slate-100 text-slate-700'}`}>{donation.status}</span>
            <span className="rounded-full bg-[#f7f5ee] px-2.5 py-1 text-[11px] font-semibold text-slate-600">{donation.food_type.replace('_', ' ')}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{donation.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><UtensilsCrossed size={14} /> {donation.quantity_meals} meals</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> Pickup by {formatDate(donation.pickup_deadline)}</span>
            {donation.pickup_address && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {donation.pickup_address}</span>}
            {donation.claimed_by_ngo_name && <span className="inline-flex items-center gap-1.5"><BadgeCheck size={14} /> Claimed by {donation.claimed_by_ngo_name}</span>}
            {audience === 'donor' && <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} /> Prepared {formatDate(donation.prepared_at)}</span>}
          </div>
        </div>
        {audience === 'ngo' && donation.status === 'available' && (
          <button type="button" disabled={claiming} onClick={handleClaim} className="button-primary shrink-0 self-start !px-4 !py-2.5 disabled:opacity-60">
            {claiming ? <LoaderCircle size={16} className="animate-spin" /> : <PackageCheck size={16} />}
            {claiming ? 'Claiming…' : 'Claim food'}
          </button>
        )}
        {audience === 'ngo' && donation.status === 'claimed' && (
          <div className="flex flex-col gap-2 sm:w-48">
          <select className="form-select !h-10 text-xs" value={volunteerId} onChange={(event) => setVolunteerId(event.target.value)} aria-label="Authorize a volunteer">
            <option value="">Select pickup volunteer</option>
            {volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.full_name}</option>)}
          </select>
          <button type="button" disabled={!volunteerId || authorizing} onClick={handleAuthorizeVolunteer} className="button-secondary !px-3 !py-2 text-xs disabled:opacity-50">
            {authorizing ? <LoaderCircle size={14} className="animate-spin" /> : <BadgeCheck size={14} />} Authorize volunteer
          </button>
          <button type="button" disabled={claiming} onClick={handleGenerateQr} className="button-primary !px-3 !py-2.5 text-xs disabled:opacity-60">
            {claiming ? <LoaderCircle size={16} className="animate-spin" /> : <PackageCheck size={16} />}
            Generate pickup QR
          </button>
          </div>
        )}
        {donation.status === 'completed' && (audience === 'donor' || audience === 'ngo') && (
          <div className="flex flex-col gap-2"><button type="button" onClick={handleDownloadCertificate} className="button-secondary shrink-0 self-start !px-4 !py-2.5">
            <BadgeCheck size={16} /> Certificate
          </button>{!rated && <div className="flex gap-2"><select className="form-select !h-9 text-xs" aria-label="Rate handoff" value={rating} onChange={(event) => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} / 5</option>)}</select><button type="button" onClick={handleRate} className="button-secondary !h-9 !px-3 text-xs">Rate</button></div>}</div>
        )}
      </div>
      {qr && <div className="border-t border-slate-100 bg-[#f7f8f5] p-4 sm:p-5"><div className="flex flex-col items-center gap-4 sm:flex-row"><img className="h-36 w-36 rounded-xl border border-slate-200 bg-white p-2" src={qr.qr_code_data_url} alt={`One-time pickup verification QR for ${donation.name}`} /><div className="min-w-0 flex-1"><p className="font-semibold text-forest">One-time pickup QR</p><p className="mt-1 text-xs text-slate-500">Share this QR or token only with the authorized pickup representative. Expires {formatDate(qr.expires_at)}.</p><code className="mt-3 block break-all rounded-lg bg-white p-2 text-xs text-slate-700">{qr.token}</code><button type="button" onClick={handleConfirmPickup} disabled={confirming} className="button-primary mt-3 !py-2 disabled:opacity-60">{confirming ? <LoaderCircle size={15} className="animate-spin" /> : <BadgeCheck size={15} />} Confirm pickup and issue certificate</button></div></div></div>}
      {success && <p className="border-t border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800" role="status">{success}</p>}
      {rated && <p className="border-t border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800" role="status">Thanks for rating this handoff.</p>}
      {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
    </article>
  )
}

function NGOWorkspace({ user }) {
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDonations(await getDonations())
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (!user?.is_approved) {
    return (
      <WorkspaceCard icon={ShieldCheck} label="NGO verification" title="Approval is needed to claim food">
        <div className="mt-5 rounded-2xl border border-[#f1e4d7] bg-[#fff9f3] p-5">
          <p className="text-sm leading-6 text-slate-600">Your NGO account is registered, but it has not yet been approved by a FoodLoop administrator. Claims are disabled until approval. You can still browse available listings below; pickup addresses remain private.</p>
          <div className="mt-4"><DonationList donations={donations} loading={loading} error={error} onRetry={refresh} audience="volunteer" /></div>
        </div>
      </WorkspaceCard>
    )
  }

  return (
    <WorkspaceCard icon={PackageCheck} label="NGO workspace" title="Available & claimed donations" action={<button type="button" onClick={refresh} className="button-secondary !px-3" aria-label="Refresh donations"><RefreshCw size={16} /></button>}>
      <DonationList donations={donations} loading={loading} error={error} onRetry={refresh} audience="ngo" />
    </WorkspaceCard>
  )
}

function VolunteerWorkspace() {
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDonations(await getDonations({ status: 'available' }))
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <WorkspaceCard icon={MapPin} label="Volunteer pickup board" title="Food available near the community" action={<button type="button" onClick={refresh} className="button-secondary !px-3" aria-label="Refresh donations"><RefreshCw size={16} /></button>}>
      <p className="mt-3 text-sm leading-6 text-slate-500">Browse active food listings. Donation claims are coordinated by approved NGOs; authorized pickup verification arrives in a later phase.</p>
      <DonationList donations={donations} loading={loading} error={error} onRetry={refresh} audience="volunteer" />
    </WorkspaceCard>
  )
}

function AdminWorkspace() {
  const [ngos, setNgos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approving, setApproving] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setNgos(await getPendingNGOs())
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleApprove(id) {
    setApproving(id)
    setError('')
    try {
      await approveNGO(id)
      setNgos((current) => current.filter((ngo) => ngo.id !== id))
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setApproving(null)
    }
  }

  async function handleReject(id) {
    setApproving(id)
    setError('')
    try {
      await rejectNGO(id)
      setNgos((current) => current.filter((ngo) => ngo.id !== id))
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setApproving(null)
    }
  }

  return (
    <WorkspaceCard icon={ShieldCheck} label="Administrator" title="NGO approval queue" action={<button type="button" onClick={refresh} className="button-secondary !px-3" aria-label="Refresh NGO applications"><RefreshCw size={16} /></button>}>
      {loading ? <div className="flex items-center gap-3 py-12 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-forest" /> Loading NGO applications…</div> : error ? <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div> : ngos.length === 0 ? <div className="mt-6 rounded-2xl bg-[#f7f8f5] px-5 py-9 text-center"><BadgeCheck className="mx-auto text-forest/35" size={28} /><p className="mt-3 font-semibold text-forest">No pending NGO applications</p></div> : (
        <div className="mt-5 divide-y divide-slate-100">
          {ngos.map((ngo) => <div key={ngo.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold text-forest">{ngo.full_name}</p><p className="text-sm text-slate-500">{ngo.email}</p></div><div className="flex gap-2"><button type="button" disabled={approving === ngo.id} onClick={() => handleReject(ngo.id)} className="button-secondary !py-2.5 text-red-700 disabled:opacity-60">Reject</button><button type="button" disabled={approving === ngo.id} onClick={() => handleApprove(ngo.id)} className="button-primary !py-2.5 disabled:opacity-60">{approving === ngo.id ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />} Approve NGO</button></div></div>)}
        </div>
      )}
      <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><AlertCircle size={14} /> Approval enables the organization to claim available food.</p>
    </WorkspaceCard>
  )
}
