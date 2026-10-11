// Text for the demo school: names, subjects with their chapters, notes and holidays. Fictional people only.
// Children at Signal Shala come from families living at traffic signals and migrant settlements around Thane
// (Maharashtra, Karnataka, Rajasthan, Gujarat, Uttar Pradesh), so names mix scripts and regions.

const GIRLS = [
  'Aarti',
  'Bhagyashree',
  'Chandni',
  'Durga',
  'Gauri',
  'Geeta',
  'Jyoti',
  'Kajal',
  'Kavya',
  'Lakshmi',
  'Mansi',
  'Meena',
  'Neha',
  'Pallavi',
  'Pooja',
  'Priya',
  'Radha',
  'Rani',
  'Rekha',
  'Sakshi',
  'Sangeeta',
  'Shruti',
  'Sneha',
  'Tanvi',
  'Yamuna',
  'Zoya',
  'Anjali',
  'Diya',
  'Esha',
  'Isha',
];
const BOYS = [
  'Aarav',
  'Akash',
  'Arjun',
  'Ganesh',
  'Harsh',
  'Imran',
  'Jay',
  'Karan',
  'Kishor',
  'Mahesh',
  'Manoj',
  'Mohan',
  'Om',
  'Prakash',
  'Rahul',
  'Raju',
  'Ravi',
  'Sagar',
  'Sahil',
  'Sameer',
  'Sanjay',
  'Suresh',
  'Umesh',
  'Vijay',
  'Vishal',
  'Yash',
  'Farhan',
  'Dev',
  'Chetan',
  'Tushar',
];
const SURNAMES = [
  'Pawar',
  'Shinde',
  'More',
  'Jadhav',
  'Patil',
  'Kamble',
  'Gaikwad',
  'Sawant',
  'Waghmare',
  'Chavan',
  'Bhosale',
  'Salunkhe',
  'Rathod',
  'Lamani',
  'Pardhi',
  'Shaikh',
  'Ansari',
  'Yadav',
  'Solanki',
  'Vasava',
  'Naik',
  'Banjara',
];
// Names as families write them in their own script (shown as typed in the office).
const NATIVE = {
  mr: ['सुनील पवार', 'आरती शिंदे', 'गणेश जाधव', 'पूजा कांबळे', 'रोहित गायकवाड', 'साक्षी मोरे', 'ओंकार चव्हाण'],
  hi: ['रवि कुमार', 'प्रिया यादव', 'अमन वर्मा', 'नेहा सिंह'],
  gu: ['ગીતા પટેલ', 'રાહુલ સોલંકી', 'હેતલ વસાવા'],
};
const RELATION = {
  mr: ['आई', 'वडील', 'आजी', 'मामा'],
  hi: ['माँ', 'पिता', 'दादी', 'चाचा'],
  gu: ['માતા', 'પિતા', 'દાદી', 'કાકા'],
  en: ['Mother', 'Father', 'Grandmother', 'Uncle'],
};
const AREAS = ['Teen Hath Naka signal', 'Kopri settlement', 'Wagle Estate', 'Kisan Nagar', 'Gokhale Road', 'Majiwada', 'Kalwa naka'];

