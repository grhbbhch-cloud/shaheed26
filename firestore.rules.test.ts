/**
 * Security Rule Regression & Dirty Dozen Verification Suite (Reference Test Runner)
 * Designed to assert that every Dirty Dozen payload in security_spec.md fails with PERMISSION_DENIED
 * against firestore.rules when run under @firebase/rules-unit-testing with an active Firestore Emulator.
 */
import assert from 'node:assert/strict';

export interface DirtyDozenCase {
  id: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 'P1_SelfVerificationEscalation',
    collectionPath: 'public_users/attacker_uid',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'attacker_uid',
      username: 'attacker',
      displayName: 'Attacker',
      avatarUrl: '',
      bio: '',
      verified: true,
      verificationType: 'official',
      badgeLabel: 'حساب رسمي',
      status: 'active',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P2_ShadowFieldGhostUpdate',
    collectionPath: 'public_users/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: { displayName: 'Legit', isAdmin: true, role: 'owner' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P3_UnverifiedAdminEmailSpoof',
    collectionPath: 'settings_public/identity',
    operation: 'create',
    auth: { uid: 'spoof_uid', email: 'uiryukfh@gmail.com', email_verified: false },
    payload: { category: 'identity', data: { siteName: 'Hacked' }, updatedBy: 'spoof_uid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P4_CrossUserPIIRead',
    collectionPath: 'public_users/victim_uid/private/info',
    operation: 'get',
    auth: { uid: 'other_user', email: 'other@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P5_VerificationRequestSelfApprove',
    collectionPath: 'verification_requests/req_evil',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      id: 'req_evil',
      userId: 'user_1',
      fullName: 'User One',
      entityType: 'poet',
      details: 'Please verify me',
      attachmentUrl: '',
      status: 'approved',
      adminNotes: '',
      reviewedAt: null,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P6_OrphanedVerificationRequest',
    collectionPath: 'verification_requests/req_orphan',
    operation: 'create',
    auth: { uid: 'no_profile_uid', email: 'noprofile@example.com', email_verified: true },
    payload: {
      id: 'req_orphan',
      userId: 'no_profile_uid',
      fullName: 'Ghost',
      entityType: 'writer',
      details: 'Orphan request',
      attachmentUrl: '',
      status: 'pending',
      adminNotes: '',
      reviewedAt: null,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P7_TerminalVerificationMutation',
    collectionPath: 'verification_requests/req_rejected',
    operation: 'update',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: { details: 'Edited after rejection', status: 'pending' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P8_PoemSubmissionSelfApprove',
    collectionPath: 'poem_submissions/sub_evil',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      id: 'sub_evil',
      authorUid: 'user_1',
      title: 'قصيدة مزيفة',
      versesText: 'بيت أول\nبيت ثاني',
      poetName: 'مجهول',
      extraInfo: '',
      status: 'approved',
      adminNotes: '',
      publishedPoemId: 1,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P9_UnauthorizedPoemSubmissionList',
    collectionPath: 'poem_submissions',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P10_ProfileIdentitySpoofing',
    collectionPath: 'public_users/victim_uid',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'victim_uid',
      username: 'impersonator',
      displayName: 'Fake Victim',
      avatarUrl: '',
      bio: '',
      verified: false,
      verificationType: '',
      badgeLabel: '',
      status: 'active',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P11_OversizedSuggestionPayload',
    collectionPath: 'suggestions/bad..id',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: {
      id: 'bad..id',
      userId: 'user_1',
      name: 'Spammer',
      subject: 'Flood',
      message: 'x'.repeat(20000),
      targetType: 'general',
      status: 'new',
      adminReply: '',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P12_PrivateSettingsAndDraftRead',
    collectionPath: 'settings_private/storage',
    operation: 'get',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];

assert.equal(DIRTY_DOZEN_TESTS.length, 12, 'Must maintain all 12 Dirty Dozen cases');
