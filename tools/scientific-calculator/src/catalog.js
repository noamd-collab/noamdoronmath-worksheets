/* fx-991ES PLUS 2nd edition catalogue. Numeric data, not firmware.
 * Casio specifies CODATA 2014; values are checked against NIST's 2014 archive,
 * not the revised post-2019 SI. Exact pre-2019 electromagnetic constants use
 * their defining equations. Casio's rounded NIST SP 811 (2008) conversion
 * factors are retained: the manual's 100 g -> oz example is 3.527396584.
 * Every conversion computes output = input * factor + offset.
 * Both catalogues are local data; no network request is made at runtime.
 */
const SCIENTIFIC_CATALOG_SOURCE = 'https://www.casio.com/content/dam/casio/global/support/manuals/calculators/pdf/004-en/f/fx-570ESPLUS_991ESPLUS_EN.pdf';
const SCIENTIFIC_CONSTANT_VALUES_SOURCE = 'https://physics.nist.gov/cuu/Constants/ArchiveASCII/allascii_2014.txt';
const SCIENTIFIC_CATALOG_EDITION = 'fx-991ES PLUS 2nd edition; CODATA 2014; NIST SP 811 (2008)';
const SCIENTIFIC_CONSTANTS = [
  { id:'01', symbol:'mₚ', nameHe:'מסת הפרוטון', unit:'kg', value:1.672621898e-27 },
  { id:'02', symbol:'mₙ', nameHe:'מסת הנייטרון', unit:'kg', value:1.674927471e-27 },
  { id:'03', symbol:'mₑ', nameHe:'מסת האלקטרון', unit:'kg', value:9.10938356e-31 },
  { id:'04', symbol:'mμ', nameHe:'מסת המיואון', unit:'kg', value:1.883531594e-28 },
  { id:'05', symbol:'a₀', nameHe:'רדיוס בוהר', unit:'m', value:0.52917721067e-10 },
  { id:'06', symbol:'h', nameHe:'קבוע פלאנק', unit:'J·s', value:6.626070040e-34 },
  { id:'07', symbol:'μN', nameHe:'מגנטון גרעיני', unit:'J·T⁻¹', value:5.050783699e-27 },
  { id:'08', symbol:'μB', nameHe:'מגנטון בוהר', unit:'J·T⁻¹', value:927.4009994e-26 },
  { id:'09', symbol:'ℏ', nameHe:'קבוע פלאנק המצומצם', unit:'J·s', value:1.054571800e-34 },
  { id:'10', symbol:'α', nameHe:'קבוע המבנה העדין', unit:'', value:7.2973525664e-3 },
  { id:'11', symbol:'rₑ', nameHe:'רדיוס האלקטרון הקלאסי', unit:'m', value:2.8179403227e-15 },
  { id:'12', symbol:'λc', nameHe:'אורך גל קומפטון של האלקטרון', unit:'m', value:2.4263102367e-12 },
  { id:'13', symbol:'γₚ', nameHe:'היחס הגירומגנטי של הפרוטון', unit:'s⁻¹·T⁻¹', value:2.675221900e8 },
  { id:'14', symbol:'λc,p', nameHe:'אורך גל קומפטון של הפרוטון', unit:'m', value:1.32140985396e-15 },
  { id:'15', symbol:'λc,n', nameHe:'אורך גל קומפטון של הנייטרון', unit:'m', value:1.31959090481e-15 },
  { id:'16', symbol:'R∞', nameHe:'קבוע רידברג', unit:'m⁻¹', value:10973731.568508 },
  { id:'17', symbol:'u', nameHe:'יחידת מסה אטומית', unit:'kg', value:1.660539040e-27 },
  { id:'18', symbol:'μₚ', nameHe:'המומנט המגנטי של הפרוטון', unit:'J·T⁻¹', value:1.4106067873e-26 },
  { id:'19', symbol:'μₑ', nameHe:'המומנט המגנטי של האלקטרון', unit:'J·T⁻¹', value:-928.4764620e-26 },
  { id:'20', symbol:'μₙ', nameHe:'המומנט המגנטי של הנייטרון', unit:'J·T⁻¹', value:-0.96623650e-26 },
  { id:'21', symbol:'μμ', nameHe:'המומנט המגנטי של המיואון', unit:'J·T⁻¹', value:-4.49044826e-26 },
  { id:'22', symbol:'F', nameHe:'קבוע פאראדיי', unit:'C·mol⁻¹', value:96485.33289 },
  { id:'23', symbol:'e', nameHe:'המטען היסודי', unit:'C', value:1.6021766208e-19 },
  { id:'24', symbol:'Nₐ', nameHe:'קבוע אבוגדרו', unit:'mol⁻¹', value:6.022140857e23 },
  { id:'25', symbol:'k', nameHe:'קבוע בולצמן', unit:'J·K⁻¹', value:1.38064852e-23 },
  { id:'26', symbol:'Vₘ', nameHe:'נפח מולרי של גז אידאלי (273.15 K, 100 kPa)', unit:'m³·mol⁻¹', value:22.710947e-3 },
  { id:'27', symbol:'R', nameHe:'קבוע הגזים', unit:'J·mol⁻¹·K⁻¹', value:8.3144598 },
  { id:'28', symbol:'c₀', nameHe:'מהירות האור בריק', unit:'m·s⁻¹', value:299792458 },
  { id:'29', symbol:'c₁', nameHe:'קבוע הקרינה הראשון', unit:'W·m²', value:3.741771790e-16 },
  { id:'30', symbol:'c₂', nameHe:'קבוע הקרינה השני', unit:'m·K', value:1.43877736e-2 },
  { id:'31', symbol:'σ', nameHe:'קבוע סטפן–בולצמן', unit:'W·m⁻²·K⁻⁴', value:5.670367e-8 },
  { id:'32', symbol:'ε₀', nameHe:'המקדם הדיאלקטרי של הריק', unit:'F·m⁻¹', value:1/(4*Math.PI*1e-7*299792458**2) },
  { id:'33', symbol:'μ₀', nameHe:'החדירות המגנטית של הריק', unit:'N·A⁻²', value:4*Math.PI*1e-7 },
  { id:'34', symbol:'Φ₀', nameHe:'קוונט השטף המגנטי', unit:'Wb', value:2.067833831e-15 },
  { id:'35', symbol:'g', nameHe:'תאוצת הכובד התקנית', unit:'m·s⁻²', value:9.80665 },
  { id:'36', symbol:'G₀', nameHe:'קוונט המוליכות', unit:'S', value:7.7480917310e-5 },
  { id:'37', symbol:'Z₀', nameHe:'העכבה האופיינית של הריק', unit:'Ω', value:4*Math.PI*1e-7*299792458 },
  { id:'38', symbol:'t', nameHe:'אפס מעלות צלזיוס בקלווין', unit:'K', value:273.15 },
  { id:'39', symbol:'G', nameHe:'קבוע הכבידה הניוטוני', unit:'m³·kg⁻¹·s⁻²', value:6.67408e-11 },
  { id:'40', symbol:'atm', nameHe:'לחץ אטמוספרי תקני', unit:'Pa', value:101325 }
].map(entry => Object.freeze({ ...entry, source: SCIENTIFIC_CATALOG_SOURCE + '#page=' + (Number(entry.id) <= 6 ? 42 : 43), valuesSource:SCIENTIFIC_CONSTANT_VALUES_SOURCE, edition:'CODATA 2014 (PLUS 2nd edition)' }));

