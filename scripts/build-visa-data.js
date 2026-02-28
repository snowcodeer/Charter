#!/usr/bin/env node
/**
 * Build script: converts passport-index CSV + TopoJSON into
 * visa-requirements.json and un-to-iso.json for the globe visualization.
 *
 * Usage: node scripts/build-visa-data.js
 *
 * Expects /tmp/passport-index-tidy.csv to exist (download first).
 */

const fs = require('fs')
const path = require('path')

const CSV_PATH = '/tmp/passport-index-tidy.csv'
const TOPO_PATH = path.join(__dirname, '..', 'public', 'data', 'countries-110m.json')
const OUT_DIR = path.join(__dirname, '..', 'public', 'data')

// ── Standard UN M49 numeric → ISO 3166-1 alpha-3 mapping ──
const UN_TO_ISO = {
  '004': 'AFG', '008': 'ALB', '010': 'ATA', '012': 'DZA', '024': 'AGO',
  '031': 'AZE', '032': 'ARG', '036': 'AUS', '040': 'AUT', '044': 'BHS',
  '050': 'BGD', '051': 'ARM', '056': 'BEL', '064': 'BTN', '068': 'BOL',
  '070': 'BIH', '072': 'BWA', '076': 'BRA', '084': 'BLZ', '090': 'SLB',
  '096': 'BRN', '100': 'BGR', '104': 'MMR', '108': 'BDI', '112': 'BLR',
  '116': 'KHM', '120': 'CMR', '124': 'CAN', '140': 'CAF', '144': 'LKA',
  '148': 'TCD', '152': 'CHL', '156': 'CHN', '158': 'TWN', '170': 'COL',
  '178': 'COG', '180': 'COD', '188': 'CRI', '191': 'HRV', '192': 'CUB',
  '196': 'CYP', '203': 'CZE', '204': 'BEN', '208': 'DNK', '214': 'DOM',
  '218': 'ECU', '222': 'SLV', '226': 'GNQ', '231': 'ETH', '232': 'ERI',
  '233': 'EST', '238': 'FLK', '242': 'FJI', '246': 'FIN', '250': 'FRA',
  '260': 'ATF', '262': 'DJI', '266': 'GAB', '268': 'GEO', '270': 'GMB',
  '275': 'PSE', '276': 'DEU', '288': 'GHA', '300': 'GRC', '304': 'GRL',
  '320': 'GTM', '324': 'GIN', '328': 'GUY', '332': 'HTI', '340': 'HND',
  '348': 'HUN', '352': 'ISL', '356': 'IND', '360': 'IDN', '364': 'IRN',
  '368': 'IRQ', '372': 'IRL', '376': 'ISR', '380': 'ITA', '384': 'CIV',
  '388': 'JAM', '392': 'JPN', '398': 'KAZ', '400': 'JOR', '404': 'KEN',
  '408': 'PRK', '410': 'KOR', '414': 'KWT', '417': 'KGZ', '418': 'LAO',
  '422': 'LBN', '426': 'LSO', '428': 'LVA', '430': 'LBR', '434': 'LBY',
  '440': 'LTU', '442': 'LUX', '450': 'MDG', '454': 'MWI', '458': 'MYS',
  '466': 'MLI', '478': 'MRT', '484': 'MEX', '496': 'MNG', '498': 'MDA',
  '499': 'MNE', '504': 'MAR', '508': 'MOZ', '512': 'OMN', '516': 'NAM',
  '524': 'NPL', '528': 'NLD', '540': 'NCL', '548': 'VUT', '554': 'NZL',
  '558': 'NIC', '562': 'NER', '566': 'NGA', '578': 'NOR', '586': 'PAK',
  '591': 'PAN', '598': 'PNG', '600': 'PRY', '604': 'PER', '608': 'PHL',
  '616': 'POL', '620': 'PRT', '624': 'GNB', '626': 'TLS', '630': 'PRI',
  '634': 'QAT', '642': 'ROU', '643': 'RUS', '646': 'RWA', '682': 'SAU',
  '686': 'SEN', '688': 'SRB', '694': 'SLE', '703': 'SVK', '704': 'VNM',
  '705': 'SVN', '706': 'SOM', '710': 'ZAF', '716': 'ZWE', '724': 'ESP',
  '728': 'SSD', '729': 'SDN', '732': 'ESH', '740': 'SUR', '748': 'SWZ',
  '752': 'SWE', '756': 'CHE', '760': 'SYR', '762': 'TJK', '764': 'THA',
  '768': 'TGO', '780': 'TTO', '784': 'ARE', '788': 'TUN', '792': 'TUR',
  '795': 'TKM', '800': 'UGA', '804': 'UKR', '807': 'MKD', '818': 'EGY',
  '826': 'GBR', '834': 'TZA', '840': 'USA', '854': 'BFA', '858': 'URY',
  '860': 'UZB', '862': 'VEN', '887': 'YEM', '894': 'ZMB',
}

