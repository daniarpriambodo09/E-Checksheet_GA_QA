# Fix Summary: Area ID Loading Issue

## Problem
Area code format adalah string seperti "final-assy-insp-genba-c-tnga" bukan numeric format seperti "final-assy-insp-26", sehingga parsing area_id langsung dari string tidak berfungsi.

## Solution
Membuat API baru `/api/final-assy/get-area-id` yang query database untuk mendapatkan area_id berdasarkan area_code.

## Files Modified

### 1. `/app/api/final-assy/get-area-id/route.ts` (NEW)
**Purpose**: Query database untuk get area_id dari area_code
- Accept parameter: `areaCode` (string)
- Return: `{ id: number }` atau error 404
- Query: `SELECT id FROM areas WHERE area_code = $1`

### 2. `/app/checksheet-final-assy/page.tsx`
**Changes in useEffect "LOAD CARLINE/LINE HISTORY"**:
- Before: Parsing area_id dari area code string (salah)
- After: Call `/api/final-assy/get-area-id` untuk get area_id dari database
- Flow:
  1. Get area_id via API call
  2. Use area_id untuk fetch carline/line history dari `/api/final-assy/get-carline-line`

### 3. `/app/status-final-assy/page.tsx`
**Changes in useEffect "Load area_id when selectedArea changes"**:
- Before: Try fetch `/api/areas/get-by-category` (mungkin tidak ada)
- After: Call `/api/final-assy/get-area-id` untuk get area_id dari database
- Simplified logic: Langsung hit API daripada cari di array

## How It Works Now

### Checksheet Page Flow:
1. User memilih area (effectiveAreaCode)
2. useEffect trigger
3. Call `/api/final-assy/get-area-id?areaCode={effectiveAreaCode}`
4. Dapatkan area_id dari response
5. Call `/api/final-assy/get-carline-line?areaId={areaId}`
6. Tampilkan dropdown carline/line yang relevan untuk area tersebut

### Status Page Flow:
1. User change selectedArea
2. useEffect trigger & reset carline/line
3. Call `/api/final-assy/get-area-id?areaCode={selectedArea}`
4. Dapatkan area_id dan set selectedAreaId
5. CarlineLineFilter component receive areaId dan load data

## Database Query
```sql
SELECT id FROM areas WHERE area_code = 'final-assy-insp-genba-c-tnga' LIMIT 1;
```

Result: 26 (atau area_id yang sesuai dengan area code tersebut)

## Error Eliminated
- "Invalid area code format: final-assy-insp-genba-c-tnga" ✓ FIXED
- Dropdown carline/line sekarang properly load per-area ✓ FIXED
- Area change flow sekarang properly reset carline/line ✓ FIXED
