# Residential Status form — PID 170 (Fragrant / The Circle Living Prototype)

Starting point for retyping the scanned form as a real Google Doc, so that
`Code.gs` can actually fill it. Paste the block below into a new Google Doc,
tidy up the layout, then put the resulting doc ID into `PID_ONLY_TEMPLATES["170"]`.

**Check the Thai before using it.** It was transcribed by eye from a low-resolution
scan, so wording and spelling need a native read-through — especially the
condominium name and the age-bracket labels.

Two rules for the retype:

1. Type everything as **ordinary body text** (or in a table). Do not use
   Insert → Text box or Insert → Drawing — text inside a drawing is invisible to
   `replaceText()`, which is exactly why the scanned version can't be filled.
2. Keep the tags spelled exactly as below, braces included. Anything not in the
   table at the bottom stays a blank line for hand-completion.

---

CONFIDENTIAL INFORMATION

Date/วัน ______ Month/เดือน ______ Year/ปี ______

Subject: Information of Residential Status / ข้อมูลสถานะผู้พักอาศัย

Dear: Co-Owners and Residents of The Circle Living Prototype Condominium /
เจ้าของห้องและผู้พักอาศัยของเซอร์เคิล ลีฟวิ่ง โปรโตไทป์ คอนโดมิเนียม

I (Mr./นาย, Mrs./นาง, Miss/นางสาว)
Name/ชื่อ {NAME}   Surname/นามสกุล {SURNAME}   Nickname/ชื่อเล่น ____________

ID / Passport No. / เลขบัตรประชาชน–หนังสือเดินทาง {PASSPORT_ID}

House Registration number / ห้องพักหมายเลข ____________

Working Address / ที่อยู่ที่ทำงาน ______________________________________________

Address / ที่อยู่ปัจจุบัน {FULL_ADDRESS}

Contacting Address / ที่อยู่ที่ติดต่อได้:
☐ Workplace/สถานที่ทำงาน  ☐ Mailing Address/ที่อยู่ปัจจุบัน  ☐ Unit/ห้องชุด  ☐ Others/อื่นๆ
Please identify / โปรดระบุ ______________________________________________

Telephone number / โทรศัพท์บ้าน ____________
Workplace contact number / โทรศัพท์ที่ทำงาน ____________
Mobile number / โทรศัพท์มือถือ ____________

E-Mail {EMAIL}          ID Line ____________

Residential Status / สถานะผู้พักอาศัย:
☐ Unit co-owner / เจ้าของห้องชุด   ☐ Relative of co-owner / ญาติเจ้าของห้องชุด   ☐ Tenant / ผู้เช่า

Number of people / จำนวนผู้พักอาศัย {NUMBER_OF_GUESTS} Person/คน

| Category | Total | Age | Male/ชาย | Female/หญิง |
|---|---|---|---|---|
| Child / เด็ก | ____ | Below 15 yrs old | ____ | ____ |
| Youth / เยาวชน | ____ | 15 – 21 yrs old | ____ | ____ |
| Adult / ผู้ใหญ่ | ____ | 21 – 59 yrs old | ____ | ____ |
| Elderly / ผู้สูงอายุ | ____ | 60 yrs old and above | ____ | ____ |
| Special care / Disable / ผู้ป่วย–ผู้พิการ | ____ | — | ____ | ____ |

Name of Resident / ชื่อผู้พักอาศัย
1. ______________________________  Telephone number ____________
2. ______________________________  Telephone number ____________
3. ______________________________  Telephone number ____________
4. ______________________________  Telephone number ____________

Vehicle Plate number / หมายเลขทะเบียนรถ
☐ Number of Car / จำนวนรถยนต์ ____
   Plate number of 1st car / ทะเบียนรถคันที่ 1 ____________
   Plate number of 2nd car / ทะเบียนรถคันที่ 2 ____________
☐ Number of Motorcycle / จำนวนรถจักรยานยนต์ ____
   Plate number of 1st motorcycle ____________
   Plate number of 2nd motorcycle ____________

Access card number / หมายเลขบัตรเข้า–ออกอาคาร
1st card / ใบที่ 1 ____________   2nd card / ใบที่ 2 ____________
Car park access card number / หมายเลขบัตรจอดรถ
1st card / ใบที่ 1 ____________   2nd card / ใบที่ 2 ____________

Move in / วันที่ย้ายเข้า {CHECKIN_DATE}     Move out / วันที่ย้ายออก {CHECKOUT_DATE}

Sign {SIGNATURE}
      Co-Owner / Resident (เจ้าของร่วม / ผู้พักอาศัย)
      (            {GUEST_FULL_NAME}            )

Sign ____________________
      Building Manager (ผู้จัดการอาคาร)
      (                                        )

Remarks / หมายเหตุ:
Building Management would like to certify who the co-owner is and asks you to
submit this form to the Juristic Office. Where the mentioned data is incorrect,
Juristic reserves the right to review and update, providing for completed
residential status. For the safety and security of our community, please give
the Juristic team thorough information.

---

## Placeholders this doc can use

| Tag | Fills with |
|---|---|
| `{NAME}` | first word of the guest's full name |
| `{SURNAME}` | everything after the first word |
| `{GUEST_FULL_NAME}` | full name, ordinary font |
| `{SIGNATURE}` | full name in the handwriting font (Dancing Script) |
| `{PASSPORT_ID}` | passport / ID number |
| `{FULL_ADDRESS}` | unit address, looked up from Hospitable via the PID |
| `{EMAIL}` | guest email |
| `{NUMBER_OF_GUESTS}` | total number of guests |
| `{CHECKIN_DATE}` | check-in, `DD MM YYYY` |
| `{CHECKOUT_DATE}` | checkout, `DD MM YYYY` |
| `{PID}` | 3-digit property ID |

## Fields with no data source yet

The check-in form never asks for these, so they stay blank unless new inputs are
added to `api/app.py`:

- telephone / mobile / workplace phone, Line ID
- residential status (co-owner / relative / tenant)
- nickname, house registration number, working address
- age-and-gender breakdown (only a single guest total is collected)
- other residents' names and phones
- vehicle plates, access card numbers
- the Date / Month / Year boxes in the header — `{CHECKIN_DATE}` is one string,
  so it can't be split across three boxes without a code change

Phone number and residential status are the two most likely to be demanded by the
juristic office; both are small additions to the form if you want them filled.
