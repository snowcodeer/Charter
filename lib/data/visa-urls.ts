/**
 * Hardcoded direct visa application/registration URLs.
 * The agent references this lookup instead of searching for URLs.
 *
 * status:
 *   'confirmed' — verified direct form URL
 *   'button-nav' — correct starting URL but requires clicking through buttons/disclaimers to reach form
 *   'needs-verification' — best guess, agent should verify and adapt
 *   'app-only' — no web form, mobile app required
 *   'no-evisa' — no online visa system exists
 */

export interface VisaPortal {
  country: string
  iso3: string
  url: string
  status: 'confirmed' | 'button-nav' | 'needs-verification' | 'app-only' | 'no-evisa'
  notes?: string
}

export const VISA_PORTALS: VisaPortal[] = [
  // === TOP 20 — VERIFIED ===
  { country: 'India', iso3: 'IND', url: 'https://indianvisaonline.gov.in/evisa/Registration', status: 'confirmed' },
  { country: 'Turkey', iso3: 'TUR', url: 'https://evisa.gov.tr/en/apply/', status: 'confirmed' },
  { country: 'Sri Lanka', iso3: 'LKA', url: 'https://eta.gov.lk/etaslvisa/etaNavServ', status: 'confirmed' },
  { country: 'Kenya', iso3: 'KEN', url: 'https://etakenya.go.ke/form/apply/start', status: 'confirmed' },
  { country: 'Vietnam', iso3: 'VNM', url: 'https://evisa.gov.vn/', status: 'button-nav', notes: 'Click through to application form' },
  { country: 'Cambodia', iso3: 'KHM', url: 'https://www.evisa.gov.kh/application_new', status: 'confirmed' },
  { country: 'Egypt', iso3: 'EGY', url: 'https://visa2egypt.gov.eg/', status: 'button-nav', notes: 'Register/login then apply' },
  { country: 'Indonesia', iso3: 'IDN', url: 'https://evisa.imigrasi.go.id/front/register/wna', status: 'confirmed' },
  { country: 'Ethiopia', iso3: 'ETH', url: 'https://www.evisa.gov.et/visa/apply', status: 'confirmed' },
  { country: 'Tanzania', iso3: 'TZA', url: 'https://visa.immigration.go.tz/start', status: 'confirmed' },
  { country: 'United Kingdom', iso3: 'GBR', url: 'https://www.gov.uk/standard-visitor/apply-standard-visitor-visa', status: 'button-nav', notes: 'GOV.UK flow — click through eligibility questions to reach form' },
  { country: 'Japan', iso3: 'JPN', url: 'https://www.vjw.digital.go.jp/main/#/vjwplo001', status: 'button-nav', notes: 'Visit Japan Web — register then fill arrival info' },
  { country: 'Australia', iso3: 'AUS', url: 'https://auvisa.australialegal.it/uk/visa/', status: 'button-nav', notes: 'ETA application — click through to form' },
  { country: 'Thailand', iso3: 'THA', url: 'https://thaievisa.go.th/signin', status: 'button-nav', notes: 'Sign in / register then apply for eVOA' },
  { country: 'United Arab Emirates', iso3: 'ARE', url: 'https://smart.gdrfad.gov.ae/', status: 'button-nav', notes: 'GDRFA smart services — login/register flow' },
  { country: 'USA', iso3: 'USA', url: 'https://esta.cbp.dhs.gov/esta', status: 'button-nav', notes: 'ESTA — click through disclaimers to reach application' },
  { country: 'Canada', iso3: 'CAN', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html', status: 'button-nav', notes: 'eTA — click through to application form' },
  { country: 'South Korea', iso3: 'KOR', url: 'https://www.k-eta.go.kr/', status: 'button-nav', notes: 'K-ETA — navigate to application. Note: K-ETA exemption may apply for some nationalities through 2026' },
  { country: 'New Zealand', iso3: 'NZL', url: 'https://nzeta.immigration.govt.nz/', status: 'button-nav', notes: 'NZeTA — JS app, click through to apply' },
  { country: 'Saudi Arabia', iso3: 'SAU', url: 'https://visa.visitsaudi.com/', status: 'needs-verification', notes: 'May require clicking through to application' },

  // === ASIA & CENTRAL ASIA ===
  { country: 'Myanmar', iso3: 'MMR', url: 'https://evisa.moip.gov.mm/', status: 'confirmed' },
  { country: 'Oman', iso3: 'OMN', url: 'https://evisa.rop.gov.om/apply-for-a-visa', status: 'confirmed' },
  { country: 'Russia', iso3: 'RUS', url: 'https://evisa.kdmid.ru/', status: 'confirmed' },
  { country: 'Azerbaijan', iso3: 'AZE', url: 'https://evisa.gov.az/en/apply-step1', status: 'needs-verification' },
  { country: 'Georgia', iso3: 'GEO', url: 'https://www.evisa.gov.ge/GeoVisa/en/VisaApp', status: 'needs-verification' },
  { country: 'Armenia', iso3: 'ARM', url: 'https://evisa.mfa.am/', status: 'needs-verification' },
  { country: 'Uzbekistan', iso3: 'UZB', url: 'https://e-visa.gov.uz/', status: 'needs-verification' },
  { country: 'Tajikistan', iso3: 'TJK', url: 'https://www.evisa.tj/', status: 'needs-verification' },
  { country: 'Kyrgyzstan', iso3: 'KGZ', url: 'https://www.evisa.e-gov.kg/', status: 'needs-verification' },
  { country: 'Kazakhstan', iso3: 'KAZ', url: 'https://www.vmp.gov.kz/', status: 'needs-verification' },
  { country: 'Mongolia', iso3: 'MNG', url: 'https://evisa.mn/en/apply', status: 'needs-verification' },
  { country: 'Laos', iso3: 'LAO', url: 'https://laoevisa.gov.la/', status: 'needs-verification' },
  { country: 'Nepal', iso3: 'NPL', url: 'https://nepaliport.immigration.gov.np/', status: 'button-nav', notes: 'Select ETA option from portal' },
  { country: 'Bhutan', iso3: 'BTN', url: 'https://visit.doi.gov.bt/', status: 'needs-verification' },
  { country: 'Bangladesh', iso3: 'BGD', url: 'https://visa.gov.bd/', status: 'button-nav', notes: 'Navigate to application from portal' },
  { country: 'China', iso3: 'CHN', url: 'https://consular.mfa.gov.cn/VISA/', status: 'button-nav', notes: 'COVA portal — select embassy then fill form' },
  { country: 'Taiwan', iso3: 'TWN', url: 'https://visawebapp.boca.gov.tw/BOCA_EVISA/MRV04FORM.do', status: 'button-nav', notes: 'Click through to gVisa form' },
  { country: 'Hong Kong', iso3: 'HKG', url: 'https://www.immd.gov.hk/eng/evisaonline.html', status: 'button-nav', notes: 'Navigate to e-visa application' },
  { country: 'Malaysia', iso3: 'MYS', url: 'https://malaysiavisa.imi.gov.my/', status: 'needs-verification' },
  { country: 'Singapore', iso3: 'SGP', url: 'https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card', status: 'button-nav', notes: 'SG Arrival Card — not a visa, free entry form' },

  // === MIDDLE EAST ===
  { country: 'Bahrain', iso3: 'BHR', url: 'https://www.evisa.gov.bh/', status: 'button-nav', notes: 'Click Apply to reach form' },
  { country: 'Qatar', iso3: 'QAT', url: 'https://hayya.qa/en', status: 'button-nav', notes: 'Hayya platform — select nationality then apply' },
  { country: 'Iran', iso3: 'IRN', url: 'https://evisa.mfa.ir/en/', status: 'needs-verification' },
  { country: 'Iraq', iso3: 'IRQ', url: 'https://evisa.iq/en', status: 'button-nav', notes: 'Click Apply Now to reach form' },
  { country: 'Jordan', iso3: 'JOR', url: 'https://eservices.moi.gov.jo', status: 'needs-verification' },
  { country: 'Kuwait', iso3: 'KWT', url: 'https://kuwaitvisa.moi.gov.kw/', status: 'needs-verification' },

  // === AFRICA ===
  { country: 'Morocco', iso3: 'MAR', url: 'https://www.acces-maroc.ma/', status: 'confirmed', notes: 'Eligibility checker then application' },
  { country: 'Benin', iso3: 'BEN', url: 'https://evisa.bj/', status: 'confirmed' },
  { country: 'South Africa', iso3: 'ZAF', url: 'https://ehome.dha.gov.za/epermit/', status: 'button-nav', notes: 'Navigate to ePermit application' },
  { country: 'Nigeria', iso3: 'NGA', url: 'https://evisa.immigration.gov.ng/', status: 'button-nav', notes: 'Register/login to apply' },
  { country: 'Uganda', iso3: 'UGA', url: 'https://visas.immigration.go.ug/', status: 'needs-verification' },
  { country: 'Rwanda', iso3: 'RWA', url: 'https://rwandavisas.org/en_US/app', status: 'needs-verification' },
  { country: 'Mozambique', iso3: 'MOZ', url: 'https://evisa.gov.mz/', status: 'button-nav', notes: 'Click Apply Now to reach VFS portal' },
  { country: 'Zambia', iso3: 'ZMB', url: 'https://eservices.zambiaimmigration.gov.zm/#/sign-up', status: 'needs-verification' },
  { country: 'Zimbabwe', iso3: 'ZWE', url: 'https://www.evisa.gov.zw/', status: 'button-nav', notes: 'Click Start Visa Process' },
  { country: 'Madagascar', iso3: 'MDG', url: 'https://www.evisamada.gov.mg/en/', status: 'needs-verification' },
  { country: 'Malawi', iso3: 'MWI', url: 'https://evisa.gov.mw/', status: 'needs-verification' },
  { country: 'Cameroon', iso3: 'CMR', url: 'https://evisacam.cm/', status: 'button-nav', notes: 'Register/login then apply' },
  { country: 'Senegal', iso3: 'SEN', url: 'https://www.visasenegal.sn/', status: 'needs-verification' },
  { country: 'Ivory Coast', iso3: 'CIV', url: 'https://ivorycoastvisa.org/apply', status: 'needs-verification' },
  { country: 'Gabon', iso3: 'GAB', url: 'https://evisa.dgdi.ga/', status: 'needs-verification' },
  { country: 'Congo DRC', iso3: 'COD', url: 'https://evisa.gouv.cd/', status: 'needs-verification' },
  { country: 'Sierra Leone', iso3: 'SLE', url: 'https://www.evisa.sl/', status: 'needs-verification' },
  { country: 'Djibouti', iso3: 'DJI', url: 'https://www.evisa.gouv.dj/', status: 'needs-verification' },
  { country: 'Libya', iso3: 'LBY', url: 'https://evisa.gov.ly/', status: 'needs-verification' },
  { country: 'South Sudan', iso3: 'SSD', url: 'https://www.evisa.gov.ss/', status: 'button-nav', notes: 'Create account then apply' },
  { country: 'Somalia', iso3: 'SOM', url: 'https://evisa.gov.so/', status: 'needs-verification' },
  { country: 'Togo', iso3: 'TGO', url: 'https://beta.voyage.gouv.tg/travel?flow=in', status: 'confirmed', notes: 'Entry form. Exit form at ?flow=out' },
  { country: 'Burundi', iso3: 'BDI', url: 'https://www.migration.gov.bi/Apply/step1/3', status: 'needs-verification' },
  { country: 'Pakistan', iso3: 'PAK', url: 'https://visa.nadra.gov.pk/e-visa/', status: 'button-nav', notes: 'Click New Account to register then apply' },

  // === AMERICAS ===
  { country: 'Cuba', iso3: 'CUB', url: 'https://evisacuba.cu/en/inicio', status: 'needs-verification' },
  { country: 'Brazil', iso3: 'BRA', url: 'https://brazil.vfsevisa.com/', status: 'needs-verification', notes: 'For US/Canada/Australia citizens only' },
  { country: 'Suriname', iso3: 'SUR', url: 'https://suriname.vfsevisa.com/suriname/online/', status: 'needs-verification' },
  { country: 'Antigua and Barbuda', iso3: 'ATG', url: 'https://evisa.immigration.gov.ag/agEvisa-app/', status: 'needs-verification' },

  // === EUROPE ===
  { country: 'Schengen/ETIAS', iso3: 'ETIAS', url: 'https://travel-europe.europa.eu/en/etias', status: 'needs-verification', notes: 'Not yet operational — expected late 2026/early 2027' },

  // === PACIFIC ===
  { country: 'Papua New Guinea', iso3: 'PNG', url: 'https://evisa.ica.gov.pg/evisa/account/Apply', status: 'needs-verification' },
  { country: 'Vanuatu', iso3: 'VUT', url: 'https://evisa.gov.vu/visas', status: 'button-nav', notes: 'Click Apply Now for specific visa type' },
]

/** Look up the visa portal URL for a country by ISO-3 code or name */
export function getVisaPortal(query: string): VisaPortal | undefined {
  const q = query.toUpperCase()
  return VISA_PORTALS.find(
    (p) => p.iso3 === q || p.country.toUpperCase() === q
  )
}

/** Get all confirmed/button-nav portals (skip needs-verification) */
export function getReliablePortals(): VisaPortal[] {
  return VISA_PORTALS.filter((p) => p.status === 'confirmed' || p.status === 'button-nav')
}