const UNIT_CONVERSIONS = [
  { id:'01', label:'אינץ׳ ← סנטימטר', from:'in', to:'cm', factor:2.54 },
  { id:'02', label:'סנטימטר ← אינץ׳', from:'cm', to:'in', factor:1/2.54 },
  { id:'03', label:'רגל ← מטר', from:'ft', to:'m', factor:0.3048 },
  { id:'04', label:'מטר ← רגל', from:'m', to:'ft', factor:1/0.3048 },
  { id:'05', label:'יארד ← מטר', from:'yd', to:'m', factor:0.9144 },
  { id:'06', label:'מטר ← יארד', from:'m', to:'yd', factor:1/0.9144 },
  { id:'07', label:'מייל ← קילומטר', from:'mile', to:'km', factor:1.609344 },
  { id:'08', label:'קילומטר ← מייל', from:'km', to:'mile', factor:1/1.609344 },
  { id:'09', label:'מייל ימי ← מטר', from:'n mile', to:'m', factor:1852 },
  { id:'10', label:'מטר ← מייל ימי', from:'m', to:'n mile', factor:1/1852 },
  { id:'11', label:'אקר ← מטר רבוע', from:'acre', to:'m²', factor:4046.856 },
  { id:'12', label:'מטר רבוע ← אקר', from:'m²', to:'acre', factor:1/4046.856 },
  { id:'13', label:'גלון אמריקאי ← ליטר', from:'gal (US)', to:'L', factor:3.785412 },
  { id:'14', label:'ליטר ← גלון אמריקאי', from:'L', to:'gal (US)', factor:1/3.785412 },
  { id:'15', label:'גלון בריטי ← ליטר', from:'gal (UK)', to:'L', factor:4.54609 },
  { id:'16', label:'ליטר ← גלון בריטי', from:'L', to:'gal (UK)', factor:1/4.54609 },
  { id:'17', label:'פארסק ← קילומטר', from:'pc', to:'km', factor:3.085678e13 },
  { id:'18', label:'קילומטר ← פארסק', from:'km', to:'pc', factor:1/3.085678e13 },
  { id:'19', label:'קילומטר לשעה ← מטר לשנייה', from:'km/h', to:'m/s', factor:5/18 },
  { id:'20', label:'מטר לשנייה ← קילומטר לשעה', from:'m/s', to:'km/h', factor:18/5 },
  { id:'21', label:'אונקיה ← גרם', from:'oz', to:'g', factor:28.34952 },
  { id:'22', label:'גרם ← אונקיה', from:'g', to:'oz', factor:1/28.34952 },
  { id:'23', label:'פאונד ← קילוגרם', from:'lb', to:'kg', factor:0.4535924 },
  { id:'24', label:'קילוגרם ← פאונד', from:'kg', to:'lb', factor:1/0.4535924 },
  { id:'25', label:'אטמוספרה ← פסקל', from:'atm', to:'Pa', factor:101325 },
  { id:'26', label:'פסקל ← אטמוספרה', from:'Pa', to:'atm', factor:1/101325 },
  { id:'27', label:'מילימטר כספית ← פסקל', from:'mmHg', to:'Pa', factor:133.3224 },
  { id:'28', label:'פסקל ← מילימטר כספית', from:'Pa', to:'mmHg', factor:1/133.3224 },
  { id:'29', label:'כוח סוס ← קילוואט', from:'hp', to:'kW', factor:0.7457 },
  { id:'30', label:'קילוואט ← כוח סוס', from:'kW', to:'hp', factor:1/0.7457 },
  { id:'31', label:'קילוגרם־כוח לסמ״ר ← פסקל', from:'kgf/cm²', to:'Pa', factor:98066.5 },
  { id:'32', label:'פסקל ← קילוגרם־כוח לסמ״ר', from:'Pa', to:'kgf/cm²', factor:1/98066.5 },
  { id:'33', label:'קילוגרם־כוח מטר ← ג׳אול', from:'kgf·m', to:'J', factor:9.80665 },
  { id:'34', label:'ג׳אול ← קילוגרם־כוח מטר', from:'J', to:'kgf·m', factor:1/9.80665 },
  { id:'35', label:'פאונד־כוח לאינץ׳ רבוע ← קילופסקל', from:'lbf/in²', to:'kPa', factor:6.894757 },
  { id:'36', label:'קילופסקל ← פאונד־כוח לאינץ׳ רבוע', from:'kPa', to:'lbf/in²', factor:1/6.894757 },
  { id:'37', label:'פרנהייט ← צלזיוס', from:'°F', to:'°C', factor:1/1.8, offset:-32/1.8 },
  { id:'38', label:'צלזיוס ← פרנהייט', from:'°C', to:'°F', factor:1.8, offset:32 },
  { id:'39', label:'ג׳אול ← קלוריה (15°C)', from:'J', to:'cal₁₅', factor:1/4.1858 },
  { id:'40', label:'קלוריה (15°C) ← ג׳אול', from:'cal₁₅', to:'J', factor:4.1858 }
].map(entry => Object.freeze({ offset:0, ...entry, source:SCIENTIFIC_CATALOG_SOURCE + '#page=' + (Number(entry.id) <= 16 ? 44 : 45), edition:'NIST SP 811 (2008), Casio conversion factors' }));

function convertScientificUnit(value, id) {
  const item = UNIT_CONVERSIONS.find(entry => entry.id === String(id).padStart(2, '0'));
  if (!item) throw new RangeError('המרת היחידות לא נמצאה');
  const input = Number(value);
  if (!Number.isFinite(input)) throw new TypeError('יש להזין מספר סופי');
  const result = input * item.factor + item.offset;
  if (!Number.isFinite(result)) throw new RangeError('התוצאה מחוץ לטווח המספרים');
  return Object.is(result, -0) ? 0 : result;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCIENTIFIC_CONSTANTS, UNIT_CONVERSIONS, SCIENTIFIC_CATALOG_SOURCE, SCIENTIFIC_CONSTANT_VALUES_SOURCE, SCIENTIFIC_CATALOG_EDITION, convertScientificUnit };
}
