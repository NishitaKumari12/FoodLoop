import { Link } from 'react-router-dom'
import { Sprout } from 'lucide-react'

export default function Brand({ light = false }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2.5 font-bold tracking-tight ${light ? 'text-white' : 'text-forest'}`}
      aria-label="FoodLoop home"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${light ? 'bg-white/10' : 'bg-forest text-white'}`}>
        <Sprout size={21} aria-hidden="true" />
      </span>
      <span className="text-xl">foodloop<span className={light ? 'text-orange' : 'text-orange'}>.</span></span>
    </Link>
  )
}
