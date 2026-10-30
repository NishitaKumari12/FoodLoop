import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Sprout, UserRound } from 'lucide-react'
import { AxiosError } from 'axios'

import { useAuth } from '../auth/AuthContext'

const roleOptions = [
  { value: 'donor', label: 'Food donor', description: 'Restaurant, cafe, hotel or canteen' },
  { value: 'ngo', label: 'NGO / community organization', description: 'Find and coordinate food support' },
  { value: 'volunteer', label: 'Volunteer', description: 'Help with local food pickups' },
]

function getErrorMessage(error) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join('. ')
    if (!error.response) return 'Cannot reach FoodLoop right now. Check that the backend is running and try again.'
  }
  return 'Something went wrong. Please try again.'
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(['donor', 'ngo', 'volunteer'].includes(searchParams.get('role')) ? searchParams.get('role') : 'donor')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const session = isRegister
        ? await register({ full_name: name.trim(), email: email.trim(), password, role })
        : await login({ email: email.trim(), password })
      navigate(session ? '/dashboard' : '/login', { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-aside hidden lg:flex">
        <div className="relative z-10 flex h-full w-full max-w-lg flex-col justify-between">
          <Link to="/" className="inline-flex items-center gap-2.5 text-xl font-bold tracking-tight text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Sprout size={22} /></span>
            foodloop<span className="text-orange">.</span>
          </Link>
          <div>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/65">A better food future</span>
            <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight text-white">Good food should find its way.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/65">Join the people turning surplus into support for local communities.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/55">
            <ShieldCheck size={18} className="text-[#f3a66d]" /> Secure, role-based access for your organization
          </div>
        </div>
      </section>

      <section className="flex min-h-screen flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-[460px]">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-forest">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <div className="mt-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest text-white lg:hidden"><Sprout size={24} /></span>
            <p className="mt-7 text-sm font-semibold uppercase tracking-[.16em] text-orange">{isRegister ? 'Join the community' : 'Welcome back'}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-forest">{isRegister ? 'Create your account' : 'Log in to FoodLoop'}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">{isRegister ? 'Tell us how you would like to take part.' : 'Enter your details to open your FoodLoop workspace.'}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {isRegister && (
              <>
                <label className="form-label">
                  Full name
                  <span className="input-wrap"><UserRound size={17} /><input autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name or organization contact" /></span>
                </label>
                <label className="form-label">
                  I&apos;m joining as
                  <select className="form-select" value={role} onChange={(event) => setRole(event.target.value)}>
                    {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <span className="mt-1 text-xs font-normal text-slate-500">{roleOptions.find((option) => option.value === role)?.description}</span>
                </label>
              </>
            )}
            <label className="form-label">
              Email address
              <span className="input-wrap"><Mail size={17} /><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@organization.org" /></span>
            </label>
            <label className="form-label">
              Password
              <span className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 8 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'At least 8 characters' : 'Your password'} /><button type="button" className="text-slate-400 transition hover:text-forest" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
            </label>

            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

            <button type="submit" disabled={submitting} className="button-primary w-full justify-center !py-3.5 disabled:cursor-not-allowed disabled:opacity-65">
              {submitting ? <><LoaderCircle size={18} className="animate-spin" /> Please wait…</> : <>{isRegister ? 'Create account' : 'Log in'} <ArrowRight size={17} /></>}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            {isRegister ? 'Already have an account?' : 'New to FoodLoop?'}{' '}
            <Link className="font-semibold text-forest hover:text-orange" to={isRegister ? '/login' : '/register'}>
              {isRegister ? 'Log in' : 'Create an account'}
            </Link>
          </p>
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">Admin accounts are created by the platform operator and cannot be registered here.</p>
        </div>
      </section>
    </main>
  )
}
