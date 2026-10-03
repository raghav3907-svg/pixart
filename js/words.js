// ─────────────────────────────────────────
//  Skribbl – Word List
// ─────────────────────────────────────────

const WORDS = [
  'apple','banana','car','dog','elephant','flower','guitar','house',
  'jellyfish','kite','lion','mountain','notebook','ocean','penguin',
  'rainbow','sun','tree','umbrella','violin','whale','airplane',
  'butterfly','castle','dolphin','fire','ghost','helicopter','island',
  'jungle','kangaroo','lemon','moon','octopus','pizza','rocket','snake',
  'unicorn','volcano','waterfall','bridge','camera','diamond','eagle',
  'football','giraffe','hammer','robot','spider','train','wizard',
  'anchor','balloon','clock','dragon','mushroom','snowflake','telescope',
  'crown','sword','shield','treasure','compass','candle','cactus',
  'starfish','lighthouse','skateboard','sandwich','parrot','turtle',
  'cookie','submarine','dinosaur','pineapple','windmill','vampire',
  'mermaid','pirate','ninja','astronaut','tornado','igloo','lantern',
  'compass','feather','porcupine','flamingo','toucan','koala','panda',
];

/**
 * Return `n` random words from WORDS (no repeats).
 * @param {number} n
 * @returns {string[]}
 */
function randWords(n) {
  return [...WORDS].sort(() => Math.random() - 0.5).slice(0, n);
}
