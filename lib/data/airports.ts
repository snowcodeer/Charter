export interface Airport {
  iata: string
  name: string
  city: string
  country: string
  lat: number
  lng: number
}

export const airports: Airport[] = [
  // North America
  { iata: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'US', lat: 40.6413, lng: -73.7781 },
  { iata: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'US', lat: 33.9425, lng: -118.4081 },
  { iata: 'ORD', name: "O'Hare International", city: 'Chicago', country: 'US', lat: 41.9742, lng: -87.9073 },
  { iata: 'SFO', name: 'San Francisco International', city: 'San Francisco', country: 'US', lat: 37.6213, lng: -122.379 },
  { iata: 'MIA', name: 'Miami International', city: 'Miami', country: 'US', lat: 25.7959, lng: -80.287 },
  { iata: 'ATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', country: 'US', lat: 33.6407, lng: -84.4277 },
  { iata: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', country: 'US', lat: 32.8998, lng: -97.0403 },
  { iata: 'DEN', name: 'Denver International', city: 'Denver', country: 'US', lat: 39.8561, lng: -104.6737 },
  { iata: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', country: 'US', lat: 47.4502, lng: -122.3088 },
  { iata: 'BOS', name: 'Boston Logan International', city: 'Boston', country: 'US', lat: 42.3656, lng: -71.0096 },
  { iata: 'EWR', name: 'Newark Liberty International', city: 'Newark', country: 'US', lat: 40.6895, lng: -74.1745 },
  { iata: 'IAD', name: 'Washington Dulles International', city: 'Washington DC', country: 'US', lat: 38.9531, lng: -77.4565 },
  { iata: 'HNL', name: 'Daniel K. Inouye International', city: 'Honolulu', country: 'US', lat: 21.3187, lng: -157.9225 },
  { iata: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', country: 'US', lat: 36.08, lng: -115.1522 },
  { iata: 'PHX', name: 'Phoenix Sky Harbor International', city: 'Phoenix', country: 'US', lat: 33.4373, lng: -112.0078 },
  { iata: 'YYZ', name: 'Toronto Pearson International', city: 'Toronto', country: 'CA', lat: 43.6777, lng: -79.6248 },
  { iata: 'YVR', name: 'Vancouver International', city: 'Vancouver', country: 'CA', lat: 49.1947, lng: -123.1792 },
  { iata: 'YUL', name: 'Montréal-Trudeau International', city: 'Montreal', country: 'CA', lat: 45.4706, lng: -73.7408 },
  { iata: 'MEX', name: 'Mexico City International', city: 'Mexico City', country: 'MX', lat: 19.4363, lng: -99.0721 },
  { iata: 'CUN', name: 'Cancún International', city: 'Cancún', country: 'MX', lat: 21.0365, lng: -86.8771 },

  // Europe
  { iata: 'LHR', name: 'London Heathrow', city: 'London', country: 'GB', lat: 51.47, lng: -0.4543 },
  { iata: 'LGW', name: 'London Gatwick', city: 'London', country: 'GB', lat: 51.1537, lng: -0.1821 },
  { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'FR', lat: 49.0097, lng: 2.5479 },
  { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'DE', lat: 50.0379, lng: 8.5622 },
  { iata: 'AMS', name: 'Amsterdam Schiphol', city: 'Amsterdam', country: 'NL', lat: 52.3105, lng: 4.7683 },
  { iata: 'MAD', name: 'Adolfo Suárez Madrid–Barajas', city: 'Madrid', country: 'ES', lat: 40.4983, lng: -3.5676 },
  { iata: 'BCN', name: 'Barcelona–El Prat', city: 'Barcelona', country: 'ES', lat: 41.2974, lng: 2.0833 },
  { iata: 'FCO', name: 'Leonardo da Vinci–Fiumicino', city: 'Rome', country: 'IT', lat: 41.8003, lng: 12.2389 },
  { iata: 'MXP', name: 'Milan Malpensa', city: 'Milan', country: 'IT', lat: 45.63, lng: 8.7231 },
  { iata: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'DE', lat: 48.3537, lng: 11.7861 },
  { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'CH', lat: 47.4647, lng: 8.5492 },
  { iata: 'VIE', name: 'Vienna International', city: 'Vienna', country: 'AT', lat: 48.1103, lng: 16.5697 },
  { iata: 'CPH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'DK', lat: 55.618, lng: 12.656 },
  { iata: 'OSL', name: 'Oslo Gardermoen', city: 'Oslo', country: 'NO', lat: 60.1976, lng: 11.1004 },
  { iata: 'ARN', name: 'Stockholm Arlanda', city: 'Stockholm', country: 'SE', lat: 59.6519, lng: 17.9186 },
  { iata: 'HEL', name: 'Helsinki-Vantaa', city: 'Helsinki', country: 'FI', lat: 60.3172, lng: 24.9633 },
  { iata: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'IE', lat: 53.4264, lng: -6.2499 },
  { iata: 'LIS', name: 'Lisbon Humberto Delgado', city: 'Lisbon', country: 'PT', lat: 38.7756, lng: -9.1354 },
  { iata: 'ATH', name: 'Athens International', city: 'Athens', country: 'GR', lat: 37.9364, lng: 23.9445 },
  { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'TR', lat: 41.2753, lng: 28.7519 },
  { iata: 'WAW', name: 'Warsaw Chopin', city: 'Warsaw', country: 'PL', lat: 52.1657, lng: 20.9671 },
  { iata: 'PRG', name: 'Václav Havel Airport', city: 'Prague', country: 'CZ', lat: 50.1008, lng: 14.26 },
  { iata: 'BUD', name: 'Budapest Ferenc Liszt', city: 'Budapest', country: 'HU', lat: 47.4298, lng: 19.2611 },
  { iata: 'EDI', name: 'Edinburgh Airport', city: 'Edinburgh', country: 'GB', lat: 55.95, lng: -3.3725 },

  // Asia
  { iata: 'NRT', name: 'Narita International', city: 'Tokyo', country: 'JP', lat: 35.7647, lng: 140.3864 },
  { iata: 'HND', name: 'Tokyo Haneda', city: 'Tokyo', country: 'JP', lat: 35.5494, lng: 139.7798 },
  { iata: 'KIX', name: 'Kansai International', city: 'Osaka', country: 'JP', lat: 34.4347, lng: 135.244 },
  { iata: 'ICN', name: 'Incheon International', city: 'Seoul', country: 'KR', lat: 37.4602, lng: 126.4407 },
  { iata: 'PEK', name: 'Beijing Capital International', city: 'Beijing', country: 'CN', lat: 40.0799, lng: 116.6031 },
  { iata: 'PVG', name: 'Shanghai Pudong International', city: 'Shanghai', country: 'CN', lat: 31.1443, lng: 121.8083 },
  { iata: 'HKG', name: 'Hong Kong International', city: 'Hong Kong', country: 'HK', lat: 22.308, lng: 113.9185 },
  { iata: 'TPE', name: 'Taiwan Taoyuan International', city: 'Taipei', country: 'TW', lat: 25.0777, lng: 121.2325 },
  { iata: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'SG', lat: 1.3644, lng: 103.9915 },
  { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'TH', lat: 13.6899, lng: 100.7501 },
  { iata: 'KUL', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'MY', lat: 2.7456, lng: 101.7099 },
  { iata: 'CGK', name: 'Soekarno-Hatta International', city: 'Jakarta', country: 'ID', lat: -6.1256, lng: 106.6559 },
  { iata: 'DPS', name: 'Ngurah Rai International', city: 'Bali', country: 'ID', lat: -8.7482, lng: 115.1672 },
  { iata: 'MNL', name: 'Ninoy Aquino International', city: 'Manila', country: 'PH', lat: 14.5086, lng: 121.0194 },
  { iata: 'SGN', name: 'Tan Son Nhat International', city: 'Ho Chi Minh City', country: 'VN', lat: 10.8188, lng: 106.6519 },
  { iata: 'HAN', name: 'Noi Bai International', city: 'Hanoi', country: 'VN', lat: 21.2212, lng: 105.807 },
  { iata: 'DEL', name: 'Indira Gandhi International', city: 'Delhi', country: 'IN', lat: 28.5562, lng: 77.1 },
  { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj International', city: 'Mumbai', country: 'IN', lat: 19.0896, lng: 72.8656 },
  { iata: 'BLR', name: 'Kempegowda International', city: 'Bangalore', country: 'IN', lat: 13.1986, lng: 77.7066 },
  { iata: 'CMB', name: 'Bandaranaike International', city: 'Colombo', country: 'LK', lat: 7.1808, lng: 79.8841 },
  { iata: 'KTM', name: 'Tribhuvan International', city: 'Kathmandu', country: 'NP', lat: 27.6966, lng: 85.3591 },

  // Middle East
  { iata: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'AE', lat: 25.2532, lng: 55.3657 },
  { iata: 'AUH', name: 'Abu Dhabi International', city: 'Abu Dhabi', country: 'AE', lat: 24.433, lng: 54.6511 },
  { iata: 'DOH', name: 'Hamad International', city: 'Doha', country: 'QA', lat: 25.2731, lng: 51.6081 },
  { iata: 'RUH', name: 'King Khalid International', city: 'Riyadh', country: 'SA', lat: 24.9576, lng: 46.6988 },
  { iata: 'JED', name: 'King Abdulaziz International', city: 'Jeddah', country: 'SA', lat: 21.6796, lng: 39.1565 },
  { iata: 'TLV', name: 'Ben Gurion International', city: 'Tel Aviv', country: 'IL', lat: 32.0114, lng: 34.8867 },
  { iata: 'AMM', name: 'Queen Alia International', city: 'Amman', country: 'JO', lat: 31.7226, lng: 35.9932 },

  // Africa
  { iata: 'JNB', name: 'O.R. Tambo International', city: 'Johannesburg', country: 'ZA', lat: -26.1392, lng: 28.246 },
  { iata: 'CPT', name: 'Cape Town International', city: 'Cape Town', country: 'ZA', lat: -33.9715, lng: 18.6021 },
  { iata: 'CAI', name: 'Cairo International', city: 'Cairo', country: 'EG', lat: 30.1219, lng: 31.4056 },
  { iata: 'NBO', name: 'Jomo Kenyatta International', city: 'Nairobi', country: 'KE', lat: -1.3192, lng: 36.9278 },
  { iata: 'LOS', name: 'Murtala Muhammed International', city: 'Lagos', country: 'NG', lat: 6.5774, lng: 3.3212 },
  { iata: 'ADD', name: 'Addis Ababa Bole International', city: 'Addis Ababa', country: 'ET', lat: 8.9779, lng: 38.7993 },
  { iata: 'CMN', name: 'Mohammed V International', city: 'Casablanca', country: 'MA', lat: 33.3675, lng: -7.5898 },

  // South America
  { iata: 'GRU', name: 'São Paulo–Guarulhos International', city: 'São Paulo', country: 'BR', lat: -23.4356, lng: -46.4731 },
  { iata: 'GIG', name: 'Rio de Janeiro–Galeão International', city: 'Rio de Janeiro', country: 'BR', lat: -22.8099, lng: -43.2505 },
  { iata: 'EZE', name: 'Ministro Pistarini International', city: 'Buenos Aires', country: 'AR', lat: -34.8222, lng: -58.5358 },
  { iata: 'SCL', name: 'Arturo Merino Benítez International', city: 'Santiago', country: 'CL', lat: -33.393, lng: -70.7858 },
  { iata: 'BOG', name: 'El Dorado International', city: 'Bogotá', country: 'CO', lat: 4.7016, lng: -74.1469 },
  { iata: 'LIM', name: 'Jorge Chávez International', city: 'Lima', country: 'PE', lat: -12.0219, lng: -77.1143 },

  // Oceania
  { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'AU', lat: -33.9461, lng: 151.1772 },
  { iata: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'AU', lat: -37.6733, lng: 144.8433 },
  { iata: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'AU', lat: -27.3842, lng: 153.1175 },
  { iata: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'NZ', lat: -37.008, lng: 174.792 },

  // Central America / Caribbean
  { iata: 'PTY', name: 'Tocumen International', city: 'Panama City', country: 'PA', lat: 9.0714, lng: -79.3835 },
  { iata: 'SJO', name: 'Juan Santamaría International', city: 'San José', country: 'CR', lat: 9.9939, lng: -84.2088 },
  { iata: 'HAV', name: 'José Martí International', city: 'Havana', country: 'CU', lat: 22.9892, lng: -82.4091 },
  { iata: 'MBJ', name: 'Sangster International', city: 'Montego Bay', country: 'JM', lat: 18.5037, lng: -77.9134 },

  // Central Asia
  { iata: 'ISB', name: 'Islamabad International', city: 'Islamabad', country: 'PK', lat: 33.5605, lng: 72.8526 },
  { iata: 'DAC', name: 'Hazrat Shahjalal International', city: 'Dhaka', country: 'BD', lat: 23.8433, lng: 90.3978 },
  { iata: 'TAS', name: 'Tashkent International', city: 'Tashkent', country: 'UZ', lat: 41.2608, lng: 69.2813 },

  // Russia / Eastern Europe
  { iata: 'SVO', name: 'Sheremetyevo International', city: 'Moscow', country: 'RU', lat: 55.9726, lng: 37.4146 },
  { iata: 'LED', name: 'Pulkovo Airport', city: 'Saint Petersburg', country: 'RU', lat: 59.8003, lng: 30.2625 },
]

/**
 * Search airports by IATA code, city name, or airport name.
 * Case-insensitive substring match, minimum 2 characters.
 */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  return airports
    .filter(
      (a) =>
        a.iata.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q)
    )
    .slice(0, limit)
}
