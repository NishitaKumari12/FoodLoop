import { ArrowDown, ArrowRight, Clock3, HandHeart, MapPin, Recycle, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'

import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../auth/AuthContext'

const steps = [
  {
    number: '01',
    icon: UtensilsCrossed,
    title: 'Share what is fresh',
    text: 'Food businesses post safe, surplus meals with pickup details and a clear collection window.',
  },
  {
    number: '02',
    icon: MapPin,
    title: 'Connect nearby',
    text: 'Local NGOs and volunteers can find available food and coordinate a timely pickup.',
  },
  {
    number: '03',
    icon: HandHeart,
    title: 'Get it to the table',
    text: 'A confirmed handoff helps food reach people instead of going to waste.',
  },
]

const features = [
  { icon: Clock3, title: 'Built around the clock', text: 'Clear pickup deadlines help everyone coordinate while food is still fresh.' },
  { icon: MapPin, title: 'Keep it close', text: 'A local-first approach helps donors and community partners find one another.' },
  { icon: ShieldCheck, title: 'Trust at every handoff', text: 'Role-based accounts create a foundation for accountable food redistribution.' },
  { icon: Recycle, title: 'A better use for surplus', text: 'Turn good food that might be discarded into a resource for the community.' },
]

export default function HomePage() {
  const { user } = useAuth()

  return (
    <>
      <SiteHeader user={user} />
      <main>
        <section className="hero-pattern relative overflow-hidden">
          <div className="pointer-events-none absolute -right-36 -top-32 h-[440px] w-[440px] rounded-full border border-forest/10" />
          <div className="pointer-events-none absolute -right-12 top-8 h-[300px] w-[300px] rounded-full border border-forest/10" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.05fr_.95fr] lg:gap-8 lg:py-32">
            <div className="max-w-2xl">
              <span className="eyebrow"><Sparkles size={14} /> A smarter way to share surplus</span>
              <h1 className="mt-7 text-5xl font-semibold leading-[1.08] tracking-[-0.055em] text-forest sm:text-6xl lg:text-[4.25rem]">
                From surplus to supper in <span className="text-orange">under 60 minutes.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                FoodLoop brings food businesses, community organizations and volunteers together to make good food go further.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to="/register?role=donor" className="button-primary">
                  I have food to share <ArrowRight size={17} />
                </Link>
                <Link to="/register?role=ngo" className="button-secondary">
                  I&apos;m here to help <ArrowRight size={17} />
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
                <span className="flex -space-x-2">
                  <span className="avatar-dot bg-[#e8b183]">D</span>
                  <span className="avatar-dot bg-[#9fb8a1]">N</span>
                  <span className="avatar-dot bg-[#e5cc8d]">V</span>
                </span>
                <span>For donors, NGOs &amp; local volunteers</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[500px]">
              <div className="absolute -left-3 top-14 h-64 w-64 rounded-full bg-[#e9eee2]" />
              <div className="absolute -right-5 bottom-8 h-48 w-48 rounded-full bg-[#f7dfca]" />
              <div className="relative rounded-[2rem] border border-white/80 bg-white/70 p-3 shadow-[0_30px_90px_-40px_rgba(23,76,55,.35)] backdrop-blur">
                <div className="overflow-hidden rounded-[1.5rem] bg-forest p-6 text-white sm:p-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/55">A simple idea</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">Good food. Shared well.</p>
                    </div>
                    <span className="rounded-2xl bg-white/10 p-3"><HandHeart size={23} /></span>
                  </div>
                  <div className="mt-8 space-y-3">
                    <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2a66d] text-forest"><UtensilsCrossed size={20} /></span>
                      <div><p className="font-semibold">Surplus food</p><p className="mt-0.5 text-sm text-white/60">Ready to be shared</p></div>
                      <ArrowRight className="ml-auto text-white/55" size={18} />
                    </div>
                    <div className="ml-8 h-6 border-l border-dashed border-white/35" />
                    <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d6dfc5] text-forest"><MapPin size={20} /></span>
                      <div><p className="font-semibold">A local partner</p><p className="mt-0.5 text-sm text-white/60">Ready to collect</p></div>
                      <ArrowRight className="ml-auto text-white/55" size={18} />
                    </div>
                    <div className="ml-8 h-6 border-l border-dashed border-white/35" />
                    <div className="flex items-center gap-4 rounded-2xl bg-[#f3a66d] p-4 text-forest">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/55"><HeartIcon /></span>
                      <div><p className="font-semibold">A meal that matters</p><p className="mt-0.5 text-sm text-forest/65">A better next stop</p></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-5 top-6 hidden items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-forest shadow-lg sm:flex">
                <span className="h-2 w-2 rounded-full bg-[#6e9a72]" /> Community-powered
              </div>
            </div>
          </div>
          <a href="#how-it-works" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs font-semibold uppercase tracking-widest text-forest/50 lg:flex">
            See how it works <ArrowDown size={14} />
          </a>
        </section>

        <section id="how-it-works" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <span className="eyebrow">Good food, better journey</span>
              <h2 className="section-title mt-4">A small handoff can make a big difference.</h2>
              <p className="mt-4 leading-7 text-slate-600">FoodLoop is designed to make the journey from surplus to community support straightforward, local and accountable.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {steps.map(({ number, icon: Icon, title, text }) => (
                <article key={number} className="step-card">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf1e9] text-forest"><Icon size={22} /></span>
                    <span className="text-sm font-semibold tracking-widest text-forest/30">{number}</span>
                  </div>
                  <h3 className="mt-7 text-xl font-semibold text-forest">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="our-impact" className="bg-cream py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <span className="eyebrow">Designed for the real world</span>
              <h2 className="section-title mt-4">More than a listing. A local food loop.</h2>
              <p className="mt-5 leading-7 text-slate-600">
                Redistributing food takes more than good intentions. It takes clear pickup details, trusted community partners and a dependable way to coordinate.
              </p>
              <Link to="/register" className="button-primary mt-7">
                Be part of the loop <ArrowRight size={17} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title} className="feature-card">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/5 text-forest"><Icon size={19} /></span>
                  <h3 className="mt-5 font-semibold text-forest">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="rounded-[2rem] bg-forest px-7 py-12 text-white sm:px-12 sm:py-14">
              <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="max-w-2xl">
                  <span className="text-xs font-bold uppercase tracking-[.18em] text-[#f3a66d]">A shared goal</span>
                  <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Better food systems start with better connections.</h2>
                  <p className="mt-4 max-w-xl leading-7 text-white/65">FoodLoop supports the spirit of UN Sustainable Development Goals 2 and 12: working toward food security and more responsible consumption.</p>
                </div>
                <div className="flex flex-wrap gap-3 lg:max-w-[300px]">
                  <a className="sdg-card" href="https://sdgs.un.org/goals/goal2" target="_blank" rel="noreferrer"><span>02</span><div><b>Zero Hunger</b><small>Support food access</small></div></a>
                  <a className="sdg-card" href="https://sdgs.un.org/goals/goal12" target="_blank" rel="noreferrer"><span>12</span><div><b>Responsible Consumption</b><small>Reduce food waste</small></div></a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f4eee4] px-5 py-16 text-center sm:px-8 sm:py-20">
          <span className="eyebrow justify-center">Every meal deserves a next stop</span>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-forest sm:text-4xl">Let&apos;s make good food go further.</h2>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register?role=donor" className="button-primary">Donate food <ArrowRight size={17} /></Link>
            <Link to="/register?role=ngo" className="button-secondary">Find food for your community <ArrowRight size={17} /></Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

function HeartIcon() {
  return <HandHeart size={21} aria-hidden="true" />
}
