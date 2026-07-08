#!/usr/bin/env node
// Author the kid-safe core vocabulary: common, concrete, picturable words with
// one plain clue each, so a K–2 mini can fill from kid words ALONE (no adult
// "easyMain" spillover). Heavy on 4–5 letter words — that's the 5×5 crossing
// bottleneck. Emits src/data/kids/kids-core.json, skipping answers the kids
// bank already carries. Kids entries aren't under the wordbank validator, so a
// single simple clue per word is fine.
//
//   node scripts/author-kids-core.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const KIDS_DIR = join(ROOT, 'src/data/kids');

// [answer, clue, category, tag]. Clues are concrete and kindergarten-plain;
// none contain the answer (or its stem). Category is one of the 7 known ones.
const SN = 'science-nature', SL = 'sports-leisure', EN = 'entertainment',
  GEO = 'geography', AL = 'arts-literature', WP = 'wordplay', HI = 'history';

/** word → clue, grouped only for authoring sanity; tag/category set per group. */
const GROUPS = [
  { cat: SN, tag: 'animals', words: [
    ['FROG', 'Green hopper that says ribbit'],
    ['GOAT', 'Farm animal that nibbles everything'],
    ['BEAR', 'Big furry animal that loves honey'],
    ['LION', 'King of the jungle'],
    ['WOLF', 'Wild cousin of the dog that howls'],
    ['DEER', 'Forest animal with antlers'],
    ['DUCK', 'Bird that quacks and swims'],
    ['FISH', 'Swimmer with fins and gills'],
    ['BIRD', 'Feathered animal that can fly'],
    ['CRAB', 'Beach critter that walks sideways'],
    ['SEAL', 'Sea animal that claps and barks'],
    ['LAMB', 'Baby sheep'],
    ['PONY', 'A little horse'],
    ['HARE', 'Fast animal like a big rabbit'],
    ['TOAD', 'Bumpy cousin of the frog'],
    ['WORM', 'Wiggly critter in the dirt'],
    ['MOLE', 'Animal that digs tunnels underground'],
    ['CUB', 'Baby bear or lion'],
    ['HORSE', 'Animal you can ride that neighs'],
    ['SHEEP', 'Woolly farm animal that says baa'],
    ['MOUSE', 'Tiny animal that likes cheese'],
    ['TIGER', 'Big cat with orange and black stripes'],
    ['ZEBRA', 'Animal that looks like a striped horse'],
    ['KOALA', 'Cuddly animal that hugs trees'],
    ['PANDA', 'Black-and-white bear that eats bamboo'],
    ['SNAKE', 'Long animal with no legs'],
    ['ROBIN', 'Bird with a red chest'],
    ['EAGLE', 'Big bird with a sharp beak'],
    ['SHARK', 'Sea animal with lots of teeth'],
    ['WHALE', 'Biggest animal in the ocean'],
    ['PUPPY', 'A baby dog'],
    ['BUNNY', 'A soft rabbit with long ears'],
    ['CHICK', 'A fluffy baby hen'],
    ['MOOSE', 'Big forest animal with huge antlers'],
    ['SKUNK', 'Black-and-white animal with a stinky smell'],
    ['CAMEL', 'Desert animal with a hump'],
    ['RABBIT', 'Hopping pet with long ears'],
    ['MONKEY', 'Animal that swings in trees'],
    ['TURTLE', 'Slow animal with a hard shell'],
    ['PARROT', 'Colorful bird that can talk'],
    ['SPIDER', 'Eight-legged web spinner'],
    ['KITTEN', 'A baby cat'],
  ] },
  { cat: SN, tag: 'food', words: [
    ['EGG', 'Breakfast food a hen lays'],
    ['JAM', 'Sweet fruit spread for toast'],
    ['PIE', 'Round dessert with fruit inside'],
    ['NUT', 'Hard snack a squirrel loves'],
    ['CAKE', 'Sweet treat for a birthday'],
    ['CORN', 'Yellow veggie on a cob'],
    ['MILK', 'White drink from a cow'],
    ['RICE', 'Little white grains you eat'],
    ['SOUP', 'Warm meal you eat with a spoon'],
    ['BEAN', 'Little veggie in a pod'],
    ['PEAR', 'Sweet fruit shaped like a bell'],
    ['PLUM', 'Small purple fruit'],
    ['MEAT', 'Food that comes from animals'],
    ['SALT', 'White stuff that makes food tasty'],
    ['TACO', 'Folded shell with yummy filling'],
    ['APPLE', 'Red or green fruit that crunches'],
    ['BREAD', 'Food you use to make a sandwich'],
    ['PIZZA', 'Round food with cheese on top'],
    ['CANDY', 'Sweet treat you get on Halloween'],
    ['JUICE', 'Sweet drink squeezed from fruit'],
    ['HONEY', 'Sweet gold syrup bees make'],
    ['LEMON', 'Sour yellow fruit'],
    ['MANGO', 'Sweet orange tropical fruit'],
    ['PEACH', 'Fuzzy sweet fruit'],
    ['GRAPE', 'Little round fruit on a vine'],
    ['DONUT', 'Sweet ring you dunk in milk'],
    ['SUGAR', 'Sweet white stuff in cookies'],
    ['TOAST', 'Bread that has been warmed and browned'],
    ['CHERRY', 'Little red fruit with a pit'],
    ['BANANA', 'Long yellow fruit a monkey loves'],
    ['CARROT', 'Orange veggie a bunny loves'],
    ['CHEESE', 'Yellow food a mouse loves'],
    ['COOKIE', 'Round sweet treat with chips'],
  ] },
  { cat: SN, tag: 'nature', words: [
    ['SKY', 'The big blue space above you'],
    ['SEA', 'The great big salty water'],
    ['MUD', 'Wet dirt you can squish'],
    ['LOG', 'A fallen tree trunk'],
    ['LEAF', 'Green part that grows on a tree'],
    ['ROCK', 'A hard stone on the ground'],
    ['SAND', 'Tiny bits you dig at the beach'],
    ['STAR', 'Twinkly light in the night sky'],
    ['MOON', 'Bright circle in the night sky'],
    ['TREE', 'Tall plant with a trunk and leaves'],
    ['ROSE', 'A red flower with a sweet smell'],
    ['SEED', 'Tiny thing a plant grows from'],
    ['HILL', 'A little mountain'],
    ['LAKE', 'A big pool of water with land around it'],
    ['CAVE', 'A dark hole in a mountain'],
    ['POND', 'A small pool where frogs live'],
    ['PLANT', 'Green thing that grows in a garden'],
    ['CLOUD', 'Fluffy white thing in the sky'],
    ['GRASS', 'Green stuff that covers a yard'],
    ['RIVER', 'Water that flows to the sea'],
    ['BEACH', 'Sandy place by the ocean'],
    ['STONE', 'Another word for a rock'],
    ['FLOWER', 'Pretty part of a plant that blooms'],
    ['FOREST', 'A place with lots of trees'],
  ] },
  { cat: SN, tag: 'weather', words: [
    ['SUN', 'Bright star that warms the day'],
    ['RAIN', 'Water that falls from clouds'],
    ['SNOW', 'White flakes that fall in winter'],
    ['WIND', 'Moving air that blows leaves'],
    ['ICE', 'Frozen water that is cold and hard'],
    ['HAIL', 'Little balls of ice that fall'],
    ['STORM', 'Weather with thunder and rain'],
    ['CLOUDY', 'When the sky is full of gray'],
  ] },
  { cat: SN, tag: 'space', words: [
    ['MARS', 'The red planet'],
    ['COMET', 'Space ball with a long glowing tail'],
    ['ORBIT', 'The path a planet takes around the sun'],
    ['ROCKET', 'Ship that blasts into space'],
    ['PLANET', 'A big world that circles the sun'],
    ['ALIEN', 'A make-believe being from space'],
  ] },
  { cat: SN, tag: 'body', words: [
    ['ARM', 'Part of you with a hand at the end'],
    ['EAR', 'Body part you hear with'],
    ['EYE', 'Body part you see with'],
    ['TOE', 'Little part at the end of your foot'],
    ['LEG', 'Body part you walk on'],
    ['HAND', 'Part of you with five fingers'],
    ['FOOT', 'Body part inside your shoe'],
    ['NOSE', 'Face part you smell with'],
    ['HAIR', 'Stuff that grows on your head'],
    ['KNEE', 'The bendy middle of your leg'],
    ['TEETH', 'White parts you chew with'],
    ['SMILE', 'Happy shape your mouth makes'],
    ['THUMB', 'The short fat finger'],
  ] },
  { cat: SL, tag: 'sports', words: [
    ['BAT', 'Stick you swing to hit a baseball'],
    ['GYM', 'Room where you play and exercise'],
    ['NET', 'What you kick a soccer ball into'],
    ['BALL', 'Round toy you bounce or throw'],
    ['GOAL', 'Where you score in soccer'],
    ['BIKE', 'Two-wheeler you pedal'],
    ['SWIM', 'What you do to move in a pool'],
    ['KICK', 'What your foot does to a ball'],
    ['SKATE', 'Roll along on wheels or ice'],
    ['SKI', 'Slide down a snowy hill'],
    ['TEAM', 'A group that plays together'],
  ] },
  { cat: AL, tag: 'school', words: [
    ['PEN', 'Tool you write with in ink'],
    ['MAP', 'Drawing that shows where places are'],
    ['ABC', 'The start of the alphabet'],
    ['BOOK', 'Pages you read with a story inside'],
    ['DESK', 'Table you sit at in class'],
    ['GLUE', 'Sticky stuff for crafts'],
    ['READ', 'What you do with a book'],
    ['DRAW', 'Make a picture with a crayon'],
    ['WORD', 'Letters that go together to mean something'],
    ['CLASS', 'Group of kids who learn together'],
    ['CHALK', 'White stick for writing on a board'],
    ['PAINT', 'Colorful stuff you brush on paper'],
    ['CRAYON', 'Colored wax stick for drawing'],
    ['PENCIL', 'Writing tool with an eraser on top'],
    ['ERASER', 'Rubber that rubs out mistakes'],
  ] },
  { cat: WP, tag: 'colors', words: [
    ['RED', 'Color of a stop sign'],
    ['TAN', 'Light brown color'],
    ['BLUE', 'Color of the clear sky'],
    ['PINK', 'Light red color of bubble gum'],
    ['GOLD', 'Shiny yellow color of a trophy'],
    ['GRAY', 'Color of a rain cloud'],
    ['GREEN', 'Color of grass and leaves'],
    ['BROWN', 'Color of chocolate and dirt'],
    ['BLACK', 'Color of the night sky'],
    ['WHITE', 'Color of fresh snow'],
    ['PURPLE', 'Color you get mixing red and blue'],
    ['ORANGE', 'Color of a pumpkin'],
    ['YELLOW', 'Color of the sun and bananas'],
  ] },
  { cat: WP, tag: 'home', words: [
    ['BED', 'Where you sleep at night'],
    ['CUP', 'You drink from this'],
    ['POT', 'You cook soup in this'],
    ['RUG', 'Soft mat on the floor'],
    ['TOY', 'Something fun a kid plays with'],
    ['KEY', 'It opens a locked door'],
    ['MAT', 'Flat pad by the front door'],
    ['DOOR', 'You open it to go in a room'],
    ['LAMP', 'It gives light in a room'],
    ['SOAP', 'You wash your hands with it'],
    ['FORK', 'You eat with this pointy tool'],
    ['DISH', 'A plate you put food on'],
    ['BOWL', 'Round dish for cereal or soup'],
    ['SOCK', 'You wear this on your foot'],
    ['SHOE', 'You wear this to go outside'],
    ['HAT', 'You wear this on your head'],
    ['CLOCK', 'It tells you what time it is'],
    ['CHAIR', 'You sit on this'],
    ['TABLE', 'You eat your dinner on this'],
    ['SPOON', 'You eat soup with this'],
    ['BROOM', 'You sweep the floor with this'],
    ['PLATE', 'Flat dish for your dinner'],
    ['TOWEL', 'You dry off with this'],
    ['PILLOW', 'Soft thing you rest your head on'],
    ['WINDOW', 'Glass you look out of'],
  ] },
  { cat: WP, tag: 'family', words: [
    ['MOM', 'Your female parent'],
    ['DAD', 'Your male parent'],
    ['BABY', 'A very little child'],
    ['KID', 'A young boy or girl'],
    ['PAL', 'Another word for a friend'],
    ['AUNT', 'Your mom or dad’s sister'],
    ['SISTER', 'A girl in your family'],
    ['FAMILY', 'The people you live with and love'],
    ['FRIEND', 'Someone you like to play with'],
  ] },
  { cat: SL, tag: 'toys', words: [
    ['KITE', 'Toy that flies on a string in the wind'],
    ['DRUM', 'You bang on this to make a beat'],
    ['BLOCK', 'Toy cube you stack up'],
    ['DOLL', 'Toy that looks like a little person'],
    ['SLED', 'You ride this down a snowy hill'],
    ['SWING', 'Playground seat that goes back and forth'],
    ['SLIDE', 'Playground toy you zoom down'],
    ['ROBOT', 'A toy machine that looks like a person'],
    ['PUZZLE', 'Pieces you fit together to make a picture'],
    ['TEDDY', 'A soft stuffed bear'],
    ['BUBBLE', 'Round soapy ball of air you blow'],
    ['WAGON', 'Little cart you pull along'],
  ] },
  { cat: GEO, tag: 'travel', words: [
    ['BUS', 'Big vehicle that takes kids to school'],
    ['CAR', 'You drive it on the road'],
    ['VAN', 'Bigger than a car, carries more people'],
    ['JET', 'A fast airplane'],
    ['BOAT', 'It floats you across the water'],
    ['SHIP', 'A big boat that sails the sea'],
    ['TRAIN', 'Long vehicle that rides on tracks'],
    ['TRUCK', 'Big vehicle that hauls things'],
    ['PLANE', 'It flies you through the sky'],
    ['ROAD', 'Where cars drive'],
  ] },
  { cat: EN, tag: 'fun', words: [
    ['FUN', 'What a good time is full of'],
    ['SING', 'Make music with your voice'],
    ['HUG', 'A warm squeeze from someone'],
    ['NAP', 'A short daytime sleep'],
    ['JUMP', 'Push off the ground with both feet'],
    ['CLAP', 'Bang your hands together happily'],
    ['DANCE', 'Move your body to music'],
    ['LAUGH', 'What you do at something funny'],
    ['PARTY', 'A fun get-together with cake'],
    ['MAGIC', 'Tricks that seem impossible'],
    ['CROWN', 'A king or queen wears it'],
    ['QUEEN', 'A king’s royal wife who rules'],
  ] },
];

