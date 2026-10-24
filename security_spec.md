# Security Specification — SIA ITMANV (Firestore Hardened Rules)

## 1. Data Invariants
1. **Zero Blanket Reads & PII Protection**: `/users/{userId}` contains user PII (`email`, `fullName`) and is strictly isolated to `request.auth.uid == userId || isAdmin()`.
2. **Ownership & Verified Identity**: Every record created in `applicants`, `enrollments`, `grades`, `schedules`, and `invoices` must have `ownerId == request.auth.uid`, require `request.auth.token.email_verified == true`, and enforce exact server timestamps (`createdAt == request.time`, `updatedAt == request.time`).
3. **Strict Schema & Key Whitelisting**: Every `create` and `update` validates exact required keys (`hasAll` + `hasOnly`), field types, string boundary lengths, regex patterns for IDs (`isValidId`), and valid enum sets.
4. **Immutable Fields**: `ownerId` and `createdAt` can never be mutated on update (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
5. **Terminal State Locking**:
   - An `Applicant` with `dossierStatus == 'ADMITIDO_DIRECTORAL'` cannot be modified by non-admins.
   - A `GradeRecord` with `actaStatus == 'VISADO_DIRECTOR'` is locked against further edits unless `isAdmin()`.
6. **Secure List Queries**: Every `allow list` rule enforces `resource.data.ownerId == request.auth.uid || isAdmin()`, preventing unauthorized query scraping without O(n) `get()` calls.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection**: Adding `"isSuperAdmin": true` to `/applicants/{id}` -> Rejected by `data.keys().hasOnly(...)`.
2. **Unverified Email Spoofing**: Token with `email: "edgarmanosalva4040@gmail.com"` but `email_verified: false` -> Rejected by `isVerifiedUser()`.
3. **Owner Spoofing on Create**: Setting `ownerId: "victim_uid"` while authenticated as `"attacker_uid"` -> Rejected by `data.ownerId == request.auth.uid`.
4. **Owner Mutation on Update**: Changing `ownerId` during an update -> Rejected by `incoming().ownerId == existing().ownerId`.
5. **Timestamp Forgery**: Providing a past or future client timestamp for `createdAt` or `updatedAt` -> Rejected by `data.createdAt == request.time`.
6. **ID Poisoning (1.5KB Junk ID)**: Creating a document with a 500-character or special-char ID -> Rejected by `isValidId(docId)`.
7. **Terminal State Bypass on Grades**: Updating `il1` on a `GradeRecord` where `existing().actaStatus == 'VISADO_DIRECTOR'` as a non-admin -> Rejected by terminal state gate.
8. **Terminal State Bypass on Admission**: Updating `examScore` on an `Applicant` where `existing().dossierStatus == 'ADMITIDO_DIRECTORAL'` -> Rejected by terminal state gate.
9. **Value Poisoning on Update**: Updating `examScore` with `"twenty"` (string) or `150` (out of 0..100 bounds) -> Rejected by `isValidApplicant(incoming())` wrapping the update block.
10. **PII Leak on Users**: Authenticated user `"user_B"` attempting `get` on `/users/user_A` -> Rejected by `isOwner(userId) || isAdmin()`.
11. **Unconstrained List Query**: Client running `getDocs(collection(db, 'invoices'))` without `where('ownerId', '==', uid)` as non-admin -> Rejected by `resource.data.ownerId == request.auth.uid`.
12. **Privilege Escalation on `/admins`**: Non-admin attempting to create a document in `/admins/{uid}` -> Rejected (`allow write: if false;`).
