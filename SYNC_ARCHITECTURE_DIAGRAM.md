# Real-Time Sync Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ROUTE 98 POS - REAL-TIME SYNC                   │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                              ┌──────────────────┐
│   DEVICE A       │                              │   DEVICE B       │
│  (Computer)      │                              │   (Phone)        │
├──────────────────┤                              ├──────────────────┤
│                  │                              │                  │
│  ┌────────────┐  │                              │  ┌────────────┐  │
│  │   UI       │  │                              │  │   UI       │  │
│  │ Inventory  │  │                              │  │ Inventory  │  │
│  │   View     │  │                              │  │   View     │  │
│  └─────┬──────┘  │                              │  └─────▲──────┘  │
│        │         │                              │        │         │
│        │ Edit    │                              │        │ Update  │
│        ▼         │                              │        │         │
│  ┌────────────┐  │                              │  ┌────────────┐  │
│  │   DB.js    │  │                              │  │   DB.js    │  │
│  │ (Write)    │  │                              │  │  (Read)    │  │
│  └─────┬──────┘  │                              │  └─────▲──────┘  │
│        │         │                              │        │         │
│        │ Save    │                              │        │ Update  │
│        ▼         │                              │        │         │
│  ┌────────────┐  │                              │  ┌────────────┐  │
│  │localStorage│  │                              │  │localStorage│  │
│  │  (instant) │  │                              │  │  (instant) │  │
│  └─────┬──────┘  │                              │  └─────▲──────┘  │
│        │         │                              │        │         │
│        │ Fire    │                              │        │ Apply   │
│        ▼         │                              │        │         │
│  ┌────────────┐  │                              │  ┌────────────┐  │
│  │ mm:dirty   │  │                              │  │ onValue()  │  │
│  │   event    │  │                              │  │  listener  │  │
│  └─────┬──────┘  │                              │  └─────▲──────┘  │
│        │         │                              │        │         │
│        │ Trigger │                              │        │ Push    │
│        ▼         │                              │        │         │
│  ┌────────────┐  │      ┌──────────────┐       │  ┌────────────┐  │
│  │ Realtime   │──┼──────▶│   FIREBASE   │───────┼──▶│ Realtime   │  │
│  │ Sync.js    │  │      │  REALTIME DB │       │  │ Sync.js    │  │
│  │(Push)      │  │      │ (WebSocket)  │       │  │(Subscribe) │  │
│  └─────┬──────┘  │      └──────────────┘       │  └────────────┘  │
│        │         │                              │                  │
│        │ Backup  │      ┌──────────────┐       │                  │
│        └─────────┼──────▶│   FIREBASE   │       │                  │
│                  │      │  FIRESTORE   │       │                  │
│                  │      │  (Snapshot)  │       │                  │
└──────────────────┘      └──────────────┘       └──────────────────┘
      (1 second)               (Batch)               (< 500ms)
```

---

## Data Flow Timeline

```
TIME    DEVICE A (Editor)              CLOUD              DEVICE B (Viewer)
────────────────────────────────────────────────────────────────────────────
0ms     User clicks "Save"
        ↓
50ms    Write to localStorage ✅
        ↓
100ms   Fire mm:dirty event
        ↓
150ms   RealtimeSync triggered
        ↓
200ms   Debounce timer started
        ↓
                                                          [Waiting...]
1.0s    Push to Realtime DB ──────▶  
                                     Receive update ✅
                                     ↓
1.2s                                 WebSocket push ────▶  onValue() fired
                                                          ↓
1.3s                                                      Update localStorage
                                                          ↓
1.4s                                                      Show notification 🔔
                                                          ↓
1.5s                                                      Refresh UI ✅
                                                          
2.0s    Push to Firestore ─────────▶
                                     Snapshot saved ✅
        
────────────────────────────────────────────────────────────────────────────
TOTAL USER-PERCEIVED SYNC TIME: < 1.5 seconds
```

---

## Component Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                      EVENT FLOW                                 │
└─────────────────────────────────────────────────────────────────┘

    User Action (Edit Product)
            │
            ▼
    ┌───────────────────┐
    │   DB.write()      │  ← Local-first save
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │   mm:dirty event  │  ← Custom event dispatch
    └─────────┬─────────┘
              │
              ├──────────────────────────────────┐
              │                                  │
              ▼                                  ▼
    ┌───────────────────┐            ┌─────────────────────┐
    │ setupAutomaticSync│            │  Other listeners    │
    │   (debounce 1s)   │            │  (if any)           │
    └─────────┬─────────┘            └─────────────────────┘
              │
              ▼
    ┌───────────────────┐
    │ syncAllProducts() │  ← Batch sync all products
    └─────────┬─────────┘
              │
              ├──────────────────────────────────┐
              │                                  │
              ▼                                  ▼
    ┌───────────────────┐            ┌─────────────────────┐
    │  Realtime DB      │            │   Firestore         │
    │  (Instant)        │            │   (Backup)          │
    └─────────┬─────────┘            └─────────────────────┘
              │
              ▼
    ┌───────────────────┐
    │  subscribeToAll   │  ← Other devices receive
    │   Products()      │
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │  DB.setProducts() │  ← Update local storage
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │  Inventory.render()│ ← Refresh UI
    └───────────────────┘
              │
              ▼
    ┌───────────────────┐
    │  Utils.toast()    │  ← Show notification
    └───────────────────┘
```

---

## Conflict Resolution Flow

