const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Calendar date (YYYY-MM-DD) "today" in the school's timezone, independent of server TZ.
const todayIn = (timeZone = 'Asia/Kolkata', now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
};

const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

module.exports = { ISO, todayIn, addDays, daysInMonth, weekday };
