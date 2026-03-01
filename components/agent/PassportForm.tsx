'use client'

import { useState, useMemo, useEffect } from 'react'
import { useGlobeStore } from '@/components/scene/globe/useGlobeStore'

interface PassportFormProps {
  onClose: () => void
  onSaved?: (nationality: string) => void
}

// Common countries first, then alphabetical
const COUNTRIES: { name: string; iso3: string }[] = [
  { name: 'United States', iso3: 'USA' },
  { name: 'United Kingdom', iso3: 'GBR' },
  { name: 'Canada', iso3: 'CAN' },
  { name: 'Australia', iso3: 'AUS' },
  { name: 'Germany', iso3: 'DEU' },
  { name: 'France', iso3: 'FRA' },
  { name: 'Japan', iso3: 'JPN' },
  { name: 'South Korea', iso3: 'KOR' },
  { name: 'Singapore', iso3: 'SGP' },
  { name: 'India', iso3: 'IND' },
  { name: 'China', iso3: 'CHN' },
  { name: 'Brazil', iso3: 'BRA' },
  { name: 'Mexico', iso3: 'MEX' },
  { name: '---', iso3: '' },
  { name: 'Afghanistan', iso3: 'AFG' },
  { name: 'Albania', iso3: 'ALB' },
  { name: 'Algeria', iso3: 'DZA' },
  { name: 'Andorra', iso3: 'AND' },
  { name: 'Angola', iso3: 'AGO' },
  { name: 'Argentina', iso3: 'ARG' },
  { name: 'Armenia', iso3: 'ARM' },
  { name: 'Austria', iso3: 'AUT' },
  { name: 'Azerbaijan', iso3: 'AZE' },
  { name: 'Bahamas', iso3: 'BHS' },
  { name: 'Bahrain', iso3: 'BHR' },
  { name: 'Bangladesh', iso3: 'BGD' },
  { name: 'Barbados', iso3: 'BRB' },
  { name: 'Belarus', iso3: 'BLR' },
  { name: 'Belgium', iso3: 'BEL' },
  { name: 'Belize', iso3: 'BLZ' },
  { name: 'Benin', iso3: 'BEN' },
  { name: 'Bhutan', iso3: 'BTN' },
  { name: 'Bolivia', iso3: 'BOL' },
  { name: 'Bosnia and Herzegovina', iso3: 'BIH' },
  { name: 'Botswana', iso3: 'BWA' },
  { name: 'Brunei', iso3: 'BRN' },
  { name: 'Bulgaria', iso3: 'BGR' },
  { name: 'Burkina Faso', iso3: 'BFA' },
  { name: 'Burundi', iso3: 'BDI' },
  { name: 'Cambodia', iso3: 'KHM' },
  { name: 'Cameroon', iso3: 'CMR' },
  { name: 'Cape Verde', iso3: 'CPV' },
  { name: 'Central African Republic', iso3: 'CAF' },
  { name: 'Chad', iso3: 'TCD' },
  { name: 'Chile', iso3: 'CHL' },
  { name: 'Colombia', iso3: 'COL' },
  { name: 'Comoros', iso3: 'COM' },
  { name: 'Congo', iso3: 'COG' },
  { name: 'Costa Rica', iso3: 'CRI' },
  { name: 'Croatia', iso3: 'HRV' },
  { name: 'Cuba', iso3: 'CUB' },
  { name: 'Cyprus', iso3: 'CYP' },
  { name: 'Czech Republic', iso3: 'CZE' },
  { name: 'DR Congo', iso3: 'COD' },
  { name: 'Denmark', iso3: 'DNK' },
  { name: 'Djibouti', iso3: 'DJI' },
  { name: 'Dominica', iso3: 'DMA' },
  { name: 'Dominican Republic', iso3: 'DOM' },
  { name: 'Ecuador', iso3: 'ECU' },
  { name: 'Egypt', iso3: 'EGY' },
  { name: 'El Salvador', iso3: 'SLV' },
  { name: 'Equatorial Guinea', iso3: 'GNQ' },
  { name: 'Eritrea', iso3: 'ERI' },
  { name: 'Estonia', iso3: 'EST' },
  { name: 'Eswatini', iso3: 'SWZ' },
  { name: 'Ethiopia', iso3: 'ETH' },
  { name: 'Fiji', iso3: 'FJI' },
  { name: 'Finland', iso3: 'FIN' },
  { name: 'Gabon', iso3: 'GAB' },
  { name: 'Gambia', iso3: 'GMB' },
  { name: 'Georgia', iso3: 'GEO' },
  { name: 'Ghana', iso3: 'GHA' },
  { name: 'Greece', iso3: 'GRC' },
  { name: 'Grenada', iso3: 'GRD' },
  { name: 'Guatemala', iso3: 'GTM' },
  { name: 'Guinea', iso3: 'GIN' },
  { name: 'Guinea-Bissau', iso3: 'GNB' },
  { name: 'Guyana', iso3: 'GUY' },
  { name: 'Haiti', iso3: 'HTI' },
  { name: 'Honduras', iso3: 'HND' },
  { name: 'Hong Kong', iso3: 'HKG' },
  { name: 'Hungary', iso3: 'HUN' },
  { name: 'Iceland', iso3: 'ISL' },
  { name: 'Indonesia', iso3: 'IDN' },
  { name: 'Iran', iso3: 'IRN' },
  { name: 'Iraq', iso3: 'IRQ' },
  { name: 'Ireland', iso3: 'IRL' },
  { name: 'Israel', iso3: 'ISR' },
  { name: 'Italy', iso3: 'ITA' },
  { name: 'Jamaica', iso3: 'JAM' },
  { name: 'Jordan', iso3: 'JOR' },
  { name: 'Kazakhstan', iso3: 'KAZ' },
  { name: 'Kenya', iso3: 'KEN' },
  { name: 'Kuwait', iso3: 'KWT' },
  { name: 'Kyrgyzstan', iso3: 'KGZ' },
  { name: 'Laos', iso3: 'LAO' },
  { name: 'Latvia', iso3: 'LVA' },
  { name: 'Lebanon', iso3: 'LBN' },
  { name: 'Lesotho', iso3: 'LSO' },
  { name: 'Liberia', iso3: 'LBR' },
  { name: 'Libya', iso3: 'LBY' },
  { name: 'Liechtenstein', iso3: 'LIE' },
  { name: 'Lithuania', iso3: 'LTU' },
  { name: 'Luxembourg', iso3: 'LUX' },
  { name: 'Macao', iso3: 'MAC' },
  { name: 'Madagascar', iso3: 'MDG' },
  { name: 'Malawi', iso3: 'MWI' },
  { name: 'Malaysia', iso3: 'MYS' },
  { name: 'Maldives', iso3: 'MDV' },
  { name: 'Mali', iso3: 'MLI' },
  { name: 'Malta', iso3: 'MLT' },
  { name: 'Mauritania', iso3: 'MRT' },
  { name: 'Mauritius', iso3: 'MUS' },
  { name: 'Moldova', iso3: 'MDA' },
  { name: 'Monaco', iso3: 'MCO' },
  { name: 'Mongolia', iso3: 'MNG' },
  { name: 'Montenegro', iso3: 'MNE' },
  { name: 'Morocco', iso3: 'MAR' },
  { name: 'Mozambique', iso3: 'MOZ' },
  { name: 'Myanmar', iso3: 'MMR' },
  { name: 'Namibia', iso3: 'NAM' },
  { name: 'Nepal', iso3: 'NPL' },
  { name: 'Netherlands', iso3: 'NLD' },
  { name: 'New Zealand', iso3: 'NZL' },
  { name: 'Nicaragua', iso3: 'NIC' },
  { name: 'Niger', iso3: 'NER' },
  { name: 'Nigeria', iso3: 'NGA' },
  { name: 'North Korea', iso3: 'PRK' },
  { name: 'North Macedonia', iso3: 'MKD' },
  { name: 'Norway', iso3: 'NOR' },
  { name: 'Oman', iso3: 'OMN' },
  { name: 'Pakistan', iso3: 'PAK' },
  { name: 'Palestine', iso3: 'PSE' },
  { name: 'Panama', iso3: 'PAN' },
  { name: 'Papua New Guinea', iso3: 'PNG' },
  { name: 'Paraguay', iso3: 'PRY' },
  { name: 'Peru', iso3: 'PER' },
  { name: 'Philippines', iso3: 'PHL' },
  { name: 'Poland', iso3: 'POL' },
  { name: 'Portugal', iso3: 'PRT' },
  { name: 'Qatar', iso3: 'QAT' },
  { name: 'Romania', iso3: 'ROU' },
  { name: 'Russia', iso3: 'RUS' },
  { name: 'Rwanda', iso3: 'RWA' },
  { name: 'Saudi Arabia', iso3: 'SAU' },
  { name: 'Senegal', iso3: 'SEN' },
  { name: 'Serbia', iso3: 'SRB' },
  { name: 'Sierra Leone', iso3: 'SLE' },
  { name: 'Slovakia', iso3: 'SVK' },
  { name: 'Slovenia', iso3: 'SVN' },
  { name: 'Solomon Islands', iso3: 'SLB' },
  { name: 'Somalia', iso3: 'SOM' },
  { name: 'South Africa', iso3: 'ZAF' },
  { name: 'South Sudan', iso3: 'SSD' },
  { name: 'Spain', iso3: 'ESP' },
  { name: 'Sri Lanka', iso3: 'LKA' },
  { name: 'Sudan', iso3: 'SDN' },
  { name: 'Suriname', iso3: 'SUR' },
  { name: 'Sweden', iso3: 'SWE' },
  { name: 'Switzerland', iso3: 'CHE' },
  { name: 'Syria', iso3: 'SYR' },
  { name: 'Taiwan', iso3: 'TWN' },
  { name: 'Tajikistan', iso3: 'TJK' },
  { name: 'Tanzania', iso3: 'TZA' },
  { name: 'Thailand', iso3: 'THA' },
  { name: 'Timor-Leste', iso3: 'TLS' },
  { name: 'Togo', iso3: 'TGO' },
  { name: 'Trinidad and Tobago', iso3: 'TTO' },
  { name: 'Tunisia', iso3: 'TUN' },
  { name: 'Turkey', iso3: 'TUR' },
  { name: 'Turkmenistan', iso3: 'TKM' },
  { name: 'Uganda', iso3: 'UGA' },
  { name: 'Ukraine', iso3: 'UKR' },
  { name: 'United Arab Emirates', iso3: 'ARE' },
  { name: 'Uruguay', iso3: 'URY' },
  { name: 'Uzbekistan', iso3: 'UZB' },
  { name: 'Vanuatu', iso3: 'VUT' },
  { name: 'Venezuela', iso3: 'VEN' },
  { name: 'Vietnam', iso3: 'VNM' },
  { name: 'Yemen', iso3: 'YEM' },
  { name: 'Zambia', iso3: 'ZMB' },
  { name: 'Zimbabwe', iso3: 'ZWE' },
]