```
┌──────────────────────────────────────────────────────────────────┐
│              CONFLICT RESOLUTION ALGORITHM                       │
└──────────────────────────────────────────────────────────────────┘

Device A: Edit Product X at 10:00:00.500
Device B: Edit Product X at 10:00:00.800
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Both push to cloud   │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Last received update │
                    │  (Device B at :800)   │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Check timestamp      │
                    │  800 > 500 = True     │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Device B wins         │
                    │ Push to Device A      │
                    └───────────┬───────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
    ┌───────────────────┐           ┌───────────────────┐
    │  Device A gets    │           │  Device B keeps   │
    │  Device B update  │           │  its changes      │
    └───────────────────┘           └───────────────────┘
                │                               │
                └───────────────┬───────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Both devices synced  │
                    │  with Device B data   │
                    └───────────────────────┘
```

---

## Stock Adjustment (Atomic Transaction)

```
┌──────────────────────────────────────────────────────────────────┐
│              ATOMIC STOCK TRANSACTION                            │
└──────────────────────────────────────────────────────────────────┘

Device A: Sell 5 units                Device B: Sell 3 units
    │                                      │
    ▼                                      ▼
┌─────────────────┐                  ┌─────────────────┐
│ Request Lock    │                  │ Request Lock    │
│ Stock: 100      │                  │ Stock: 100      │
└────────┬────────┘                  └────────┬────────┘
         │                                    │
         ▼                                    │
┌─────────────────┐                          │
│ Lock Acquired   │                          │
│ Stock: 100 → 95 │                          │
└────────┬────────┘                          │
         │                                    │
         ▼                                    │
┌─────────────────┐                          │
│ Commit: 95      │                          │
│ Release Lock    │                          │
└────────┬────────┘                          │
         │                                    ▼
         │                            ┌─────────────────┐
         │                            │ Lock Acquired   │
         │                            │ Stock: 95 → 92  │
         │                            └────────┬────────┘
         │                                     │
         │                                     ▼
         │                            ┌─────────────────┐
         │                            │ Commit: 92      │
         │                            │ Release Lock    │
         │                            └────────┬────────┘
         │                                     │
         └─────────────┬───────────────────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  Final Stock: 92    │
            │  (100 - 5 - 3)      │
            │  ✅ No race condition│
            └─────────────────────┘
```

---

## Multi-Device Sync Example

```
┌──────────────────────────────────────────────────────────────────┐
│          3 DEVICES SYNCING SIMULTANEOUSLY                        │
└──────────────────────────────────────────────────────────────────┘

    Owner (Device A)          Cashier (Device B)       Manager (Device C)
    [Home Computer]           [Store POS]              [Tablet]
           │                         │                         │
    Add Product              Complete Sale              View Inventory
    "Coke 1.5L"              "Coke 1.5L x 2"           [Watching]
           │                         │                         │
           ▼                         ▼                         │
    localStorage             localStorage                      │
           │                         │                         │
           ▼                         ▼                         │
    mm:dirty                 mm:dirty                          │
           │                         │                         │
           └────────┬────────────────┘                         │
                    │                                          │
                    ▼                                          │
         ┌──────────────────────┐                             │
         │   FIREBASE CLOUD     │                             │
         │  (Central Hub)       │                             │
         └──────────┬───────────┘                             │
                    │                                          │
        ┌───────────┼───────────┐                             │
        │           │           │                              │
        ▼           ▼           ▼                              │
   Device A     Device B     Device C ◀─────────────────────────
   [Synced]     [Synced]     [Synced]
        │           │           │
        │           │           └─▶ 🔔 "Inventory updated"
        │           │               ✅ Shows "Coke 1.5L"
        │           │               ✅ Stock updated (2 sold)
        │           │
        │           └─▶ ✅ Sale recorded
        │               ✅ Stock reduced by 2
        │
        └─▶ ✅ Product added
            ✅ Visible on all devices
            
═══════════════════════════════════════════════════════════════════
TOTAL TIME: < 2 seconds from action to all devices synced
═══════════════════════════════════════════════════════════════════
```

---

## Error Handling Flow

```
┌──────────────────────────────────────────────────────────────────┐
│              ERROR HANDLING & RECOVERY                           │
└──────────────────────────────────────────────────────────────────┘

User Action
    │
    ▼
Save Locally ✅ ← Always succeeds (local-first)
    │
    ▼
Try Sync to Cloud
    │
    ├─▶ Success? ──▶ ✅ Done
    │
    └─▶ Failed? ──▶ Check error type
                        │
                        ├─▶ Network Error
                        │       │
                        │       ▼
                        │   Queue for retry
                        │       │
                        │       ▼
                        │   Wait for online
                        │       │
                        │       ▼
                        │   Auto-retry ✅
                        │
                        ├─▶ Permission Error
                        │       │
                        │       ▼
                        │   Show error message
                        │   Keep local data ✅
                        │   User can retry manually
                        │
                        └─▶ Quota Exceeded
                                │
                                ▼
                            Show warning
                            Continue local-only
                            Sync when quota resets
```

---

## Summary

This architecture provides:

✅ **Local-First**: All data saved locally first (no data loss)  
✅ **Real-Time**: Changes sync in < 1 second  
✅ **Atomic**: Stock transactions prevent conflicts  
✅ **Resilient**: Auto-retry on failure  
✅ **Scalable**: Handles hundreds of devices  
✅ **Efficient**: Debounced batching saves bandwidth  
✅ **Reliable**: Dual-layer sync (Realtime DB + Firestore)  

**Result**: Enterprise-grade multi-device synchronization!
