import { ArrowLeft, ArrowRight, Clock3, HeartHandshake, LogOut, MapPin, ShieldCheck, Sprout, UtensilsCrossed } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import DonationWorkspace from '../components/DonationWorkspace'
import DashboardTools from '../components/DashboardTools'

const roleContent = {
  donor: {
    title: 'Make your surplus count.',
    description: 'Post surplus food, track who has claimed it, and keep pickup details organized in one place.',
    icon: UtensilsCrossed,
    tasks: ['Create a donation listing', 'Add safe handling and pickup details', 'Connect with a nearby organization'],
    status: 'Safety-checked donation listings are ready to use',
  },
  ngo: {
    title: 'Bring good food closer.',
    description: 'Browse available surplus, claim food for your community, and track your organization’s active claims.',
    icon: HeartHandshake,
    tasks: ['Complete organization onboarding', 'Find nearby food donations', 'Coordinate a verified handoff'],
    status: 'NGO claims require administrator approval',
  },
  volunteer: {
    title: 'Be the link in the loop.',
    description: 'Browse active food listings and pickup deadlines. Approved NGOs coordinate claims; pickup confirmation will follow in a later phase.',
    icon: MapPin,
    tasks: ['Find a nearby pickup', 'Coordinate a collection', 'Help confirm a safe handoff'],
    status: 'Available food listings are shown below',
  },
  admin: {
    title: 'Welcome to the platform workspace.',
    description: 'Review pending NGO applications and approve organizations to claim available food.',
    icon: ShieldCheck,
    tasks: ['Review organization applications', 'Monitor platform activity', 'Understand community impact'],
    status: 'NGO approvals are available in this phase',
  },
}

const roleNames = { donor: 'Food donor', ngo: 'NGO / community organization', volunteer: 'Volunteer', admin: 'Administrator' }

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const content = roleContent[user?.role] ?? roleContent.volunteer
  const RoleIcon = content.icon

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <header className="border-b border-forest/10 bg-white">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-2.5 font-bold text-forest">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-white"><Sprout size={21} /></span>
            <span className="text-xl">foodloop<span className="text-orange">.</span></span>
          </Link>
          <button type="button" onClick={handleLogout} className="button-quiet !gap-2">
            <LogOut size={16} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-forest"><ArrowLeft size={15} /> Home</Link>
        <section className="mt-7 overflow-hidden rounded-[2rem] bg-forest text-white">
          <div className="relative px-7 py-9 sm:px-10 sm:py-11">
            <div className="pointer-events-none absolute -right-16 -top-32 h-80 w-80 rounded-full border border-white/10" />
            <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/75"><RoleIcon size={14} /> {roleNames[user?.role] ?? 'FoodLoop member'}</span>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Hello, {user?.full_name?.split(' ')[0] ?? 'there'}.</h1>
                <p className="mt-3 text-lg font-medium text-[#f3a66d]">{content.title}</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">{content.description}</p>
              </div>
              <div className="flex h-24 w-24 shrink-0 items-center justify-center self-start rounded-[1.75rem] bg-white/10 sm:self-center"><RoleIcon size={42} strokeWidth={1.5} /></div>
            </div>
          </div>
        </section>

        <div className="mt-7"><DonationWorkspace role={user?.role} user={user} /></div>
        <DashboardTools role={user?.role} user={user} />
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-orange">Your account</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest text-sm font-bold text-white">{user?.full_name?.charAt(0)?.toUpperCase() ?? 'F'}</div>
                <div className="min-w-0"><p className="truncate font-semibold text-forest">{user?.full_name}</p><p className="truncate text-sm text-slate-500">{user?.email}</p></div>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><ShieldCheck size={15} className="text-forest" /> Signed in securely</div>
            </section>
            <section className="rounded-3xl border border-[#f1e4d7] bg-[#fff9f3] p-6 sm:p-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange"><Clock3 size={19} /></span>
              <h2 className="mt-4 font-semibold text-forest">Building the loop, one step at a time</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{content.status}. This account is connected to the live FoodLoop service.</p>
              <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest hover:text-orange">Explore FoodLoop <ArrowRight size={15} /></Link>
            </section>
        </div>
      </div>
    </main>
  )
}