export function PassportForm({ onClose, onSaved }: PassportFormProps) {
  const [search, setSearch] = useState('')
  const [selectedIso, setSelectedIso] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const setSelectedNationality = useGlobeStore((s) => s.setSelectedNationality)
  const currentNationality = useGlobeStore((s) => s.selectedNationality)

  // Load existing profile on mount
  useEffect(() => {
    fetch('/api/passport')
      .then(r => r.json())
      .then(data => {
        if (data?.passports?.length > 0) {
          const nat = data.passports[0].nationality
          // Try to find matching ISO code
          const match = COUNTRIES.find(c =>
            c.name.toLowerCase() === nat.toLowerCase() || c.iso3 === nat
          )
          if (match) {
            setSelectedIso(match.iso3)
            setSearch(match.name)
          }
        }
      })
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    if (!search) return COUNTRIES.filter(c => c.iso3)
    const q = search.toLowerCase()
    return COUNTRIES.filter(c => c.iso3 && c.name.toLowerCase().includes(q))
  }, [search])

  const selectedCountry = COUNTRIES.find(c => c.iso3 === selectedIso)

  async function handleSave() {
    if (!selectedIso || !selectedCountry) return
    setSaving(true)
    try {
      await fetch('/api/passport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User',
          passports: [{
            nationality: selectedCountry.name,
            issuingCountry: selectedCountry.name,
            passportNumber: passportNumber || undefined,
            expiryDate: expiryDate || undefined,
          }],
        }),
      })
      setSelectedNationality(selectedIso)
      onSaved?.(selectedIso)
      onClose()
    } catch (err) {
      console.error('Failed to save passport:', err)
    } finally {
      setSaving(false)
    }
  }

  // Quick-set: just update the globe without saving to DB
  function handlePreview() {
    if (selectedIso) {
      setSelectedNationality(selectedIso)
    }
  }

  return (
    <div className="fixed bottom-28 right-4 z-20 w-80 bg-[#1a1410]/95 border border-[#3d2e22] rounded shadow-2xl overflow-hidden pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3d2e22]">
        <h3 className="text-sm font-medium text-[#e8dcc4]">Passport Details</h3>
        <button
          onClick={onClose}
          className="text-[#9a8a6e] hover:text-[#e8dcc4] text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-3">
        {/* Nationality search */}
        <div className="relative">
          <label className="block text-xs text-[#9a8a6e] mb-1">Nationality</label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowDropdown(true)
              setSelectedIso('')
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search country..."
            className="w-full bg-[#1e1612] border border-[#4a382a] rounded px-3 py-2 text-sm text-[#e8dcc4] placeholder-[#6b5a46] focus:outline-none focus:border-[#c4a455]"
          />
          {showDropdown && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#1e1612] border border-[#4a382a] rounded z-30">
              {filtered.slice(0, 30).map((c) => (
                <button
                  key={c.iso3}
                  onClick={() => {
                    setSelectedIso(c.iso3)
                    setSearch(c.name)
                    setShowDropdown(false)
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-[#e8dcc4] hover:bg-[#2a1f18]"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Optional fields */}
        <div>
          <label className="block text-xs text-[#9a8a6e] mb-1">Passport Number (optional)</label>
          <input
            type="text"
            value={passportNumber}
            onChange={(e) => setPassportNumber(e.target.value)}
            placeholder="AB1234567"
            className="w-full bg-[#1e1612] border border-[#4a382a] rounded px-3 py-2 text-sm text-[#e8dcc4] placeholder-[#6b5a46] focus:outline-none focus:border-[#c4a455]"
          />
        </div>

        <div>
          <label className="block text-xs text-[#9a8a6e] mb-1">Expiry Date (optional)</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full bg-[#1e1612] border border-[#4a382a] rounded px-3 py-2 text-sm text-[#e8dcc4] placeholder-[#6b5a46] focus:outline-none focus:border-[#c4a455]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handlePreview}
            disabled={!selectedIso}
            className="flex-1 bg-[#2a1f18] text-[#e8dcc4] border border-[#3d2e22] px-3 py-2 rounded text-sm disabled:opacity-30 hover:bg-[#3d2e22]"
          >
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedIso || saving}
            className="flex-1 bg-[#c4a455] text-[#1a1410] px-3 py-2 rounded text-sm font-medium disabled:opacity-30 hover:bg-[#d4b465]"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Legend */}
        {(currentNationality || selectedIso) && (
          <div className="pt-2 border-t border-[#3d2e22]">
            <p className="text-xs text-[#9a8a6e] mb-2">Visa Requirements</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c4a455]" />
                <span className="text-[#e8dcc4]">Visa-free</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#b08040]" />
                <span className="text-[#e8dcc4]">VOA / eTA</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8b4040]" />
                <span className="text-[#e8dcc4]">Visa required</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4a6a8a]" />
                <span className="text-[#e8dcc4]">Home</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
