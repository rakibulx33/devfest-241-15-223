# User guide

For office staff — no technical knowledge needed. The app is available in **English and Bangla**: press
**English / বাংলা** at the top right at any time (your choice is remembered).

> বাংলায় নির্দেশিকা এই পাতার নিচে দেওয়া আছে — [বাংলা নির্দেশিকা](#বাংলা-নির্দেশিকা)।

## What the app does

You give it the tender's `requirements.json` and your PDF files. It tells you, for every required document,
whether it is **ready** or what is wrong, and then builds **one combined PDF** — cover page, documents in the
tender's order, and a page-numbered footer on every page — ready to submit. Your files never leave your computer.

## Quick start with the sample pack

1. Click **Load sample tender**, then **Load sample documents**.
2. Click **Suggest matches from file names**.
3. For *Trade License* choose `trade_license_2026.pdf` (the 2025 one is expired), for *Signed Declaration* choose
   `scan_0042.pdf`.
4. Enter the expiry dates the app asks for: `2027-06-30` (trade licence) and `2026-12-31` (bank solvency letter).
5. Press **Generate package PDF** — `T-2026-0417_Package.pdf` downloads.

## Step by step

### Step 1 — Tender requirements
Click **Open requirements.json** and pick the file you received with the tender. You see the tender ID, title,
procuring entity, bidder and the **submission deadline** (important: expiry dates are checked against it). If the
file is wrong, a list tells you exactly what to fix.

### Step 2 — Upload PDF files
Click **Choose PDF files** (you can select many at once) or **drag and drop** them. Each file shows its **name,
page count and size**.
- A file that is not a PDF, is damaged, or is password-protected is **rejected** with a red message; remove it
  with the bin icon.
- Files with **identical content** (even with different names) get a blue **Duplicate** tag.
- Limits: 30 files and 50 MB in total.

### Step 3 — Match files and check
Each row is one required document. In **File and expiry date** choose the matching file.
- A file can be used for **one** document only; files that are already used or are duplicates of a used file are
  greyed out in the list.
- If the document has an expiry date, a date field appears after you choose a file — type the date printed on the
  document.
- You can change or clear a choice at any time.
- **Suggest matches from file names** fills obvious matches for you (always check them). **Clear all matches**
  starts over.

Every row shows one **status** (icon + text + colour), updated immediately:

| Status | Meaning | Stops the package? |
|---|---|---|
| ✕ **Missing** | Required document, no file chosen | Yes |
| ⚠ **Expiry date needed** | File chosen but no expiry date entered | Yes |
| ⏱ **Expired** | Expiry date is before the submission deadline (the deadline day itself is OK) | Yes |
| – **Not provided** | Optional document with no file — it will be skipped | No |
| ✓ **OK** | File chosen and, if needed, a valid expiry date | No |

### Step 4 — Package options and generate
- **Add an index page after the cover** (on by default): a page listing where each document starts.
- **Seal or signature (optional):** upload a PNG image and choose where it goes — last page of each document,
  every document page, or specific package pages such as `3, 5-7` — bottom right or bottom left.
- Press **Generate package PDF** (in the *package panel* on the right, or the bar at the bottom on a phone).

### The package panel
The sheet shows your tender ID, the **number of pages** the package will have and a tag: **Ready** or
**N to fix**. Under it, one coloured segment per document (red hatched = missing/expired, amber = needs a
date, green = OK, dashed = not provided). Click a segment or a problem in the list to **jump straight to that
document**. While problems remain the button is greyed; pressing it anyway shakes the panel and takes you to
the first problem. After generating, a **Generated** stamp appears and the download link stays available.

**Export checklist (CSV)** saves a spreadsheet with: document, file name, pages, expiry date, status.

## What the final PDF contains

1. **Page 1 — cover** (English): tender ID, title, procuring entity, bidder, submission deadline, the date the
   package was made, and the list of included documents in order.
2. *(optional)* **Page 2 — index** with the start page of each document.
3. **Your documents** in the tender's order, **all pages** of each file; optional documents without a file are left out.
4. **Footer on every page**, including the cover: `T-2026-0417 | Page X of Y` (Y = total pages). It sits in a strip
   added under the page, so it never covers the document.

## Saving and starting over
Your work (tender, files, matches, dates) is **saved automatically in this browser** and restored if you reload
or reopen the page. **Start over** erases it. Nothing is ever uploaded to a server.

## Common messages

| Message | What to do |
|---|---|
| "Rejected: this is not a PDF file." | Upload the PDF version of the document |
| "Rejected: this PDF is password-protected." | Remove the password, upload again |
| "Rejected: this PDF is damaged…" | Get a fresh copy of the file |
| "Duplicate — Same content as …" | Use only one of the two files (the second cannot be matched to another document) |
| "Expires before the deadline (…)" | Upload a newer, valid document |
| "This requirements file cannot be used" + list | Fix the listed fields in `requirements.json` or ask the organizer |

---

# বাংলা নির্দেশিকা

অ্যাপটি **ইংরেজি ও বাংলা** দুই ভাষাতেই চলে — ওপরে ডানদিকের **English / বাংলা** বোতামে চাপ দিন (আপনার পছন্দ মনে রাখা হয়)।

## অ্যাপটি কী করে
টেন্ডারের `requirements.json` ফাইল ও আপনার PDF ফাইলগুলো দিন। অ্যাপ প্রতিটি প্রয়োজনীয় নথির জন্য জানাবে সেটি প্রস্তুত
কি না, আর কোনো সমস্যা থাকলে কী ঠিক করতে হবে। তারপর **একটি সম্পূর্ণ PDF** তৈরি করবে — কভার পৃষ্ঠা, টেন্ডারের ক্রমে নথি এবং
প্রতিটি পৃষ্ঠায় পৃষ্ঠা-নম্বরসহ ফুটার। আপনার ফাইল কখনোই আপনার কম্পিউটারের বাইরে যায় না।

## ধাপে ধাপে
1. **টেন্ডারের চাহিদা:** **requirements.json খুলুন** চেপে ফাইলটি বেছে নিন (অথবা পরীক্ষার জন্য **নমুনা টেন্ডার লোড করুন**)। জমার শেষ
   তারিখ দেখে নিন — মেয়াদ এই তারিখের সাথে মিলিয়ে যাচাই হয়।
2. **PDF ফাইল আপলোড:** **PDF ফাইল বেছে নিন** চাপুন বা ফাইল টেনে এনে ছাড়ুন (একসাথে অনেকগুলো)। প্রতিটি ফাইলের নাম ও পৃষ্ঠা সংখ্যা দেখা যাবে।
   PDF নয়, নষ্ট বা পাসওয়ার্ড-সুরক্ষিত ফাইল বাতিল হবে (বিন আইকন দিয়ে মুছুন)। একই বিষয়বস্তুর ফাইলে **ডুপ্লিকেট** চিহ্ন থাকবে।
3. **ফাইল মেলান ও যাচাই করুন:** প্রতিটি নথির সারিতে সঠিক ফাইলটি বেছে নিন। একটি ফাইল শুধু একটি নথির জন্য ব্যবহার করা যায়। নথির
   মেয়াদ থাকলে ফাইল বাছার পর তারিখের ঘর আসবে — নথিতে লেখা তারিখটি দিন। যেকোনো সময় পরিবর্তন বা মুছে ফেলা যায়।
   **ফাইলের নাম দেখে মিল প্রস্তাব করুন** বোতাম সহজ মিলগুলো নিজে বসিয়ে দেয় (যাচাই করে নিন)।
4. **প্যাকেজের সেটিং:** চাইলে কভারের পরে সূচিপত্র পৃষ্ঠা যোগ করুন, আর সিল/স্বাক্ষরের PNG ছবি দিন। শেষে **প্যাকেজ PDF তৈরি করুন** চাপুন।

## অবস্থা (স্ট্যাটাস)
| অবস্থা | মানে | প্যাকেজ আটকায়? |
|---|---|---|
| ✕ অনুপস্থিত | বাধ্যতামূলক নথির ফাইল নেই | হ্যাঁ |
| ⚠ মেয়াদের তারিখ প্রয়োজন | ফাইল আছে কিন্তু মেয়াদের তারিখ দেওয়া হয়নি | হ্যাঁ |
| ⏱ মেয়াদোত্তীর্ণ | মেয়াদ জমার শেষ তারিখের আগে শেষ (শেষ তারিখের দিনটি ঠিক আছে) | হ্যাঁ |
| – দেওয়া হয়নি | ঐচ্ছিক নথি, ফাইল নেই — বাদ যাবে | না |
| ✓ ঠিক আছে | ফাইল আছে এবং (লাগলে) সঠিক মেয়াদ আছে | না |

## প্যাকেজ প্যানেল
ডানদিকে (ফোনে নিচের বারে) আপনার প্যাকেজের **পৃষ্ঠা সংখ্যা** এবং **প্রস্তুত** / **N টি ঠিক করুন** চিহ্ন দেখা যায়। নিচের রঙিন ঘরগুলোর
প্রতিটি একটি নথি; সমস্যার তালিকায় চাপলে সরাসরি ওই নথির সারিতে চলে যাবেন। সমস্যা থাকলে বোতাম ধূসর থাকে — তবুও চাপলে প্যানেল কেঁপে উঠে
প্রথম সমস্যায় নিয়ে যায়। তৈরি হলে **তৈরি হয়েছে** সিলমোহর আসে ও ডাউনলোড লিংক থাকে।

## তৈরি PDF-এ কী থাকে
1. **১ম পৃষ্ঠা — কভার (ইংরেজিতে):** টেন্ডার আইডি, শিরোনাম, ক্রয়কারী প্রতিষ্ঠান, দরদাতা, জমার শেষ তারিখ, প্যাকেজ তৈরির তারিখ ও নথির তালিকা।
2. *(ঐচ্ছিক)* সূচিপত্র পৃষ্ঠা।
3. টেন্ডারের ক্রমে আপনার নথিগুলো — প্রতিটি ফাইলের **সব পৃষ্ঠা**; ফাইল না থাকা ঐচ্ছিক নথি বাদ।
4. **প্রতিটি পৃষ্ঠায় ফুটার:** `T-2026-0417 | Page X of Y`। ফুটার পৃষ্ঠার নিচে আলাদা জায়গায় বসে, তাই নথির লেখা ঢাকে না।

## সংরক্ষণ
আপনার কাজ এই ব্রাউজারে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়; পাতা রিলোড করলে ফিরে আসে। **নতুন করে শুরু করুন** চাপলে সব মুছে যায়।
