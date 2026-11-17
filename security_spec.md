# Security Specification — أرشيف الشهيد (Shaheed Archive Platform)

## 1. Data Invariants

1. **Master Admin Authority**: Only verified administrators (`/admins/$(request.auth.uid)` or verified bootstrap owner `uiryukfh@gmail.com` with `request.auth.token.email_verified == true`) can mutate platform settings, pages, content, media metadata, subtitles, official poems, roles, custom code, backups, versions, or activity logs.
2. **PII Split Isolation (`public_users`)**: Public profile fields (`uid`, `username`, `displayName`, `avatarUrl`, `bio`, `verified`, `verificationType`, `badgeLabel`, `status`) live in `public_users/{userId}` with zero PII. All PII (`email`, `phone`) is isolated in `public_users/{userId}/private/info`, readable and writable ONLY by the owning user (`isOwner(userId)`) or `isAdmin()`.
3. **Zero Self-Verification / Anti-Privilege-Escalation**: When a user registers or creates `public_users/{userId}`, `verified` MUST be `false`, `verificationType` MUST be `""`, `badgeLabel` MUST be `""`, and `status` MUST be `'active'`. Only `isAdmin()` can modify `verified`, `verificationType`, `badgeLabel`, or `status`.
4. **Verification Request State & Parent Coupling**: A `verification_requests/{requestId}` document can only be created if `/public_users/$(request.auth.uid)` exists (`exists(...)`), `userId == request.auth.uid`, and `status == 'pending'`. Only `isAdmin()` can transition `status` to `'approved'` or `'rejected'`. Terminal statuses (`'approved'`, `'rejected'`) are locked from non-admin updates.
5. **Poem Submissions Privacy & Approval Gate**: A `poem_submissions/{submissionId}` document MUST start with `status == 'pending'` and `publishedPoemId == null`. Unverified/other users CANNOT list or read other users' submissions (`allow get, list: if isAdmin() || (isSignedIn() && existing().authorUid == request.auth.uid)`). Only `isAdmin()` can approve/reject or link `publishedPoemId`.
6. **Public Draft/Hidden Content Isolation**: Unauthenticated or non-admin reads (`get` and `list`) on `pages`, `content`, `poems`, `subtitles`, and `custom_code` MUST enforce `resource.data.status == 'published'` (plus `visible == true` on `subtitles` and `enabled == true` on `custom_code`).
7. **Temporal & Structural Integrity**: All IDs match `^[a-zA-Z0-9_\-]+$` (length <= 128). Every string has explicit `.size()` bounds. Every list has `.size() <= MAX`. Every `create` validates exact `hasAll` + `hasOnly` keys and `createdAt == request.time`. Every `update` validates `updatedAt == request.time`, immutable keys (`createdAt`, `uid`/`userId`/`authorUid`), and `affectedKeys().hasOnly(...)`.

---

## 2. The "Dirty Dozen" Attack Payloads (All Must Return `PERMISSION_DENIED`)

1. **P1 — Self-Verification Escalation on User Create (`public_users/attacker_uid`)**
```json
{
  "uid": "attacker_uid",
  "username": "attacker",
  "displayName": "Attacker",
  "avatarUrl": "",
  "bio": "",
  "verified": true,
  "verificationType": "official",
  "badgeLabel": "حساب رسمي",
  "status": "active",
  "createdAt": "REQUEST_TIME",
  "updatedAt": "REQUEST_TIME"
}
```
*Invariant Violated*: Non-admin attempted to set `verified: true` on registration.

2. **P2 — Shadow Field Injection ("Ghost Field") on Public Profile Update (`public_users/user_1`)**
```json
{
  "displayName": "Legit Name",
  "isAdmin": true,
  "role": "owner",
  "updatedAt": "REQUEST_TIME"
}
```
*Invariant Violated*: `affectedKeys().hasOnly(['displayName', 'avatarUrl', 'bio', 'updatedAt'])` and `hasOnly` reject ghost RBAC keys.

3. **P3 — Email Spoofing Without Verification (`settings_public/identity`)**
*Context*: `request.auth = { uid: "spoof", token: { email: "uiryukfh@gmail.com", email_verified: false } }`
```json
{
  "category": "identity",
  "data": { "siteName": "Hacked" },
  "updatedBy": "spoof",
  "updatedAt": "REQUEST_TIME"
}
```
*Invariant Violated*: `isAdmin()` strictly requires `request.auth.token.email_verified == true`.

4. **P4 — Cross-User PII Read (`public_users/victim_uid/private/info`)**
*Context*: `request.auth.uid = "other_signed_in_user"` attempting `get` or `list`.
*Invariant Violated*: Split collection PII is readable ONLY by `isOwner(userId)` or `isAdmin()`.

