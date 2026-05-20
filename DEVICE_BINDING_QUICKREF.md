# Quick Reference: Device Binding System

## Files Changed/Created

### ✅ FIXED
- `lib/device/DeviceGuard.tsx` - Now exempts `/device-bind` from blocking

### ✅ NEW - Admin Management
- `app/admin/devices/page.tsx` - Device management UI
- `app/api/admin/devices/route.ts` - Create & list devices
- `app/api/admin/devices/[id]/route.ts` - Update/delete device
- `app/api/admin/devices/[id]/reset-binding/route.ts` - Reset binding
- `app/api/admin/devices/[id]/block/route.ts` - Block device
- `app/api/admin/devices/[id]/unblock/route.ts` - Unblock device

### ✅ DATABASE SCHEMA
Create file: `add_device_columns.sql`

---

## Critical DB Migration

```sql
ALTER TABLE registered_devices 
ADD COLUMN device_code VARCHAR(50) UNIQUE,
ADD COLUMN is_bound BOOLEAN DEFAULT FALSE,
ADD COLUMN bound_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_registered_devices_device_code 
  ON registered_devices(device_code);
CREATE INDEX idx_registered_devices_is_bound 
  ON registered_devices(is_bound);
```

---

## Admin Workflow

1. `/admin/devices` → List all devices
2. "Create Device" → Enter device_code (e.g., "TC21-QA-001")
3. "Generate QR" → Print physical sticker
4. Attach sticker to TC21 device physically
5. Done! TC21 can now scan & bind

---

## TC21 Workflow

1. Boot app
2. Auto-redirects to `/device-bind` (if not bound)
3. Scan physical QR sticker
4. System calls `/api/device/bind`
5. Device_code validated from DB
6. Binding saved locally
7. User redirected to login
8. Access granted ✅

---

## Device States

| State | device_code | is_bound | Meaning |
|-------|-------------|---------|---------|
| New | TC21-QA-001 | FALSE | Admin created, ready to bind |
| Bound | TC21-QA-001 | TRUE | TC21 scanned & bound successfully |
| Reset | NULL | FALSE | Admin reset, ready for rebind |
| Blocked | TC21-QA-001 | TRUE | Hardware issue, blocked by admin |

---

## Testing Checklist

- [ ] DB migration applied
- [ ] `/admin/devices` page loads
- [ ] Can create device_code "TEST-TC21-001"
- [ ] Can generate QR code
- [ ] Can scan QR on TC21
- [ ] Binding succeeds
- [ ] TC21 can access app
- [ ] Can reset binding
- [ ] Can block/unblock device

---

## Deployment Order

1. Run database migration
2. Deploy code (build passed ✅)
3. Train admins on `/admin/devices` workflow
4. Batch create all existing device codes
5. Print & attach QR stickers
6. Test with one TC21
7. Roll out to production

---

## Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /admin/devices | GET | List all devices (UI) |
| /api/admin/devices | GET, POST | List & create devices (API) |
| /api/admin/devices/[id] | PUT, DELETE | Update/delete device |
| /api/admin/devices/[id]/reset-binding | POST | Clear binding |
| /api/admin/devices/[id]/block | POST | Block device |
| /api/admin/devices/[id]/unblock | POST | Unblock device |
| /api/device/bind | POST | TC21 binding endpoint |
| /device-bind | GET | TC21 QR scan page |

---

## Naming Convention for Device Codes

Recommend format: `TC21-<AREA>-<NUMBER>`

Examples:
- `TC21-QA-001` - QA Area, Device 1
- `TC21-PA-001` - Pre-Assembly, Device 1
- `TC21-FA-001` - Final-Assembly, Device 1
- `TC21-GA-001` - Gauge Area, Device 1

---

## Troubleshooting

**TC21 stuck on "Memverifikasi perangkat..."**
- Check if device_code created in admin
- Check if device_code matches QR sticker
- Check database connection
- Check if device is blocked

**Can't create device_code**
- Check admin role in database
- Check /admin/devices loads
- Check API endpoint returns 403 if not admin

**Binding fails with "device not found"**
- Device_code doesn't exist in DB
- Must create via /admin/devices first

**QR Code wrong**
- Verify device_code in QR matches DB value
- Regenerate if QR damaged

---

## Performance Notes

- Device checks cached in localStorage
- Binding stored separately from DeviceIdentity
- No changes to checklist/gauge performance
- Desktop unaffected (binding bypassed)

---

## Security Notes

- device_code must be UNIQUE (constraint enforced)
- Only admins can manage devices
- Binding requires valid device_uuid (cannot fake)
- Fingerprint verification prevents device swapping
- Block mechanism prevents compromised devices

---

## Next Steps if Needed

1. **Audit logging** - Track who created/modified devices
2. **Device telemetry** - Dashboard showing device status
3. **Batch operations** - CSV upload many devices
4. **Scheduled expiry** - Device codes expire if not bound
5. **Notification system** - Alert on binding failures

---

## Build Status ✅

```
✓ Compiled successfully in 15.0s
✓ Finished TypeScript in 23.7s
✓ 69 pages/routes generated
✓ New routes registered:
  - ○ /admin/devices
  - ƒ /api/admin/devices
  - ƒ /api/admin/devices/[id]
  - ƒ /api/admin/devices/[id]/block
  - ƒ /api/admin/devices/[id]/reset-binding
  - ƒ /api/admin/devices/[id]/unblock
```

---

**Last Updated**: 2024-05-15  
**System**: E-Checksheet QA v1.0  
**Status**: Production Ready (after DB migration)
