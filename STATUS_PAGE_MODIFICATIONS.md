# Modifikasi Status Final Assembly Page

## Ringkasan
Telah menambahkan fitur dropdown **Carline** dan **Line** ke page `/status-final-assy` untuk memungkinkan filtering data berdasarkan carline dan line yang telah diinput dari page `/checksheet-final-assy`.

## File yang Dimodifikasi

### 1. **Frontend Pages & Components**

#### `/app/status-final-assy/page.tsx`
- **Perubahan:**
  - Import `CarlineLineFilter` component
  - Tambah state: `selectedCarline` dan `selectedLine`
  - Update `loadDataFromDB()` untuk include carline dan line sebagai query parameters
  - Update dependency array di `useEffect` untuk include carline dan line
  - Update UI filter section untuk menampilkan `CarlineLineFilter` di samping `AreaFilter`

#### `/components/ChecksheetComponents/CarlineLineFilter.tsx` (NEW)
- **File baru** untuk standalone filter component
- Fitur:
  - Dropdown Carline (diambil dari history yang tersimpan)
  - Dropdown Line (filtered berdasarkan carline yang dipilih)
  - Loading state dan error handling
  - Responsive design untuk semua ukuran layar

### 2. **Backend API Routes**

#### `/app/api/final-assy/get-results/route.ts`
- **Perubahan:**
  - Tambah query parameters: `carline` dan `line`
  - Update SELECT columns untuk include `r.carline` dan `r.line`
  - Refactor query building untuk dynamic WHERE conditions
  - Tambah filter conditions untuk carline dan line (optional)
  - Support filtering dengan kombinasi area, carline, dan line

#### `/app/api/final-assy/get-signatures/route.ts`
- **Perubahan:**
  - Tambah query parameters: `carline` dan `line`
  - Refactor query building untuk dynamic WHERE conditions
  - Tambah filter conditions untuk carline dan line (optional)
  - Support filtering dengan kombinasi area, carline, dan line

### 3. **Database Migration**

#### `/migration/add-carline-line.sql`
- **Perubahan:**
  - Tambah kolom `carline` dan `line` ke tabel `checklist_signatures` (sebelumnya hanya di `checklist_results`)
  - Create indexes untuk kolom carline dan line di checklist_signatures:
    - `idx_signatures_carline`
    - `idx_signatures_line`
    - `idx_signatures_carline_line`

## Data Flow

```
1. User input Carline & Line di /checksheet-final-assy
   ↓
2. Data disimpan ke database:
   - checklist_results (dengan carline, line)
   - carline_line_mapping (tracking history)
   ↓
3. User buka /status-final-assy
   ↓
4. CarlineLineFilter fetch history dari /api/final-assy/get-carline-line
   ↓
5. User select Carline & Line
   ↓
6. loadDataFromDB() call API dengan filter parameters
   ↓
7. /api/final-assy/get-results filter data berdasarkan:
   - Area (existing)
   - Carline (NEW)
   - Line (NEW)
   - Month, Category, User (existing)
   ↓
8. Results ditampilkan di table dengan filter aktif
```

## Testing Checklist

- [ ] Jalankan migration `add-carline-line.sql` di database
- [ ] Buka `/checksheet-final-assy`, input Carline & Line, submit
- [ ] Buka `/status-final-assy`
- [ ] Verify Carline dropdown menampilkan nilai yang diinput
- [ ] Select Carline, verify Line dropdown hanya menampilkan lines untuk carline tersebut
- [ ] Select Line, verify data di table ter-filter dengan benar
- [ ] Test dengan kombinasi Area + Carline + Line filtering
- [ ] Test dengan 2-3 bulan berbeda untuk verify monthly filtering
- [ ] Test dengan group-leader dan inspector views
- [ ] Verify responsive design di mobile (tablet & phone)

## Notes

- Carline dan Line bersifat **optional filters** - user bisa tetap melihat semua data jika tidak select
- Filtering **otomatis** dilakukan ketika user mengubah selection (debounced via useEffect)
- Jika tidak ada carline/line yang tersimpan, dropdown akan menampilkan "Tidak ada data"
- API query menggunakan **parameterized queries** untuk security dan prevent SQL injection
- Indexes di database sudah ditambahkan untuk optimize query performance

## API Query Parameter Examples

```
GET /api/final-assy/get-results?
  userId=user123&
  categoryCode=final-assy-inspector&
  month=2026-03&
  areaCode=final-assy-insp-genba-a-mazda&
  carline=MAZDA3&
  line=LINE_A

GET /api/final-assy/get-signatures?
  userId=user123&
  categoryCode=final-assy-inspector&
  month=2026-03&
  areaCode=final-assy-insp-genba-a-mazda&
  carline=MAZDA3&
  line=LINE_A
```

## Backward Compatibility

- Jika `carline` dan `line` tidak dikirim dalam query, API akan tetap berfungsi normal (filter tidak aktif)
- Existing code yang tidak menggunakan carline/line akan tetap work tanpa perubahan
- Migration aman (menggunakan `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