// Existing kids answers — never duplicate them.
const existing = new Set();
for (const f of readdirSync(KIDS_DIR)) {
  if (!f.endsWith('.json') || f === 'kids-core.json') continue;
  for (const e of JSON.parse(readFileSync(join(KIDS_DIR, f), 'utf8'))) existing.add(e.answer);
}

const seen = new Set();
const out = [];
let skipped = 0;
for (const g of GROUPS) {
  for (const [answer, clue] of g.words) {
    if (!/^[A-Z]{3,}$/.test(answer)) throw new Error(`bad answer ${answer}`);
    if (existing.has(answer) || seen.has(answer)) { skipped++; continue; }
    // Leak guard: no clue word may equal the answer or share its stem (mirrors
    // the wordbank validator's word-level check, not a raw substring test).
    const stem = (w) => w.replace(/(ES|S|ED|ING)$/, '');
    const target = stem(answer);
    for (const w of clue.toUpperCase().replace(/[^A-Z]/g, ' ').split(/\s+/).filter(Boolean)) {
      if (w.length >= 3 && stem(w) === target) {
        throw new Error(`clue leaks answer: ${answer} — ${clue}`);
      }
    }
    seen.add(answer);
    // Common concrete words score high; length has no bearing on kid-friendliness.
    out.push({
      answer,
      score: 90,
      categories: [g.cat],
      tags: [g.tag, 'kidcore'],
      clues: [{ text: clue, difficulty: 1, stars: 3 }],
    });
  }
}

out.sort((a, b) => a.answer.length - b.answer.length || a.answer.localeCompare(b.answer));
writeFileSync(join(KIDS_DIR, 'kids-core.json'), JSON.stringify(out, null, 1) + '\n');

const byLen = {};
for (const e of out) byLen[e.answer.length] = (byLen[e.answer.length] || 0) + 1;
console.log(`Wrote ${out.length} kid-safe words (skipped ${skipped} dupes) → src/data/kids/kids-core.json`);
console.log('by length:', JSON.stringify(byLen));
