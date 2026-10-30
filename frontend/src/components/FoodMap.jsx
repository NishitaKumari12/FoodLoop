import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LoaderCircle, MapPin, RefreshCw } from 'lucide-react'

import { getCommunityNeeds, getDonations } from '../api/client'

export default function FoodMap() {
  const mapElement = useRef(null)
  const mapInstance = useRef(null)
  const markers = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return undefined
    const map = L.map(mapElement.current, { scrollWheelZoom: false }).setView([12.9716, 77.5946], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    mapInstance.current = map
    markers.current = L.featureGroup().addTo(map)
    return () => {
      map.remove()
      mapInstance.current = null
      markers.current = null
    }
  }, [])

  async function loadMap() {
    setLoading(true)
    setError('')
    try {
      const [donations, needs] = await Promise.all([getDonations({ status: 'available' }), getCommunityNeeds()])
      if (!markers.current || !mapInstance.current) return
      markers.current.clearLayers()
      const points = []
      for (const donation of donations) {
        if (donation.latitude == null || donation.longitude == null) continue
        const marker = L.circleMarker([donation.latitude, donation.longitude], {
          radius: 9,
          color: '#174c37',
          fillColor: '#e88445',
          fillOpacity: 0.9,
          weight: 2,
        }).bindPopup(`<strong>${escapeHtml(donation.name)}</strong><br>${donation.quantity_meals} meals<br>Pickup by ${new Date(donation.pickup_deadline).toLocaleString()}`)
        markers.current.addLayer(marker)
        points.push([donation.latitude, donation.longitude])
      }
      for (const need of needs) {
        if (!['verified', 'fulfilled'].includes(need.status)) continue
        const marker = L.circleMarker([need.latitude, need.longitude], {
          radius: 9,
          color: '#a94b26',
          fillColor: '#f3a66d',
          fillOpacity: 0.85,
          weight: 2,
        }).bindPopup(`<strong>${escapeHtml(need.title)}</strong><br>${need.requested_meals - need.pledged_meals} meals still needed`)
        markers.current.addLayer(marker)
        points.push([need.latitude, need.longitude])
      }
      if (points.length) mapInstance.current.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 14 })
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Could not load map data. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadMap, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow"><MapPin size={14} /> Local food map</p>
          <h2 className="mt-2 text-xl font-semibold text-forest">Donations and verified needs nearby</h2>
          <p className="mt-1 text-sm text-slate-500">Exact pickup coordinates are only shared with authorized participants.</p>
        </div>
        <button type="button" onClick={loadMap} disabled={loading} className="button-secondary !px-3" aria-label="Refresh map">
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
        <span className="inline-flex items-center gap-2"><i className="map-key map-key-food" /> Available food</span>
        <span className="inline-flex items-center gap-2"><i className="map-key map-key-need" /> Verified community need</span>
        {lastUpdated && <span className="ml-auto text-slate-400">Updated {lastUpdated}</span>}
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="map-container relative mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div ref={mapElement} className="h-[360px] w-full" aria-label="Interactive map of available donations and community needs" />
        {loading && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70"><span className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-forest shadow"><LoaderCircle size={17} className="animate-spin" /> Loading map…</span></div>}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">Map tiles © OpenStreetMap contributors. Map availability depends on an internet connection.</p>
    </section>
  )
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}
