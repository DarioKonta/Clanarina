# Google Stitch prompt

Paste the text below into Google Stitch (Mobile mode).

---

Design a mobile Android app (Material 3) called **"Članarina"** for a small kickbox club to track who has paid their monthly membership. All UI text must be in **Serbian, Latin script**. The app is used by 1–3 trainers in the gym, often one-handed and in a hurry, so it should be very simple, with large tap targets, high contrast and few steps.

**Visual style:** modern and sporty, dark theme by default (near-black background #121212, dark gray cards), one bold accent color (energetic red #E53935) for primary actions. Status colors: green = paid, red = owes, amber = expiring soon, gray = expired. Rounded cards (16px), bold sans-serif headings, generous spacing. Bottom navigation with 3 tabs: **Članovi**, **Dugovanja**, **Podešavanja**. A small sync status pill in the top app bar ("Sinhronizovano pre 5 min" / "Offline – 3 izmene čekaju").

**Screens:**

1. **Članovi (member list)**: a search bar ("Pretraži članove"), filter chips (Svi / Plaćeno / Duguje / Ističe uskoro), and a list of member cards. Each card shows an avatar with initials, full name (e.g. "Marko Petrović"), a status chip ("Plaćeno do 30. nov", "Duguje 3.000 RSD", "Ističe za 3 dana") and a one-tap "Uplata" quick action. A floating action button "+ Novi član".

2. **Član (member detail)**: name, phone and a status header card. A large primary button "Nova članarina". A history timeline of memberships: period ("1. nov – 30. nov 2026."), amount, and a status chip. For an unpaid one, show "Nije plaćeno" and an inline button "Evidentiraj uplatu". Overflow menu: Izmeni, Arhiviraj.

3. **Nova članarina (new membership form, bottom sheet or full screen)**: member picker, "Početak perioda" date picker (default: 1st of current month), "Trajanje" segmented control (1 / 2 / 3 / 6 meseci), "Iznos (RSD)" number field prefilled with 3.000, a toggle "Plaćeno odmah" (when off, show helper text: "Članarina počinje od izabranog datuma, uplata se može evidentirati kasnije"), an optional note field, and a "Sačuvaj" button.

4. **Evidentiraj uplatu (record a delayed payment, dialog)**: "Marko Petrović – članarina 1. nov – 30. nov", payment date (default today), amount, and the buttons "Potvrdi uplatu" / "Otkaži".

5. **Dugovanja (debts)**: a summary card at the top ("Ukupno duguje: 4 člana · 12.000 RSD") and a list sorted by how long they've owed ("Duguje od 1. nov · 6 dana"). Each row has the quick action "Uplata".

6. **Podešavanja (settings)**: a section "Google Sheets sinhronizacija" with fields "URL skripte" and "Tajni ključ", a large "Sinhronizuj sada" button, "Poslednja sinhronizacija: danas u 14:32", and a count of pending changes. A second section "O aplikaciji".

Also show an **empty state** for Članovi ("Još nema članova – dodaj prvog") and an **offline banner** ("Nema interneta – podaci su sačuvani na telefonu").
