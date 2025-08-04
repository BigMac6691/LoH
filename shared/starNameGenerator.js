/**
 * Star Name Generator - Procedural generation of sci-fi style star names
 * Uses syllable-based construction to create unique, pronounceable names
 */

// Syllable components for name generation
const PREFIXES = [
  'Al', 'Ar', 'Az', 'Bel', 'Cal', 'Cor', 'Del', 'El', 'Eld', 'Fal', 'Gal', 'Gor',
  'Hel', 'Ion', 'Jar', 'Kal', 'Kor', 'Lor', 'Mal', 'Mor', 'Nar', 'Nel', 'Nor',
  'Ora', 'Pel', 'Qua', 'Ral', 'Sar', 'Sel', 'Tal', 'Thor', 'Ura', 'Val', 'Var',
  'Wor', 'Xan', 'Yor', 'Zan', 'Zor', 'Aeth', 'Bran', 'Cael', 'Dain', 'Eir',
  'Fael', 'Gwyn', 'Hael', 'Iris', 'Jael', 'Kael', 'Lael', 'Mael', 'Nael',
  'Ora', 'Pael', 'Quel', 'Rael', 'Sael', 'Tael', 'Uael', 'Vael', 'Wael'
];

const MIDDLES = [
  'an', 'ar', 'el', 'en', 'er', 'eth', 'in', 'ir', 'on', 'or', 'th', 'un',
  'al', 'am', 'at', 'ax', 'ex', 'ix', 'ox', 'ux', 'yn', 'yr', 'yr', 'ys',
  'ad', 'ed', 'id', 'od', 'ud', 'ag', 'eg', 'ig', 'og', 'ug', 'ak', 'ek',
  'ik', 'ok', 'uk', 'ap', 'ep', 'ip', 'op', 'up', 'as', 'es', 'is', 'os',
  'us', 'at', 'et', 'it', 'ot', 'ut', 'av', 'ev', 'iv', 'ov', 'uv'
];

const SUFFIXES = [
  'ar', 'ax', 'el', 'en', 'er', 'eth', 'ex', 'ix', 'on', 'or', 'ox', 'th',
  'an', 'in', 'un', 'yn', 'yr', 'ys', 'ad', 'ed', 'id', 'od', 'ud', 'ag',
  'eg', 'ig', 'og', 'ug', 'ak', 'ek', 'ik', 'ok', 'uk', 'al', 'am', 'ap',
  'ep', 'ip', 'op', 'up', 'as', 'es', 'is', 'os', 'us', 'at', 'et', 'it',
  'ot', 'ut', 'av', 'ev', 'iv', 'ov', 'uv', 'or', 'ar', 'er', 'ir', 'ur'
];

// Vowel and consonant patterns for better pronunciation
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'y'];
const CONSONANTS = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'];

// Track used names to ensure uniqueness
const usedNames = new Set();

/**
 * Check if a character is a vowel
 * @param {string} char - Character to check
 * @returns {boolean} True if character is a vowel
 */
function isVowel(char) {
  return VOWELS.includes(char.toLowerCase());
}

/**
 * Check if a character is a consonant
 * @param {string} char - Character to check
 * @returns {boolean} True if character is a consonant
 */
function isConsonant(char) {
  return CONSONANTS.includes(char.toLowerCase());
}

/**
 * Validate name pronunciation by checking for problematic patterns
 * @param {string} name - Name to validate
 * @returns {boolean} True if name has good pronunciation
 */
function isValidPronunciation(name) {
  const lowerName = name.toLowerCase();
  
  // Avoid too many consecutive consonants (hard to pronounce)
  let consecutiveConsonants = 0;
  let consecutiveVowels = 0;
  
  for (let i = 0; i < lowerName.length; i++) {
    const char = lowerName[i];
    
    if (isConsonant(char)) {
      consecutiveConsonants++;
      consecutiveVowels = 0;
      if (consecutiveConsonants > 4) return false; // Too many consonants in a row
    } else if (isVowel(char)) {
      consecutiveVowels++;
      consecutiveConsonants = 0;
      if (consecutiveVowels > 3) return false; // Too many vowels in a row
    }
  }
  
  // Avoid certain problematic patterns
  const problematicPatterns = [
    'xxx', 'zzz', 'qqq', 'www', 'hhh', 'jjj', // Too many same consonants
    'aaa', 'eee', 'iii', 'ooo', 'uuu', 'yyy', // Too many same vowels
    'qk', 'qj', 'qx', 'qz', // Q followed by non-U consonants
    'jq', 'jz', 'jx', // J followed by rare consonants
    'xq', 'xz', 'xj', // X followed by rare consonants
    'zq', 'zj', 'zx'  // Z followed by rare consonants
  ];
  
  for (const pattern of problematicPatterns) {
    if (lowerName.includes(pattern)) return false;
  }
  
  return true;
}

/**
 * Capitalize the first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Generate a single star name using procedural syllable construction
 * @param {Object} seededRandom - SeededRandom instance for deterministic generation
 * @returns {string} Generated star name
 */
export function generateStarName(seededRandom) {
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Determine name structure (2-3 syllables)
    const useMiddle = seededRandom.nextFloat(0, 1) < 0.4; // 40% chance of middle syllable
    
         // Select syllables
     const prefix = seededRandom.pick(PREFIXES);
     const middle = useMiddle ? seededRandom.pick(MIDDLES) : '';
     const suffix = seededRandom.pick(SUFFIXES);
    
    // Combine syllables
    let name = prefix + middle + suffix;
    
    // Ensure proper capitalization
    name = capitalize(name);
    
    // Validate pronunciation
    if (!isValidPronunciation(name)) {
      continue;
    }
    
    // Ensure minimum and maximum length
    if (name.length < 3 || name.length > 12) {
      continue;
    }
    
    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(name)) {
      continue;
    }
    
    return name;
  }
  
     // Fallback: simple 2-syllable name
   const prefix = seededRandom.pick(PREFIXES);
   const suffix = seededRandom.pick(SUFFIXES);
   return capitalize(prefix + suffix);
}

/**
 * Get a unique generated star name, ensuring no duplicates in the session
 * @param {Object} seededRandom - SeededRandom instance for deterministic generation
 * @returns {string} Unique generated star name
 */
export function getUniqueGeneratedName(seededRandom) {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const name = generateStarName(seededRandom);
    
    // Check if name is already used
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  
  // If we can't generate a unique name, add a number suffix
  const baseName = generateStarName(seededRandom);
  let counter = 1;
  let uniqueName = `${baseName}-${counter}`;
  
  while (usedNames.has(uniqueName) && counter < 1000) {
    counter++;
    uniqueName = `${baseName}-${counter}`;
  }
  
  usedNames.add(uniqueName);
  return uniqueName;
}

/**
 * Clear the used names cache (useful for new game sessions)
 */
export function clearUsedNames() {
  usedNames.clear();
}

/**
 * Get the count of used names
 * @returns {number} Number of names currently in use
 */
export function getUsedNameCount() {
  return usedNames.size;
}

/**
 * Check if a name is already used
 * @param {string} name - Name to check
 * @returns {boolean} True if name is already used
 */
export function isNameUsed(name) {
  return usedNames.has(name);
} 