import { ArrowUpRight, HeartHandshake } from 'lucide-react'

import Brand from './Brand'

export default function SiteFooter() {
  return (
    <footer className="bg-forest text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Brand light />
          <p className="mt-4 max-w-md text-sm leading-6 text-white/65">
            Good food deserves a good next stop. Building a more connected,
            less wasteful food system, one handoff at a time.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm text-white/75 md:items-end">
          <a className="inline-flex items-center gap-2 hover:text-white" href="https://sdgs.un.org/goals/goal2" target="_blank" rel="noreferrer">
            Learn about SDG 2 <ArrowUpRight size={15} />
          </a>
          <a className="inline-flex items-center gap-2 hover:text-white" href="https://sdgs.un.org/goals/goal12" target="_blank" rel="noreferrer">
            Learn about SDG 12 <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-white/50 sm:px-8 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} FoodLoop. Built for a better food future.</span>
          <span className="inline-flex items-center gap-1.5"><HeartHandshake size={14} /> Made for communities, with care.</span>
        </div>
      </div>
    </footer>
  )
}