// ── ISO alpha-3 → common name used in passport-index CSV ──
const ISO_TO_NAME = {
  AFG: 'Afghanistan', ALB: 'Albania', DZA: 'Algeria', AGO: 'Angola',
  ARG: 'Argentina', ARM: 'Armenia', AUS: 'Australia', AUT: 'Austria',
  AZE: 'Azerbaijan', BHS: 'Bahamas', BGD: 'Bangladesh', BLR: 'Belarus',
  BEL: 'Belgium', BLZ: 'Belize', BEN: 'Benin', BTN: 'Bhutan',
  BOL: 'Bolivia', BIH: 'Bosnia and Herzegovina', BWA: 'Botswana',
  BRA: 'Brazil', BRN: 'Brunei', BGR: 'Bulgaria', BFA: 'Burkina Faso',
  BDI: 'Burundi', KHM: 'Cambodia', CMR: 'Cameroon', CAN: 'Canada',
  CAF: 'Central African Republic', TCD: 'Chad', CHL: 'Chile', CHN: 'China',
  COL: 'Colombia', COG: 'Congo', COD: 'Congo (Dem. Rep.)', CRI: 'Costa Rica',
  CIV: "Cote d'Ivoire (Ivory Coast)", HRV: 'Croatia', CUB: 'Cuba',
  CYP: 'Cyprus', CZE: 'Czech Republic', DNK: 'Denmark', DJI: 'Djibouti',
  DOM: 'Dominican Republic', ECU: 'Ecuador', EGY: 'Egypt',
  SLV: 'El Salvador', GNQ: 'Equatorial Guinea', ERI: 'Eritrea',
  EST: 'Estonia', ETH: 'Ethiopia', FJI: 'Fiji', FIN: 'Finland',
  FRA: 'France', GAB: 'Gabon', GMB: 'Gambia', GEO: 'Georgia',
  DEU: 'Germany', GHA: 'Ghana', GRC: 'Greece', GTM: 'Guatemala',
  GIN: 'Guinea', GNB: 'Guinea-Bissau', GUY: 'Guyana', HTI: 'Haiti',
  HND: 'Honduras', HUN: 'Hungary', ISL: 'Iceland', IND: 'India',
  IDN: 'Indonesia', IRN: 'Iran', IRQ: 'Iraq', IRL: 'Ireland',
  ISR: 'Israel', ITA: 'Italy', JAM: 'Jamaica', JPN: 'Japan',
  JOR: 'Jordan', KAZ: 'Kazakhstan', KEN: 'Kenya', KOR: 'South Korea',
  KWT: 'Kuwait', KGZ: 'Kyrgyzstan', LAO: 'Laos', LVA: 'Latvia',
  LBN: 'Lebanon', LSO: 'Lesotho', LBR: 'Liberia', LBY: 'Libya',
  LTU: 'Lithuania', LUX: 'Luxembourg', MDG: 'Madagascar', MWI: 'Malawi',
  MYS: 'Malaysia', MLI: 'Mali', MRT: 'Mauritania', MEX: 'Mexico',
  MDA: 'Moldova', MNG: 'Mongolia', MNE: 'Montenegro', MAR: 'Morocco',
  MOZ: 'Mozambique', MMR: 'Myanmar', NAM: 'Namibia', NPL: 'Nepal',
  NLD: 'Netherlands', NZL: 'New Zealand', NIC: 'Nicaragua', NER: 'Niger',
  NGA: 'Nigeria', PRK: 'North Korea', MKD: 'North Macedonia', NOR: 'Norway',
  OMN: 'Oman', PAK: 'Pakistan', PAN: 'Panama', PNG: 'Papua New Guinea',
  PRY: 'Paraguay', PER: 'Peru', PHL: 'Philippines', POL: 'Poland',
  PRT: 'Portugal', QAT: 'Qatar', ROU: 'Romania', RUS: 'Russia',
  RWA: 'Rwanda', SAU: 'Saudi Arabia', SEN: 'Senegal', SRB: 'Serbia',
  SLE: 'Sierra Leone', SVK: 'Slovakia', SVN: 'Slovenia', SLB: 'Solomon Islands',
  SOM: 'Somalia', ZAF: 'South Africa', SSD: 'South Sudan', ESP: 'Spain',
  LKA: 'Sri Lanka', SDN: 'Sudan', SUR: 'Suriname', SWZ: 'Eswatini',
  SWE: 'Sweden', CHE: 'Switzerland', SYR: 'Syria', TWN: 'Taiwan',
  TJK: 'Tajikistan', TZA: 'Tanzania', THA: 'Thailand', TLS: 'Timor-Leste',
  TGO: 'Togo', TTO: 'Trinidad and Tobago', TUN: 'Tunisia', TUR: 'Turkey',
  TKM: 'Turkmenistan', UGA: 'Uganda', UKR: 'Ukraine', ARE: 'United Arab Emirates',
  GBR: 'United Kingdom', USA: 'United States', URY: 'Uruguay',
  UZB: 'Uzbekistan', VUT: 'Vanuatu', VEN: 'Venezuela', VNM: 'Vietnam',
  YEM: 'Yemen', ZMB: 'Zambia', ZWE: 'Zimbabwe', BFA: 'Burkina Faso',
}

