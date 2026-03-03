# Carline & Line Dropdown Fixes

## Issues Fixed

### Issue 1: Carline/Line Dropdown Not Loading in Checksheet Page
**Problem:** User sudah input carline dan line, tapi dropdown tidak muncul di page checksheet ketika area diganti.

**Root Cause:** 
- API `get-carline-line` tidak filter by area, hanya fetch dari global history
- CarlineLineSection tidak load history dari API berdasarkan areaCode

**Solution:**
- Updated `get-carline-line` API untuk require `areaId` parameter dan filter dari `checklist_results` table
- Updated `CarlineLineSection` component untuk load history dari API dengan areaCode
- Added effect untuk reload history ketika areaCode berubah
- History sekarang per-area, jadi ketika area ganti, dropdown loading dengan data spesifik area

### Issue 2: Status Page Showing "Tidak ada data"
**Problem:** Di page `/status-final-assy`, dropdown Carline dan Line tidak menampilkan data meskipun sudah ada di database.

**Root Cause:**
- `CarlineLineFilter` component tidak menerima `areaId` parameter untuk filter
- API call di component tidak include areaId
- Status page tidak track `selectedAreaId`

**Solution:**
- Added `selectedAreaId` state di status page
- Created effect untuk load `area_id` saat `selectedArea` berubah
- Updated `CarlineLineFilter` component untuk accept `areaId` dan `selectedArea` props
- CarlineLineFilter sekarang fetch data dengan areaId parameter
- Reset carline/line saat area berubah (data ulang dimulai dari kosong)

### Issue 3: Area-Specific Carline/Line History Not Working
**Problem:** Setiap area punya carline/line yang berbeda, tapi sebelumnya data tidak ter-filter by area.

**Root Cause:**
- Query di `get-carline-line` API fetch dari `carline_line_mapping` yang tidak have area tracking
- Seharusnya fetch dari `checklist_results` yang memiliki `area_id`

**Solution:**
- Updated `get-carline-line` API untuk query dari `checklist_results` table (bukan `carline_line_mapping`)
- Query menggunakan `DISTINCT carline, line` filtered by `area_id`
- Ini memastikan dropdown hanya menampilkan carline/line yang pernah digunakan di area tersebut

### Issue 4: Save Carline/Line Not Preserving User History
**Problem:** Carline dan line yang diinput tidak tersimpan ke mapping table untuk reuse di future.

**Root Cause:**
- `save-carline-line` API tidak accept `userId` dan `categoryCode` untuk save ke mapping table

**Solution:**
- Updated `save-carline-line` API request body untuk accept `userId`, `categoryCode`, dan `areaId`
- API sekarang insert/update ke `carline_line_mapping` table dengan proper fields
- Updated checksheet page `handleSubmit` untuk pass `userId` dan `categoryCode` saat save

## Files Modified

### Backend API
1. **`/app/api/final-assy/get-carline-line/route.ts`**
   - Added `areaId` parameter requirement
   - Changed query dari `carline_line_mapping` ke `checklist_results`
   - Filter by area_id dengan DISTINCT on carline, line

2. **`/app/api/final-assy/save-carline-line/route.ts`**
   - Added `userId`, `categoryCode`, `areaId` parameters
   - Now properly insert/update `carline_line_mapping` table
   - Support for user history tracking

### Frontend Components
3. **`/components/ChecksheetComponents/CarlineLineSection.tsx`**
   - Added `useEffect` untuk load area-specific history dari API
   - Added `areaCode` prop untuk pass area context
   - Load history berdasarkan `areaId` yang diekstrak dari `areaCode`
   - Use `effectiveHistory` yang combine API data + manual input

4. **`/components/ChecksheetComponents/CarlineLineFilter.tsx`**
   - Added `areaId` dan `selectedArea` props
   - Changed fetch logic untuk include `areaId` parameter
   - Reset history saat `areaId` berubah
   - Only show carline/line untuk selected area

### Pages
5. **`/app/checksheet-final-assy/page.tsx`**
   - Updated carline/line history loading untuk use area-based filtering
   - Extract `area_id` dari `effectiveAreaCode` format
   - Pass `areaCode` ke CarlineLineSection component
   - Updated `save-carline-line` call untuk include `userId` dan `categoryCode`

6. **`/app/status-final-assy/page.tsx`**
   - Added `selectedAreaId` state
   - Created effect untuk load `area_id` saat area berubah
   - Pass `areaId` dan `selectedArea` ke CarlineLineFilter component
   - Reset carline/line saat area berubah

## How It Works Now

### Checksheet Page Flow
1. User select area → load area-specific checklist items
2. Component load carline/line history from API filtered by area_id
3. User input atau select dari dropdown carline/line
4. Saat submit, carline dan line disimpan ke database
5. Data juga disave ke `carline_line_mapping` untuk reuse di future

### Status Page Flow
1. User select area → load area_id
2. CarlineLineFilter load carline/line options for that area
3. User filter dropdown by carline dan line
4. Data table filtered berdasarkan kombinasi area + carline + line

## Testing Checklist
- [ ] Switch area di checksheet → dropdown carline/line harus kosong dulu
- [ ] Input carline dan line → seharusnya muncul di dropdown setelah submit
- [ ] Input second time area yang sama → dropdown carline/line harus muncul dengan options
- [ ] Switch ke area lain → dropdown harus kosong atau punya options berbeda
- [ ] Status page filter by area → hanya carline/line dari area itu yang muncul