// Subjects by class level, each with chapters and the topics teachers tick off.
const SUBJECTS = {
  balwadi: {
    'Language play': [
      ['Rhymes and stories', ['Action songs', 'Picture story: the crow and the pot', 'My family story', 'Retell a story']],
      ['Sounds and letters', ['Sound of अ, आ, इ', 'Letters with sand tray', 'Picture–letter matching', 'My name card']],
      ['Talking time', ['My body', 'Fruits and vegetables', 'Vehicles on the road', 'Traffic signal colours']],
    ],
    'Numbers and shapes': [
      ['Counting', ['Count 1–10 with stones', 'Number songs', 'More and less', 'Count 11–20']],
      ['Shapes and colours', ['Circle, square, triangle', 'Colour sorting', 'Big and small', 'Patterns with beads']],
    ],
    'Art and play': [
      ['Art', ['Finger painting', 'Clay animals', 'Paper tearing collage', 'Leaf printing']],
      ['Movement', ['Ball games', 'Balance walk', 'Dance to music', 'Yoga for kids']],
    ],
  },
  primary: {
    Marathi: [
      ['अक्षर ओळख', ['स्वर', 'व्यंजन', 'बाराखडी', 'जोडाक्षरे']],
      ['वाचन', ['छोटी वाक्ये वाचणे', 'गोष्ट वाचणे', 'कविता: पाऊस', 'प्रश्नोत्तरे']],
      ['लेखन', ['शुद्धलेखन', 'चित्रवर्णन', 'माझी शाळा निबंध', 'पत्रलेखन']],
      ['व्याकरण', ['नाम', 'सर्वनाम', 'क्रियापद', 'विरुद्धार्थी शब्द']],
    ],
    English: [
      ['Alphabet and sounds', ['Capital letters', 'Small letters', 'Phonics: short vowels', 'Three-letter words']],
      ['Speaking', ['Greetings', 'Introduce yourself', 'Classroom words', 'Days of the week']],
      ['Reading', ['Picture words', 'Simple sentences', 'Story: The thirsty crow', 'Questions and answers']],
      ['Writing', ['Copy writing', 'Fill in the blanks', 'My family', 'Five sentences about my school']],
    ],
    Maths: [
      ['Numbers', ['Numbers up to 100', 'Place value', 'Number names', 'Before, after, between']],
      ['Addition and subtraction', ['Adding with objects', 'Adding two-digit numbers', 'Taking away', 'Word problems']],
      ['Money and time', ['Coins and notes', 'Shopping game', 'Reading the clock', 'Calendar']],
      ['Shapes and measures', ['Shapes around us', 'Long and short', 'Heavy and light', 'Patterns']],
    ],
    'Our surroundings (EVS)': [
      ['My body and health', ['Parts of the body', 'Clean hands', 'Healthy food', 'Clean water']],
      ['Plants and animals', ['Plants around us', 'Animals and their homes', 'Birds', 'Caring for animals']],
      ['Our neighbourhood', ['Road safety and signals', 'Helpers in the community', 'Our market', 'Festivals we celebrate']],
    ],
    'Art and play': [
      ['Art', ['Drawing with crayons', 'Rangoli patterns', 'Paper craft', 'Warli painting']],
      ['Sports', ['Kabaddi', 'Kho-kho', 'Running races', 'Team games']],
    ],
  },
  upper: {
    Marathi: [
      ['गद्य', ['पाठ १: श्रमाचे महत्त्व', 'पाठ २: आमचा गाव', 'पाठ ३: थोर समाजसुधारक', 'पाठ ४: पर्यावरण']],
      ['पद्य', ['कविता: आई', 'कविता: झाड', 'कविता: शाळा', 'पाठांतर']],
      ['व्याकरण व लेखन', ['वाक्प्रचार', 'समानार्थी शब्द', 'निबंध', 'पत्रलेखन']],
    ],
    Hindi: [
      ['पाठ', ['मेरा देश', 'ईमानदार लकड़हारा', 'पेड़ की आत्मकथा', 'स्वच्छता']],
      ['व्याकरण', ['संज्ञा', 'सर्वनाम', 'विशेषण', 'काल']],
    ],
    English: [
      ['Prose', ['The kind shopkeeper', 'A visit to the zoo', 'The brave girl', 'Our helpers']],
      ['Poems', ['Twinkle twinkle (recitation)', 'The rainbow', 'My kite', 'Learning by heart']],
      ['Grammar', ['Nouns and pronouns', 'Verbs and tenses', 'Adjectives', 'Punctuation']],
      ['Writing', ['Paragraph writing', 'Letter to a friend', 'Picture description', 'Story writing']],
    ],
    Maths: [
      ['Number work', ['Large numbers', 'Multiplication tables', 'Division', 'Factors and multiples']],
      ['Fractions and decimals', ['Half and quarter', 'Equivalent fractions', 'Decimals', 'Money problems']],
      ['Geometry', ['Lines and angles', 'Triangles', 'Perimeter', 'Area']],
      ['Data', ['Tally marks', 'Bar graphs', 'Reading tables', 'Simple averages']],
    ],
    Science: [
      ['Living world', ['Plants make food', 'Animals and habitats', 'Food chains', 'Our body systems']],
      ['Materials', ['Solids, liquids and gases', 'Water cycle', 'Clean water at home', 'Waste and recycling']],
      ['Energy and forces', ['Light and shadows', 'Simple machines', 'Electricity safety', 'Magnets']],
    ],
    'Social studies': [
      ['Our state and country', ['Maharashtra map', 'Rivers and mountains', 'States of India', 'Our Constitution']],
      ['History', ['Shivaji Maharaj', 'Freedom struggle', 'Savitribai Phule', 'Dr. Ambedkar']],
      ['Community', ['Local government', 'Rights of children', 'Road safety', 'Saving money in a bank']],
    ],
  },
};
const subjectsFor = (gradeIndex) => (gradeIndex === 0 ? SUBJECTS.balwadi : gradeIndex <= 4 ? SUBJECTS.primary : SUBJECTS.upper);