// Build reverse: name → ISO (lowercase for fuzzy match)
const nameToIso = {}
for (const [iso, name] of Object.entries(ISO_TO_NAME)) {
  nameToIso[name.toLowerCase()] = iso
}
// Add common CSV name variants
const ALIASES = {
  'united states': 'USA',
  'united states of america': 'USA',
  'united kingdom': 'GBR',
  'south korea': 'KOR',
  'north korea': 'PRK',
  'czech republic': 'CZE',
  'czechia': 'CZE',
  'ivory coast': 'CIV',
  "cote d'ivoire": 'CIV',
  "cote d'ivoire (ivory coast)": 'CIV',
  'congo (dem. rep.)': 'COD',
  'democratic republic of the congo': 'COD',
  'dr congo': 'COD',
  'congo (rep.)': 'COG',
  'republic of the congo': 'COG',
  'congo': 'COG',
  'east timor': 'TLS',
  'timor-leste': 'TLS',
  'myanmar': 'MMR',
  'burma': 'MMR',
  'eswatini': 'SWZ',
  'swaziland': 'SWZ',
  'north macedonia': 'MKD',
  'macedonia': 'MKD',
  'bosnia and herzegovina': 'BIH',
  'trinidad and tobago': 'TTO',
  'papua new guinea': 'PNG',
  'solomon islands': 'SLB',
  'guinea-bissau': 'GNB',
  // Small countries not in TopoJSON but important as passport holders
  'andorra': 'AND', 'antigua and barbuda': 'ATG', 'bahrain': 'BHR',
  'barbados': 'BRB', 'cape verde': 'CPV', 'comoros': 'COM',
  'dominica': 'DMA', 'grenada': 'GRD', 'hong kong': 'HKG',
  'kiribati': 'KIR', 'kosovo': 'XKX', 'liechtenstein': 'LIE',
  'macao': 'MAC', 'maldives': 'MDV', 'malta': 'MLT',
  'marshall islands': 'MHL', 'mauritius': 'MUS', 'micronesia': 'FSM',
  'monaco': 'MCO', 'nauru': 'NRU', 'palau': 'PLW',
  'palestine': 'PSE', 'saint kitts and nevis': 'KNA',
  'saint lucia': 'LCA', 'saint vincent and the grenadines': 'VCT',
  'samoa': 'WSM', 'san marino': 'SMR', 'sao tome and principe': 'STP',
  'seychelles': 'SYC', 'singapore': 'SGP', 'tonga': 'TON',
  'tuvalu': 'TUV', 'vatican': 'VAT',
  'equatorial guinea': 'GNQ',
  'central african republic': 'CAF',
  'sierra leone': 'SLE',
  'south africa': 'ZAF',
  'south sudan': 'SSD',
  'sri lanka': 'LKA',
  'saudi arabia': 'SAU',
  'new zealand': 'NZL',
  'el salvador': 'SLV',
  'costa rica': 'CRI',
  'dominican republic': 'DOM',
  'burkina faso': 'BFA',
  'united arab emirates': 'ARE',
}
for (const [alias, iso] of Object.entries(ALIASES)) {
  nameToIso[alias.toLowerCase()] = iso
}

