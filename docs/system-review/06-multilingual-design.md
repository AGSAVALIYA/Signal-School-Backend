# 06 — Real Multi-Language Support: Design Spec

**Problem.** Today "multi-language" is the GTranslate widget (Google machine translation laid over the DOM). It:
- runs only on the teacher side, inside "My Info", and isn't on the login page or the admin side;
- is configured twice with different language lists (`public/index.html:13` en/hi/mr vs `GTranslateWraper.js:44` en/hi/mr/gu);
- translates **student names**, mixes terms, flickers, needs a page reload and cookie hacks (`MyInfo.js:87-101`), and depends on a third-party CDN;
- never translates server messages, dates, PDF exports or validation errors.

**Goal.** Every string a user sees is shown in their chosen language, written by people (reviewed by teachers), stays consistent, works offline, and never touches user-entered data.

**Languages for v1:** English (`en`), Hindi (`hi`), Marathi (`mr`), Gujarati (`gu`). Adding another language (e.g., Urdu, Kannada) is just a new folder of JSON files.

---

## 1. Architecture

```
FE (React)                                          BE (Express)
┌──────────────────────────────────────┐            ┌─────────────────────────────────┐
│ i18next + react-i18next              │  Accept-   │ errors → { error: { code,       │
│  ├─ locales/{en,hi,mr,gu}/*.json     │  Language  │   message(en), fields } }       │
│  ├─ lazy-load namespace per route    │ ─────────► │ users.preferred_language        │
│  ├─ language detector:               │            │ i18next (node) only for         │
│  │   user pref > localStorage >      │            │   server-made docs: PDF/Excel   │
│  │   school default > browser > en   │ ◄───────── │   headers, SMS/WhatsApp texts   │
│  ├─ dayjs locale + MUI localeText    │  codes     │ master data: name_translations  │
│  └─ Intl.NumberFormat                │            │   JSONB on grades/subjects      │
└──────────────────────────────────────┘            └─────────────────────────────────┘
```

### Libraries
- `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `i18next-http-backend` (or bundled JSON imports with Vite's dynamic import)
- `dayjs/locale/{hi,mr,gu}` (already have dayjs) + `@mui/x-date-pickers` `LocalizationProvider adapterLocale`
- MUI core locale: `@mui/material/locale` has `hiIN`; for `mr`/`gu` supply a custom `localeText` (pagination labels etc.)
- Dev tooling: `i18next-parser` (extract keys, report missing), `eslint-plugin-i18next` (`no-literal-string` in JSX), a pseudo-locale for layout testing

### Remove
`public/index.html` lines 13–14 (gtranslate settings + script), `src/GTranslateWraper.js`, its import in `TeacherMain.js`, the cookie code in `MyInfo.js:78-101`, the `.gtranslate_wrapper` / `.VIpgJd-*` CSS in `App.css`, and the `notranslate` workaround.

---

## 2. File layout and key naming

```
src/i18n/
  index.js                # init, detector order, fallbackLng: 'en', ns list
  languages.js            # [{code:'en', native:'English'}, {code:'hi', native:'हिंदी'}, {code:'mr', native:'मराठी'}, {code:'gu', native:'ગુજરાતી'}]
  locales/
    en/ common.json auth.json attendance.json students.json syllabus.json
        classes.json teachers.json academicYear.json dashboard.json reports.json errors.json
    hi/ …same files…
    mr/ …
    gu/ …
