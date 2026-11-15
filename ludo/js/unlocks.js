// The kill collection: every kill a character makes on this phone unlocks the next
// item here — 100 famous films (3 Indian for every 2 Hollywood) with a dish after
// every few. Add or reorder freely; counts are stored per character in localStorage.

const INDIAN = [
  'Sholay', 'Dilwale Dulhania Le Jayenge', '3 Idiots', 'Hera Pheri', 'Andaz Apna Apna', 'Gangs of Wasseypur',
  'Lagaan', 'Dangal', 'Munna Bhai M.B.B.S.', 'Mughal-e-Azam', 'Mother India', 'Deewaar',
  'Dil Chahta Hai', 'Zindagi Na Milegi Dobara', 'Kabhi Khushi Kabhie Gham', 'Kuch Kuch Hota Hai', 'Hum Aapke Hain Koun..!', 'Maine Pyar Kiya',
  'Baazigar', 'Darr', 'Don', 'Agneepath', 'Satya', 'Rang De Basanti',
  'Swades', 'Taare Zameen Par', 'PK', 'Chak De! India', 'Queen', 'Barfi!',
  'Gully Boy', 'Drishyam', 'Bajrangi Bhaijaan', 'Sultan', 'Jawan', 'Pathaan',
  'Baahubali', 'RRR', 'K.G.F', 'Pushpa', 'Kantara', 'Vikram',
  'Sairat', 'Tumbbad', 'Andhadhun', 'Stree', 'Bhool Bhulaiyaa', 'Golmaal',
  'Welcome', 'Phir Hera Pheri', 'Dabangg', 'Om Shanti Om', 'Jab We Met', 'Rockstar',
  'Kal Ho Naa Ho', 'Devdas', 'Anand', 'Mr. India', 'Dil Se..', '12th Fail',
];
const HOLLYWOOD = [
  'The Godfather', 'Titanic', 'Avengers: Endgame', 'The Dark Knight', 'Inception', 'Interstellar',
  'Jurassic Park', 'Star Wars', 'The Lion King', 'Toy Story', 'Finding Nemo', 'Harry Potter',
  'The Lord of the Rings', 'The Matrix', 'Forrest Gump', 'Pulp Fiction', 'The Shawshank Redemption', 'Fight Club',
  'Gladiator', 'Terminator 2', 'Back to the Future', 'Home Alone', 'Jumanji', 'The Mask',
  'Rush Hour', 'Kung Fu Panda', 'Spider-Man', 'Iron Man', 'Black Panther', 'Frozen',
  'Shrek', 'Pirates of the Caribbean', 'Mission: Impossible', 'John Wick', 'Fast & Furious', 'Oppenheimer',
  'Joker', 'The Avengers', 'Deadpool', 'Avatar',
];
export const FOODS = [
  ['🍛', 'Poha Jalebi'], ['🥟', 'Samosa'], ['🍔', 'Vada Pav'], ['🫓', 'Pav Bhaji'], ['🫧', 'Pani Puri'], ['🌽', 'Bhutte ka Kees'],
  ['🍠', 'Garadu'], ['🥘', 'Dal Bafla'], ['🍲', 'Sabudana Khichdi'], ['🍗', 'Butter Chicken'], ['🥣', 'Dal Makhani'], ['🫓', 'Chole Bhature'],
  ['🍚', 'Rajma Chawal'], ['🫓', 'Aloo Paratha'], ['🍚', 'Hyderabadi Biryani'], ['🥩', 'Galouti Kebab'], ['🍖', 'Rogan Josh'], ['🥟', 'Momos'],
  ['🍜', 'Thukpa'], ['🫓', 'Masala Dosa'], ['🍥', 'Idli Sambar'], ['🍩', 'Medu Vada'], ['🥞', 'Appam Stew'], ['🧈', 'Dhokla'],
  ['🫓', 'Thepla'], ['🥗', 'Undhiyu'], ['🍘', 'Litti Chokha'], ['⚪', 'Rasgulla'], ['🍮', 'Mishti Doi'], ['🍮', 'Gulab Jamun'],
  ['🥨', 'Jalebi'], ['🥛', 'Rabri'], ['🍦', 'Kulfi'], ['🥕', 'Gajar ka Halwa'], ['🍥', 'Ras Malai'], ['☕', 'Masala Chai'],
  ['☕', 'Filter Coffee'], ['🥤', 'Lassi'], ['🥟', 'Kachori'], ['🥙', 'Delhi Chaat'], ['🥣', 'Misal Pav'], ['🥞', 'Puran Poli'],
  ['🍨', 'Shrikhand'], ['🍛', 'Sev Tamatar'], ['🥣', 'Kadhi Chawal'], ['🧀', 'Paneer Tikka'], ['🍗', 'Tandoori Chicken'], ['🐟', 'Goan Fish Curry'],
  ['🌶️', 'Vindaloo'], ['🍢', 'Seekh Kebab'], ['🍕', 'Pizza'], ['🍔', 'Burger'], ['🍣', 'Sushi'], ['🌮', 'Tacos'],
  ['🍜', 'Ramen'], ['🍝', 'Pasta'], ['🥟', 'Dim Sum'], ['🥬', 'Kimchi'], ['🥐', 'Croissant'], ['🍫', 'Chocolate Cake'],
];

// 3 Indian, 2 Hollywood, repeat.
export const MOVIES = (() => {
  const out = [];
  for (let i = 0, h = 0; i < INDIAN.length || h < HOLLYWOOD.length;) {
    for (let k = 0; k < 3 && i < INDIAN.length; k++) out.push(INDIAN[i++]);
    for (let k = 0; k < 2 && h < HOLLYWOOD.length; k++) out.push(HOLLYWOOD[h++]);
  }
  return out;
})();

// The unlock order: 5 films, then 3 dishes, repeat. Each entry is [icon, name].
export const UNLOCKS = (() => {
  const out = [];
  for (let m = 0, f = 0; m < MOVIES.length || f < FOODS.length;) {
    for (let k = 0; k < 5 && m < MOVIES.length; k++) out.push(['🎬', MOVIES[m++]]);
    for (let k = 0; k < 3 && f < FOODS.length; k++) out.push(FOODS[f++]);
  }
  return out;
})();