function csvNameToIso(name) {
  const lower = name.toLowerCase().trim()
  return nameToIso[lower] || null
}

// Classify requirement string into a category
function classifyRequirement(req) {
  const r = req.trim().toLowerCase()
  if (r === 'visa free' || r === 'visa-free') return 'vf'
  if (r === 'visa on arrival') return 'voa'
  if (r === 'eta' || r === 'e-visa') return 'eta'
  if (r === 'visa required') return 'vr'
  if (r === 'no admission' || r === '-1') return 'na'
  // Numeric values = visa-free days
  if (/^\d+$/.test(r)) return 'vf'
  return 'vr' // default to visa required
}

// ── Main ──
function main() {
  // 1. Write un-to-iso.json
  fs.writeFileSync(
    path.join(OUT_DIR, 'un-to-iso.json'),
    JSON.stringify(UN_TO_ISO, null, 2)
  )
  console.log('Wrote un-to-iso.json')

  // 2. Parse CSV
  const csv = fs.readFileSync(CSV_PATH, 'utf8')
  const lines = csv.trim().split('\n').slice(1) // skip header

  // Build: { passportISO: { destISO: category } }
  const visaData = {}
  let matched = 0, unmatched = 0

  for (const line of lines) {
    // Handle CSV with possible commas in fields
    const parts = line.split(',')
    if (parts.length < 3) continue
    const passportName = parts[0]
    const destName = parts[1]
    const requirement = parts.slice(2).join(',') // in case requirement has commas

    const passportIso = csvNameToIso(passportName)
    const destIso = csvNameToIso(destName)

    if (!passportIso || !destIso) {
      unmatched++
      continue
    }

    matched++
    if (!visaData[passportIso]) visaData[passportIso] = {}
    visaData[passportIso][destIso] = classifyRequirement(requirement)
  }

  console.log(`Parsed ${matched} entries, ${unmatched} unmatched`)
  console.log(`Passports: ${Object.keys(visaData).length}`)

  // 3. Write visa-requirements.json
  // Compact format: categories are short strings (vf, voa, eta, vr, na)
  fs.writeFileSync(
    path.join(OUT_DIR, 'visa-requirements.json'),
    JSON.stringify(visaData)
  )
  console.log('Wrote visa-requirements.json')

  // Verify a sample
  if (visaData['GBR']) {
    const gbr = visaData['GBR']
    console.log(`Sample GBR→USA: ${gbr['USA']}, GBR→FRA: ${gbr['FRA']}, GBR→CHN: ${gbr['CHN']}`)
  }
  if (visaData['USA']) {
    const usa = visaData['USA']
    console.log(`Sample USA→GBR: ${usa['GBR']}, USA→JPN: ${usa['JPN']}, USA→CHN: ${usa['CHN']}`)
  }
}

main()