```

Key convention is `feature.screen.element`, e.g.:
```json
// en/attendance.json
{
  "take": {
    "title": "Attendance · {{className}}",
    "allPresent": "All present",
    "summary": "Present {{present}} · Absent {{absent}} · Leave {{leave}}",
    "save": "Save attendance",
    "saved": "Saved ✔ {{time}}",
    "offlineQueued": "No internet – saved on this phone. It will upload automatically.",
    "futureDateBlocked": "You can't take attendance for a future date."
  },
  "status": { "P": "Present", "A": "Absent", "L": "Leave", "H": "Holiday" },
  "statusShort": { "P": "P", "A": "A", "L": "L", "H": "H" }
}
```
```json
// mr/attendance.json
{
  "take": {
    "title": "हजेरी · {{className}}",
    "allPresent": "सर्व हजर",
    "summary": "हजर {{present}} · गैरहजर {{absent}} · रजा {{leave}}",
    "save": "हजेरी जतन करा",
    "saved": "जतन झाले ✔ {{time}}",
    "offlineQueued": "इंटरनेट नाही – हजेरी फोनवर जतन केली आहे. इंटरनेट आल्यावर आपोआप पाठवली जाईल.",
    "futureDateBlocked": "पुढील तारखेची हजेरी घेता येत नाही."
  },
  "status": { "P": "हजर", "A": "गैरहजर", "L": "रजा", "H": "सुट्टी" },
  "statusShort": { "P": "ह", "A": "गै", "L": "र", "H": "सु" }
}
```
Plurals use i18next `_one/_other` keys (Hindi/Marathi/Gujarati plural rules are supported by `Intl.PluralRules`).

### Usage in components
```jsx
const { t } = useTranslation('attendance');
<Button>{t('take.save')}</Button>
<Typography>{t('take.summary', { present, absent, leave })}</Typography>
```

---

## 3. Choosing and remembering the language

| Where | Behaviour |
|---|---|
| **Login screen** (logged out) | A row of 4 big buttons in native script at the top. The choice is stored in `localStorage.lng`. |
| **After login** | If `user.preferredLanguage` is set, use it (it overrides localStorage). Otherwise save the current choice to the profile (`PATCH /api/v1/me {preferredLanguage}`). |
| **Teacher "Me" and admin header** | Language menu. Changing it applies instantly (no reload) and saves to the profile. |
| **School default** | `schools.default_language`, used for new users and for parent SMS. |
| Detection order | user profile → localStorage → school default → `navigator.language` → `en`. |
| `<html lang>` | Updated on change (helps screen readers and correct font shaping). |

---

## 4. Server messages, validation, documents

1. **Errors as codes.** Every API error returns
   ```json
   { "error": { "code": "STUDENT_GR_DUPLICATE", "message": "GR number already exists", "params": { "gr": "1234", "name": "Ravi" }, "fields": { "grNumber": "DUPLICATE" } } }
   ```
   The frontend shows `t('errors:STUDENT_GR_DUPLICATE', params)` and field errors with `t('errors:field.DUPLICATE')`. The English `message` is only a fallback and for logs.
   An error code catalogue lives in `BE src/utils/errorCodes.js` and is mirrored in `FE locales/*/errors.json`. CI checks that the two match.
2. **Validation** (zod schemas on the frontend) uses an i18n error map, so "Required", "Must be 10 digits" and so on are translated.
3. **Documents made on the server** (attendance register PDF, report cards, Excel headers) receive `?lang=mr` (default: the requester's language). The server uses `i18next` with a small `server-locales/` set and **embeds Noto fonts** (Noto Sans, Noto Sans Devanagari, Noto Sans Gujarati) in the PDF (pdfmake/pdfkit with custom fonts, or headless Chrome rendering an HTML template). Client-side jsPDF can't shape Devanagari conjuncts reliably, so move PDF generation to the server.
4. **Excel/CSV exports** are written as `.xlsx` (exceljs), or CSV with a UTF-8 BOM, so Excel opens Devanagari/Gujarati correctly.
5. **SMS/WhatsApp to parents** (future) use templates per language. Choose the language per guardian (`guardians.language`).

---

## 5. Content that is *not* UI text

| Content | Rule |
|---|---|
| Student/teacher/guardian **names**, addresses, notes, syllabus text typed by users | **Never translated.** Shown exactly as entered. Inputs accept any script. Search is Unicode-aware. |
| **Class / grade / subject names** (master data) | Base `name` + optional `name_translations JSONB` (`{"mr":"इयत्ता ५","hi":"कक्षा ५"}`). The UI shows the translation for the current language, falling back to the base name. Admin edits translations in the Classes & Subjects page (optional fields). |
| **Fixed lists** (gender, blood group, report term, leave reason, status) | Stored as codes (`F`, `M`, `O`; `S1`, `S2`, `ANNUAL`), shown via `t('enums.gender.F')`. |
| **Dates** | Stored ISO. Shown with `dayjs(date).locale(lng).format('DD MMM YYYY')` → "02 ऑक्टो 2026". Date pickers use the same locale, with `format="DD/MM/YYYY"`. |
| **Numbers** | `Intl.NumberFormat(lng)`. Western digits by default; an optional school setting shows native digits (०१२३ / ૦૧૨૩). |
| **Percentages / counts** | Through `t()` with interpolation, never string concatenation. |

---

## 6. Typography and layout

- Load **Noto Sans + Noto Sans Devanagari + Noto Sans Gujarati** (Google Fonts, `font-display: swap`). Set them in the MUI theme `fontFamily` in that order so mixed-script text renders consistently.
- Devanagari needs about 10–15% more line height and gets cut by tight `height` values. Avoid fixed heights on chips/buttons and use `minHeight`.
- Marathi/Hindi strings are often 20–40% longer than English. Buttons must wrap or grow, and no layout may rely on a fixed `width` for text.
- Test with the **pseudo-locale** (`?lng=pseudo`, which pads each string by about 40% with accented characters) to catch truncation and hard-coded strings.

---

## 7. Starter glossary (draft — must be checked by native-speaker teachers in the test round)

Consistency matters more than perfection. One term per concept, everywhere.

| Concept (key) | English | हिंदी (hi) | मराठी (mr) | ગુજરાતી (gu) |
|---|---|---|---|---|
| attendance | Attendance | उपस्थिति | हजेरी | હાજરી |
| take_attendance | Take attendance | उपस्थिति लें | हजेरी घ्या | હાજરી લો |
| present | Present | उपस्थित | हजर | હાજર |
| absent | Absent | अनुपस्थित | गैरहजर | ગેરહાજર |
| leave | Leave | छुट्टी | रजा | રજા |
| late | Late | देर से | उशिरा | મોડું |
| holiday | Holiday | अवकाश | सुट्टी | રજાનો દિવસ |
| not_marked | Not marked | दर्ज नहीं | नोंद नाही | નોંધ નથી |
| student | Student | विद्यार्थी | विद्यार्थी | વિદ્યાર્થી |
| teacher | Teacher | शिक्षक | शिक्षक | શિક્ષક |
| guardian | Guardian / parent | अभिभावक | पालक | વાલી |
| grade (class/standard) | Class | कक्षा | इयत्ता | ધોરણ |
| section | Division | वर्ग | तुकडी | વર્ગ |
| subject | Subject | विषय | विषय | વિષય |
| syllabus | Syllabus | पाठ्यक्रम | अभ्यासक्रम | અભ્યાસક્રમ |
| chapter | Chapter | अध्याय | प्रकरण | પ્રકરણ |
| topic | Topic | पाठ बिंदु | घटक | મુદ્દો |
| academic_year | Academic year | शैक्षणिक वर्ष | शैक्षणिक वर्ष | શૈક્ષણિક વર્ષ |
| promote | Move to next class | अगली कक्षा में भेजें | पुढील इयत्तेत पाठवा | આગળના ધોરણમાં મોકલો |
| detain | Keep in same class | उसी कक्षा में रखें | त्याच इयत्तेत ठेवा | એ જ ધોરણમાં રાખો |
| left_school | Left school | विद्यालय छोड़ दिया | शाळा सोडली | શાળા છોડી |
| gr_number | Register number (GR) | रजिस्टर क्रमांक (GR) | जनरल रजिस्टर क्रमांक | જનરલ રજિસ્ટર નંબર |
| dob | Date of birth | जन्म तिथि | जन्मतारीख | જન્મ તારીખ |
| approx_age | Approximate age | अनुमानित आयु | अंदाजे वय | અંદાજિત ઉંમર |
| mobile | Mobile number | मोबाइल नंबर | मोबाईल नंबर | મોબાઇલ નંબર |
| daily_diary | Daily diary | दैनिक डायरी | दैनंदिनी | દૈનિક નોંધ |
| report_card | Report card | प्रगति पत्रक | प्रगतिपुस्तक | પ્રગતિ પત્રક |
| save | Save | सहेजें | जतन करा | સાચવો |
| saved | Saved | सहेजा गया | जतन झाले | સાચવ્યું |
| cancel | Cancel | रद्द करें | रद्द करा | રદ કરો |
| edit | Edit | बदलें | बदला | ફેરફાર કરો |
| delete | Delete | हटाएँ | हटवा | કાઢી નાખો |
| search | Search | खोजें | शोधा | શોધો |
| login | Log in | लॉग इन करें | लॉग इन करा | લૉગ ઇન કરો |
| logout | Log out | लॉग आउट | लॉग आउट | લૉગ આઉટ |
| no_internet | No internet | इंटरनेट नहीं है | इंटरनेट नाही | ઇન્ટરનેટ નથી |
| try_again | Try again | फिर से कोशिश करें | पुन्हा प्रयत्न करा | ફરી પ્રયાસ કરો |
| mark_done | Mark as taught | पढ़ाया गया | शिकवले | ભણાવ્યું |
| mark_not_done | Mark as not taught | नहीं पढ़ाया | शिकवले नाही | ભણાવ્યું નથી |

Plain-word replacements, applied in English too: "A.Y." → "Academic year", "Common subject" → "Activities", "Bulk" → "Whole class", "Timeline" → "Daily diary", "Avatar" → "Photo", "Form" → (drop the word).

---

## 8. Translation workflow

1. A developer adds or changes keys in `en/*.json` only.
2. `npm run i18n:extract` (i18next-parser) updates the key lists. CI fails if any `t()` key is missing in `en`, and **warns** if `hi/mr/gu` are missing keys (they fall back to English at runtime).
3. Translations are done by a teacher reviewer per language. Options: a Google Sheet export/import script (simplest), or Weblate/Tolgee for in-context editing later.
4. **Screenshot review.** The Playwright suite captures key screens in all 4 languages (`npm run e2e:screens`) for the reviewer to sign off.
5. Release rule: P1 screens (login, today, attendance, student add/edit, syllabus tick) must be 100% translated in all 4 languages.

---

## 9. Acceptance criteria (tests TC-LANG-*, TC-I18N-*)

- [ ] No GTranslate code or requests remain (`grep -ri gtranslate` is empty, and no network calls to `cdn.gtranslate.net`).
- [ ] ESLint `i18next/no-literal-string` passes on `src/` (allow-list for symbols and test files).
- [ ] Language picker is on the login page and in the admin header / teacher Me. Switching takes effect without a reload and persists across devices.
- [ ] All server errors are shown translated (spot check 20 codes per language).
- [ ] Student names are identical in all languages.
- [ ] Dates and month names are localized; date pickers use DD/MM/YYYY.
- [ ] The attendance register PDF and Excel render Marathi/Hindi/Gujarati correctly.
- [ ] No text truncation in the pseudo-locale at 360 px width on P1 screens.
- [ ] A native-speaker teacher signs off the glossary and P1 screens per language.
