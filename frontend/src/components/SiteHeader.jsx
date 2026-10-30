import { Link, NavLink } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useState } from 'react'

import Brand from './Brand'

export default function SiteHeader({ user }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const links = (
    <>
      <a href="/#how-it-works" onClick={() => setMenuOpen(false)} className="nav-link">How it works</a>
      <a href="/#our-impact" onClick={() => setMenuOpen(false)} className="nav-link">Why FoodLoop</a>
    </>
  )

  return (
    <header className="relative z-20 border-b border-forest/5 bg-white">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Brand />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {links}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Link to="/dashboard" className="button-primary !py-2.5">
              My workspace <ArrowUpRight size={16} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="button-quiet">Log in</Link>
              <Link to="/register" className="button-primary !py-2.5">
                Join FoodLoop <ArrowUpRight size={16} />
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-forest md:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
      {menuOpen && (
        <nav className="absolute left-0 right-0 top-full flex flex-col gap-5 border-t border-forest/5 bg-white px-6 py-6 shadow-lg md:hidden" aria-label="Mobile navigation">
          {links}
          {user ? (
            <Link to="/dashboard" className="button-primary w-full">My workspace</Link>
          ) : (
            <div className="flex flex-col gap-3">
              <Link to="/login" className="button-quiet">Log in</Link>
              <Link to="/register" className="button-primary">Join FoodLoop</Link>
            </div>
          )}
        </nav>
      )}
    </header>
  )
}