5. **P5 — Verification Request Bypassing Pending State (`verification_requests/req_evil`)**
```json
{
  "id": "req_evil",
  "userId": "user_1",
  "fullName": "User One",
  "entityType": "poet",
  "details": "Please verify me",
  "attachmentUrl": "",
  "status": "approved",
  "adminNotes": "",
  "reviewedAt": null,
  "createdAt": "REQUEST_TIME",
  "updatedAt": "REQUEST_TIME"
}
```
*Invariant Violated*: `status` MUST equal `'pending'` on create; users cannot self-approve.

6. **P6 — Orphaned Verification Request Without Public User Profile (`verification_requests/req_orphan`)**
*Context*: `/public_users/no_profile_uid` does not exist in Firestore.
```json
{
  "id": "req_orphan",
  "userId": "no_profile_uid",
  "fullName": "Ghost",
  "entityType": "writer",
  "details": "Orphan request",
  "attachmentUrl": "",
  "status": "pending",
  "adminNotes": "",
  "reviewedAt": null,
  "createdAt": "REQUEST_TIME",
  "updatedAt": "REQUEST_TIME"
}
```
*Invariant Violated*: `exists(/databases/$(database)/documents/public_users/$(request.auth.uid))` fails.

7. **P7 — Terminal State Re-opening on Rejected Verification Request (`verification_requests/req_rejected`)**
*Context*: Existing document has `status == 'rejected'`, user tries to update `status: 'pending'` or change `details`.
```json
{
  "details": "Edited after rejection",
  "status": "pending",
  "updatedAt": "REQUEST_TIME"
}
```
*Invariant Violated*: Non-admin cannot mutate a terminal (`approved` / `rejected`) verification request.

8. **P8 — Poem Submission Auto-Approval & Published Link Spoofing (`poem_submissions/sub_evil`)**
```json
{
  "id": "sub_evil",
  "authorUid": "user_1",
  "title": "قصيدة مزيفة",
  "versesText": "بيت أول\nبيت ثاني",
  "poetName": "مجهول",
  "extraInfo": "",
  "status": "approved",
  "adminNotes": "",
  "publishedPoemId": "poem_1",
  "createdAt": "REQUEST_TIME",
  "updatedAt": "REQUEST_TIME"
}
```
*Invariant Violated*: Visitor/user submission creation enforces `status == 'pending'` and `publishedPoemId == null`.

9. **P9 — Unauthorized List Query on Private Poem Submissions (`poem_submissions`)**
*Context*: Unauthenticated user or `user_2` executing collection `list` query without `authorUid == request.auth.uid`.
*Invariant Violated*: `allow list` enforces `isAdmin() || (isSignedIn() && resource.data.authorUid == request.auth.uid)`.

10. **P10 — Identity Spoofing on Public User Profile Creation (`public_users/victim_uid`)**
*Context*: Authenticated as `attacker_uid`, creating document `public_users/victim_uid` or setting `uid: "victim_uid"`.
```json
{
  "uid": "victim_uid",
  "username": "impersonator",
  "displayName": "Fake Victim",
  "avatarUrl": "",
  "bio": "",
  "verified": false,
  "verificationType": "",
  "badgeLabel": "",
  "status": "active",
  "createdAt": "REQUEST_TIME",
  "updatedAt": "REQUEST_TIME"
}
```
*Invariant Violated*: Document ID `{userId}` must equal `request.auth.uid` and `incoming().uid == request.auth.uid`.

11. **P11 — Resource Exhaustion ("Denial of Wallet") Giant ID & Unbounded Body (`suggestions/...`)**
*Context*: Path ID > 128 chars or containing invalid symbols (`../evil`), OR `message` string > 10,000 characters.
```json
{
  "id": "bad/../id",
  "userId": "user_1",
  "name": "Spammer",
  "subject": "Flood",
  "message": "<20KB_STRING>",
  "targetType": "general",
  "status": "new",
  "adminReply": "",
  "createdAt": "REQUEST_TIME",
  "updatedAt": "REQUEST_TIME"
}
```
*Invariant Violated*: `isValidId()` regex + bounded `.size()` checks reject poisoned IDs and oversized payloads.

12. **P12 — Reading Unpublished/Deleted Content or Private Storage Secrets (`content/draft_1`, `settings_private/storage`)**
*Context*: Anonymous or standard public user requesting `get`/`list` on `content` where `status: 'draft'` or reading `settings_private/storage`.
*Invariant Violated*: `content` public read requires `resource.data.status == 'published'`; `settings_private` requires `isAdmin()`.