const CHILD_NOTES = [
  'Read a full page in Marathi without help today.',
  'Came without breakfast; was given the morning meal first.',
  'Helped younger children in the class with counting.',
  'Mother came to school; family may move to Pune after Diwali.',
  'Very good drawing of the traffic signal. Put it on the wall.',
  'Wrote her name in English for the first time.',
  'Was absent for 3 days: was selling flowers at the signal with his father. Spoke to the father.',
  'Learnt the 5 times table. Needs practice with 7.',
  'Took part in the dance practice for Annual Day.',
  'Cough and cold; sent home early with sister.',
  'Brought his younger brother to school; brother sat in Balwadi.',
  'Opened a bank account with the help of the office.',
];
const CLASS_NOTES = [
  'Practised numbers 1–50 with stones and bottle caps.',
  'Road safety talk with the traffic police volunteer.',
  'Story telling: The thirsty crow. Children acted it out.',
  'Health check-up camp by the PHC doctor.',
  'Planted tulsi and marigold in the school garden.',
  'Library hour: every child took a picture book home.',
  'Cleanliness drive around the school container.',
  'Computer class: children typed their names.',
  'Kabaddi match with Std 5.',
  'Drawing competition: My dream house.',
];
const HEALTH_NOTES = [
  'Low weight for age: extra meal and check again next month.',
  'Eyes: cannot read the board clearly. Refer for eye test.',
  'Tooth pain: refer to dental camp.',
  'Skin infection on the arm: refer to PHC.',
];

// School holidays (approximate dates) for an academic year starting in June of `y`.
const holidaysFor = (y) => [
  [`${y}-08-15`, 'Independence Day', 'holiday'],
  [`${y}-08-27`, 'Ganesh Chaturthi', 'holiday'],
  [`${y}-10-02`, 'Gandhi Jayanti', 'holiday'],
  [`${y}-10-14`, 'First term exams', 'exam'],
  ...[0, 1, 2, 3, 4].map((d) => [`${y}-11-0${d + 3}`, 'Diwali vacation', 'holiday']),
  [`${y}-12-25`, 'Christmas', 'holiday'],
  [`${y + 1}-01-26`, 'Republic Day', 'holiday'],
  [`${y + 1}-02-19`, 'Shivaji Maharaj Jayanti', 'holiday'],
  [`${y + 1}-02-27`, 'Annual Day', 'event'],
  [`${y + 1}-03-14`, 'Holi', 'holiday'],
  [`${y + 1}-04-14`, 'Ambedkar Jayanti', 'holiday'],
  [`${y + 1}-04-20`, 'Final exams', 'exam'],
];

const ACTIVITIES = [
  ['Dance', { mr: 'नृत्य', hi: 'नृत्य', gu: 'નૃત્ય' }],
  ['Football', { mr: 'फुटबॉल', hi: 'फुटबॉल', gu: 'ફૂટબોલ' }],
  ['Drawing', { mr: 'चित्रकला', hi: 'चित्रकला', gu: 'ચિત્રકામ' }],
  ['Computer', { mr: 'संगणक', hi: 'कंप्यूटर', gu: 'કમ્પ્યુટર' }],
];

module.exports = { GIRLS, BOYS, SURNAMES, NATIVE, RELATION, AREAS, subjectsFor, CHILD_NOTES, CLASS_NOTES, HEALTH_NOTES, holidaysFor, ACTIVITIES };
