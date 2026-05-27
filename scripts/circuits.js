// Single source of truth for circuit data, keyed by OpenF1 circuit_short_name.
// Each entry covers weather forecast coords (lat/lon) + display info (name, type, image, f1_slug).
//
// image    — filename in assets/circuits/openf1/ (from OpenF1 download)
// f1_slug  — slug for the official F1 CDN image (assets/circuits/official/{slug}.webp)
//            Set to null if F1 has no image for this circuit.
module.exports = {
  'Austin':             { lat:  30.1328, lon:  -97.6411, name: 'Circuit of the Americas',       type: 'Permanent', image: 'Austin.png',              f1_slug: 'austin' },
  'Baku':               { lat:  40.3697, lon:   49.8533, name: 'Baku City Circuit',              type: 'Street',    image: 'Baku.png',                f1_slug: 'baku' },
  'Catalunya':          { lat:  41.5700, lon:    2.2611, name: 'Circuit de Barcelona-Catalunya', type: 'Permanent', image: 'Catalunya.png',           f1_slug: 'catalunya' },
  'Hungaroring':        { lat:  47.5789, lon:   19.2486, name: 'Hungaroring',                    type: 'Permanent', image: 'Hungaroring.png',          f1_slug: 'hungaroring' },
  'Interlagos':         { lat: -23.7036, lon:  -46.6997, name: 'Interlagos',                     type: 'Permanent', image: 'Interlagos.png',           f1_slug: 'interlagos' },
  'Jeddah':             { lat:  21.6319, lon:   39.1044, name: 'Jeddah Corniche Circuit',        type: 'Street',    image: 'Jeddah.png',               f1_slug: 'jeddah' },
  'Las Vegas':          { lat:  36.1147, lon: -115.1728, name: 'Las Vegas Strip Circuit',        type: 'Street',    image: 'Las-Vegas.png',            f1_slug: 'lasvegas' },
  'Lusail':             { lat:  25.4900, lon:   51.4542, name: 'Lusail International',           type: 'Permanent', image: 'Lusail.png',               f1_slug: 'lusail' },
  'Melbourne':          { lat: -37.8497, lon:  144.9680, name: 'Albert Park',                    type: 'Street',    image: 'Melbourne.png',            f1_slug: 'melbourne' },
  'Mexico City':        { lat:  19.4042, lon:  -99.0907, name: 'Autódromo Hermanos Rodríguez',   type: 'Permanent', image: 'Mexico-City.png',          f1_slug: 'mexicocity' },
  'Miami':              { lat:  25.9581, lon:  -80.2389, name: 'Miami International',            type: 'Street',    image: 'Miami.png',                f1_slug: 'miami' },
  'Monte Carlo':        { lat:  43.7347, lon:    7.4205, name: 'Circuit de Monaco',              type: 'Street',    image: 'Monte-Carlo.png',          f1_slug: 'montecarlo' },
  'Montreal':           { lat:  45.5051, lon:  -73.5226, name: 'Circuit Gilles Villeneuve',      type: 'Street',    image: 'Montreal.png',             f1_slug: 'montreal' },
  'Monza':              { lat:  45.6156, lon:    9.2811, name: 'Autodromo di Monza',             type: 'Permanent', image: 'Monza.png',                f1_slug: 'monza' },
  'Sakhir':             { lat:  26.0325, lon:   50.5106, name: 'Bahrain International',          type: 'Permanent', image: 'Sakhir.png',               f1_slug: 'sakhir' },
  'Shanghai':           { lat:  31.3389, lon:  121.2198, name: 'Shanghai International',         type: 'Permanent', image: 'Shanghai.png',             f1_slug: 'shanghai' },
  'Silverstone':        { lat:  52.0786, lon:   -1.0169, name: 'Silverstone',                    type: 'Permanent', image: 'Silverstone.png',          f1_slug: 'silverstone' },
  'Singapore':          { lat:   1.2914, lon:  103.8639, name: 'Marina Bay Street Circuit',      type: 'Street',    image: 'Singapore.png',            f1_slug: 'singapore' },
  'Spa-Francorchamps':  { lat:  50.4372, lon:    5.9714, name: 'Circuit de Spa',                 type: 'Permanent', image: 'Spa-Francorchamps.png',    f1_slug: 'spafrancorchamps' },
  'Spielberg':          { lat:  47.2197, lon:   14.7647, name: 'Red Bull Ring',                  type: 'Permanent', image: 'Spielberg.png',            f1_slug: 'spielberg' },
  'Suzuka':             { lat:  34.8431, lon:  136.5413, name: 'Suzuka International',            type: 'Permanent', image: 'Suzuka.png',               f1_slug: 'suzuka' },
  'Yas Marina Circuit': { lat:  24.4672, lon:   54.6031, name: 'Yas Marina Circuit',             type: 'Permanent', image: 'Yas-Marina-Circuit.png',   f1_slug: 'yasmarina' },
  'Zandvoort':          { lat:  52.3888, lon:    4.5407, name: 'Circuit Zandvoort',              type: 'Permanent', image: 'Zandvoort.png',            f1_slug: 'zandvoort' },
};
