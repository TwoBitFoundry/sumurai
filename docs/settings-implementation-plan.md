# Settings Page Implementation Plan

## Overview

This document provides a phased implementation guide for adding a Settings page to Sumaura, featuring account deletion and password change functionality. The implementation follows existing architecture patterns: static services with dependency injection via ApiClient (frontend) and trait-based DI (backend).

## Architecture Principles

### Frontend
- **Services**: Static methods using `ApiClient` for HTTP (matches `AuthService` pattern)
- **Components**: UI-only, delegate business logic to services
- **Styling**: Glassmorphism design with primitives from `@/ui/primitives`
- **Separation**: Models in interfaces, validation in utils, UI in pages

### Backend
- **Services**: Trait-based dependency injection with `Arc<dyn Trait>`
- **Handlers**: Injected services via `AppState`
- **Database**: RLS policies for multi-tenant isolation
- **Cache**: Redis-based with pattern invalidation

---

## Phased Implementation

### Phase 1: Database Foundation

**Goal**: Ensure database supports complete user deletion with CASCADE constraints.

**Files to Create**:
- `backend/migrations/022_add_budgets_cascade.sql`

**Tasks**:
1. Create migration file with budgets CASCADE constraint
2. Run migration on local database
3. Verify CASCADE constraint exists on budgets table
4. Test CASCADE behavior manually (create test user → add budget → delete user → verify budget deleted)

**Acceptance Criteria**:
- [ ] Migration runs successfully without errors
- [ ] `budgets` table has `ON DELETE CASCADE` constraint on `user_id`
- [ ] Deleting a user automatically deletes their budgets
- [ ] All user-related tables now have CASCADE (accounts, transactions, connections, credentials, budgets)

**Testing**:
```sql
-- Verify constraint exists
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'budgets'::regclass AND contype = 'f';

-- Test CASCADE behavior
BEGIN;
INSERT INTO users (id, email, password_hash, provider) VALUES (gen_random_uuid(), 'test@cascade.com', 'hash', 'plaid');
INSERT INTO budgets (user_id, category, month, amount)
  VALUES ((SELECT id FROM users WHERE email = 'test@cascade.com'), 'Food', '2024-01', 1000);
DELETE FROM users WHERE email = 'test@cascade.com';
SELECT * FROM budgets WHERE category = 'Food' AND month = '2024-01'; -- Should return 0 rows
ROLLBACK;
```

**Dependencies**: None

---

### Phase 2: Backend Data Layer

**Goal**: Add repository methods for password updates and user deletion.

**Files to Modify**:
- `backend/src/services/repository_service.rs`

**Tasks**:
1. Add `update_user_password` method to `DatabaseRepository` trait
2. Add `delete_user` method to `DatabaseRepository` trait
3. Implement both methods in `PostgresRepository`
4. Ensure RLS context is set in both implementations
5. Write unit tests for both methods
6. Run tests and verify they pass

**Acceptance Criteria**:
- [ ] Trait methods added with correct signatures
- [ ] Implementations use transactions and set RLS context
- [ ] Unit tests pass for password update
- [ ] Unit tests pass for user deletion
- [ ] RLS context properly scoped within transactions

**Testing**:
```rust
// backend/src/tests/repository_service_tests.rs

#[tokio::test]
async fn given_valid_user_when_updating_password_then_hash_changes() {
    // Test that password hash updates correctly
}

#[tokio::test]
async fn given_user_with_budgets_when_deleting_then_budgets_cascade() {
    // Test that CASCADE works via repository
}
```

**Dependencies**: Phase 1 (CASCADE constraints)

---

### Phase 3: Backend Models & Handlers

**Goal**: Create API endpoints for password change and account deletion.

**Files to Modify**:
- `backend/src/models/auth.rs` (add request/response models)
- `backend/src/main.rs` (add handlers and routes)

**Tasks**:
1. Add `ChangePasswordRequest`, `ChangePasswordResponse` structs to auth.rs
2. Add `DeleteAccountResponse`, `DeletedItemsSummary` structs to auth.rs
3. Implement `change_user_password` handler in main.rs
4. Implement `delete_user_account` handler in main.rs
5. Add routes to `protected_routes` in main.rs
6. Test endpoints with curl or Postman
7. Write integration tests for both endpoints

**Acceptance Criteria**:
- [ ] Models compile without errors
- [ ] Password change endpoint validates current password
- [ ] Password change endpoint invalidates JWT cache
- [ ] Account deletion endpoint disconnects all connections
- [ ] Account deletion endpoint returns summary of deleted items
- [ ] Both endpoints return appropriate error codes (401, 404, 500)
- [ ] Cache invalidation occurs on both operations

**Testing**:
```bash
# Test password change
curl -X PUT http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"old","new_password":"newpass123"}'

# Test account deletion
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Authorization: Bearer $TOKEN"
```

**Integration Tests**:
```rust
// backend/src/tests/auth_handlers_tests.rs

#[tokio::test]
async fn given_invalid_password_when_changing_password_then_returns_401() {}

#[tokio::test]
async fn given_valid_password_when_changing_password_then_returns_200() {}

#[tokio::test]
async fn given_user_with_connections_when_deleting_account_then_cleans_all_data() {}
```

**Dependencies**: Phase 2 (repository methods)

---

### Phase 4: Frontend Service Layer

**Goal**: Create service to communicate with backend settings endpoints.

**Files to Create**:
- `frontend/src/services/SettingsService.ts`

**Tasks**:
1. Create SettingsService.ts with TypeScript interfaces
2. Implement `changePassword` static method using ApiClient
3. Implement `deleteAccount` static method using ApiClient
4. Export interfaces for use in components
5. Write service tests
6. Run tests and verify they pass

**Acceptance Criteria**:
- [ ] Service follows existing pattern (static methods, uses ApiClient)
- [ ] TypeScript interfaces match backend models
- [ ] Methods handle errors properly
- [ ] Service tests pass
- [ ] No ESLint or TypeScript errors

**Testing**:
```typescript
// frontend/src/services/__tests__/SettingsService.test.ts

describe('SettingsService', () => {
  it('sends PUT request with correct payload for password change', async () => {
    // Mock ApiClient.put
    // Call changePassword
    // Verify request payload
  })

  it('sends DELETE request for account deletion', async () => {
    // Mock ApiClient.delete
    // Call deleteAccount
    // Verify endpoint called
  })

  it('handles network errors gracefully', async () => {
    // Mock ApiClient to throw error
    // Expect error to propagate
  })
})
```

**Dependencies**: Phase 3 (backend endpoints)

---

### Phase 5: Frontend UI - Password Change

**Goal**: Create SettingsPage with password change functionality only.

**Files to Create**:
- `frontend/src/pages/SettingsPage.tsx` (partial implementation)

**Tasks**:
1. Create SettingsPage component with page header
2. Implement password change section only (in GlassCard)
3. Add form state management (current, new, confirm passwords)
4. Implement client-side validation (length, match)
5. Add success/error message display
6. Call SettingsService.changePassword on submit
7. Trigger logout after successful password change
8. Write component tests for password change flow
9. Test manually in browser

**Acceptance Criteria**:
- [ ] Page renders with proper layout (max-w-2xl, centered)
- [ ] Uses primitives (GlassCard, Input, FormLabel, Button)
- [ ] Validates password length (min 8 characters)
- [ ] Validates password confirmation match
- [ ] Shows error messages on validation failure
- [ ] Shows success message after password change
- [ ] Redirects to login after 2 seconds on success
- [ ] Component tests pass
- [ ] No ESLint violations (max 5 utilities per className)

**Testing**:
```typescript
// frontend/src/pages/__tests__/SettingsPage.test.tsx

describe('SettingsPage - Password Change', () => {
  it('validates password length', () => {
    // Render component
    // Enter password < 8 characters
    // Submit form
    // Expect error message
  })

  it('validates password confirmation match', () => {
    // Enter mismatched passwords
    // Submit form
    // Expect error message
  })

  it('calls SettingsService.changePassword on valid submit', async () => {
    // Mock SettingsService.changePassword
    // Fill form with valid data
    // Submit
    // Verify service called with correct args
  })

  it('triggers logout after successful password change', async () => {
    // Mock successful response
    // Submit form
    // Wait for timeout
    // Verify onLogout called
  })
})
```

**Manual Testing**:
- Test with invalid current password
- Test with password < 8 characters
- Test with mismatched confirmation
- Test successful password change (verify logout happens)

**Dependencies**: Phase 4 (SettingsService)

---

### Phase 6: Frontend UI - Account Deletion

**Goal**: Add account deletion section and confirmation modal to SettingsPage.

**Files to Modify**:
- `frontend/src/pages/SettingsPage.tsx` (complete implementation)

**Tasks**:
1. Add "Danger Zone" section to SettingsPage
2. Add delete account button
3. Implement confirmation modal with Modal primitive
4. Add "DELETE" text confirmation input
5. Implement modal state management
6. Call SettingsService.deleteAccount on confirmation
7. Trigger logout after successful deletion
8. Write component tests for deletion flow
9. Test manually in browser

**Acceptance Criteria**:
- [ ] Danger Zone section has red border and warning text
- [ ] Delete button opens confirmation modal
- [ ] Modal shows warning about permanent deletion
- [ ] Modal requires typing "DELETE" to enable confirm button
- [ ] Invalid confirmation text shows invalid input variant
- [ ] Successful deletion triggers logout immediately
- [ ] Error messages display properly in modal
- [ ] Component tests pass for deletion flow
- [ ] Modal cannot be closed during deletion (loading state)

**Testing**:
```typescript
// frontend/src/pages/__tests__/SettingsPage.test.tsx

describe('SettingsPage - Account Deletion', () => {
  it('opens modal when delete button clicked', () => {
    // Render component
    // Click delete button
    // Expect modal to be visible
  })

  it('requires "DELETE" confirmation text', () => {
    // Open modal
    // Enter incorrect text
    // Expect confirm button disabled
  })

  it('calls SettingsService.deleteAccount on confirmation', async () => {
    // Mock deleteAccount
    // Open modal, enter "DELETE", confirm
    // Verify service called
  })

  it('triggers logout after successful deletion', async () => {
    // Mock successful deletion
    // Complete deletion flow
    // Verify onLogout called
  })

  it('shows error message on deletion failure', async () => {
    // Mock service to throw error
    // Attempt deletion
    // Expect error displayed in modal
  })
})
```

**Manual Testing**:
- Test modal open/close
- Test with incorrect confirmation text
- Test canceling deletion
- Test successful deletion (verify logout and redirect)
- Test deletion with active connections

**Dependencies**: Phase 5 (SettingsPage foundation)

---

### Phase 7: Integration & Polish

**Goal**: Wire up Settings tab in navigation and complete end-to-end testing.

**Files to Modify**:
- `frontend/src/ui/primitives/AppTitleBar.tsx`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/components/AuthenticatedApp.tsx`

**Tasks**:
1. Update `TabKey` type in all three files to include 'settings'
2. Add Settings to TABS array in AppTitleBar.tsx
3. Add SettingsPage route in AuthenticatedApp.tsx
4. Import SettingsPage component
5. Test navigation to Settings tab
6. Run full E2E test suite
7. Test in both light and dark modes
8. Polish UI spacing and alignment
9. Test on mobile viewport

**Acceptance Criteria**:
- [ ] Settings tab appears in navigation bar
- [ ] Clicking Settings tab navigates to SettingsPage
- [ ] Settings tab shows active state when selected
- [ ] Page transitions smoothly (AnimatePresence)
- [ ] All TypeScript errors resolved
- [ ] All ESLint warnings resolved
- [ ] Works in light and dark modes
- [ ] Responsive on mobile/tablet/desktop
- [ ] Full E2E test passes

**E2E Testing Checklist**:
```bash
# 1. Start full stack
docker compose up -d --build

# 2. Navigate to http://localhost:8080

# 3. Login with E2E credentials
#    Email: me@test.com
#    Password: Test1234!

# 4. Navigate to Settings tab

# 5. Test Password Change
- [ ] Enter current password incorrectly → see error
- [ ] Enter new password < 8 chars → see validation error
- [ ] Enter mismatched confirmation → see validation error
- [ ] Successfully change password → see success message → logged out
- [ ] Login with new password → works
- [ ] Change password back to original

# 6. Test Account Deletion (use test account, not E2E account!)
- [ ] Create new test account via registration
- [ ] Add bank connection (Plaid sandbox)
- [ ] Create a budget
- [ ] Navigate to Settings → Danger Zone
- [ ] Click Delete Account → modal opens
- [ ] Type "DELET" → confirm button disabled
- [ ] Type "DELETE" → confirm button enabled
- [ ] Cancel → modal closes
- [ ] Re-open modal and confirm deletion
- [ ] Verify logged out and redirected to login
- [ ] Attempt to login with deleted account → fails
- [ ] Verify data deleted in database (transactions, accounts, budgets, connections)
```

**Dependencies**: Phase 6 (complete SettingsPage)

---

## Reference Materials

### Security Considerations

#### RLS Impact on Password Changes

**Key Point**: Password changes do NOT affect RLS directly.

- RLS policies use `user_id` (UUID), not password
- Changing password does not change `user_id`
- RLS enforcement continues to work identically

**However, JWT tokens MUST be invalidated:**
- Prevents session hijacking with old password
- Forces re-authentication with new password
- Clears all cached JWT tokens in Redis

#### Cache Invalidation Strategy

**On Password Change:**
```rust
state.cache_service.invalidate_pattern(&format!("{}_*", auth_context.jwt_id)).await
```
- Invalidates all cache entries for current JWT session
- User must re-login to get new JWT
- New JWT will have different `jti` (JWT ID)

**On Account Deletion:**
```rust
state.cache_service.invalidate_pattern(&format!("{}_*", auth_context.jwt_id)).await
```
- Clears all JWT-scoped cache entries
- Clears access tokens, bank connections, balances
- No orphaned cache data remains

#### Data Deletion Flow

1. **Get all provider connections** for user
2. **Disconnect each connection** using `disconnect_connection_by_id`:
   - Deletes provider transactions
   - Deletes provider accounts
   - Deletes provider credentials
   - Deletes provider connection record
   - Clears connection-specific cache
3. **Count budgets** (for summary response)
4. **Delete user record** - triggers CASCADE:
   - `accounts` table: CASCADE delete
   - `transactions` table: CASCADE delete
   - `plaid_connections` table: CASCADE delete
   - `plaid_credentials` table: CASCADE delete
   - `budgets` table: CASCADE delete (after migration 022)
5. **Clear all JWT cache** for user session
6. **Return summary** of deleted items

#### CASCADE Constraints Verification

Ensure all tables have CASCADE on `user_id`:
- ✅ `accounts` (migration 007)
- ✅ `transactions` (migration 007)
- ✅ `plaid_connections` (migration 007)
- ✅ `plaid_credentials` (migration 007)
- ⚠️ `budgets` (needs migration 022)

---

### UI Design Specifications

#### Layout Structure

```
GradientShell (background)
└── AppLayout (header + footer + content area)
    └── SettingsPage
        ├── Page Header (title + description)
        └── Settings Sections (flex column, gap-6)
            ├── GlassCard: Password Change
            │   ├── Section title
            │   ├── Success/error messages
            │   └── Form (3 inputs + submit button)
            └── GlassCard: Account Deletion (danger border)
                ├── Danger Zone title (red text)
                ├── Warning description
                └── Delete Account button (danger variant)

Modal (when deleting)
└── GlassCard variant="auth"
    ├── Modal title
    ├── Warning box (red background)
    ├── Confirmation input (type "DELETE")
    └── Action buttons (Cancel + Delete Forever)
```

#### Primitive Usage

| Element | Primitive | Variant/Props |
|---------|-----------|---------------|
| Page container | div | max-w-2xl mx-auto |
| Section cards | GlassCard | variant="default", padding="lg" |
| Danger card | GlassCard | variant="default", padding="lg", custom border classes |
| Form inputs | Input | variant="default" or "invalid" |
| Labels | FormLabel | Default |
| Primary button | Button | variant="primary" |
| Delete button | Button | variant="danger" |
| Cancel button | Button | variant="ghost" |
| Confirmation modal | Modal | size="md" |
| Modal content | GlassCard | variant="auth", padding="lg" |

#### Color Scheme

**Normal State:**
- Text: `text-slate-900 dark:text-slate-100`
- Muted: `text-slate-600 dark:text-slate-400`
- Hint: `text-slate-500 dark:text-slate-400`

**Success State:**
- Background: `bg-green-50 dark:bg-green-900/20`
- Text: `text-green-600 dark:text-green-400`

**Error State:**
- Background: `bg-red-50 dark:bg-red-900/20`
- Text: `text-red-600 dark:text-red-400`

**Danger Zone:**
- Border: `border-red-200 dark:border-red-800`
- Title: `text-red-600 dark:text-red-400`

---

### API Endpoints

**PUT /api/auth/change-password**
- Request: `{ current_password: string, new_password: string }`
- Response: `{ message: string, requires_reauth: boolean }`
- Auth: Required (JWT)
- Side effects: Invalidates JWT cache, updates password hash

**DELETE /api/auth/account**
- Request: None (user inferred from JWT)
- Response: `{ message: string, deleted_items: { connections, transactions, accounts, budgets } }`
- Auth: Required (JWT)
- Side effects: Deletes user + all related data, clears cache

---

## Appendix A: Complete Code Snippets

### Migration 022

**File**: `backend/migrations/022_add_budgets_cascade.sql`

```sql
-- Migration: Add CASCADE constraint for budgets table
-- This ensures budgets are automatically deleted when a user is deleted

ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS budgets_user_id_fkey,
  ADD CONSTRAINT budgets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Note: This completes the CASCADE constraint coverage for user deletion.
-- All user-related data (transactions, accounts, connections, credentials, budgets)
-- will now be automatically cleaned up when a user is deleted.
```

### Backend Models

**File**: `backend/src/models/auth.rs`

Add these structs:

```rust
#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Serialize)]
pub struct ChangePasswordResponse {
    pub message: String,
    pub requires_reauth: bool,
}

#[derive(Serialize)]
pub struct DeleteAccountResponse {
    pub message: String,
    pub deleted_items: DeletedItemsSummary,
}

#[derive(Serialize)]
pub struct DeletedItemsSummary {
    pub connections: i32,
    pub transactions: i32,
    pub accounts: i32,
    pub budgets: i32,
}
```

### Repository Methods

**File**: `backend/src/services/repository_service.rs`

Add to `DatabaseRepository` trait:

```rust
async fn update_user_password(&self, user_id: &Uuid, new_password_hash: &str) -> Result<()>;
async fn delete_user(&self, user_id: &Uuid) -> Result<()>;
```

Add to `PostgresRepository` impl:

```rust
async fn update_user_password(&self, user_id: &Uuid, new_password_hash: &str) -> Result<()> {
    let mut tx = self.pool.begin().await?;

    sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
        .bind(user_id.to_string())
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2"
    )
    .bind(new_password_hash)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

async fn delete_user(&self, user_id: &Uuid) -> Result<()> {
    let mut tx = self.pool.begin().await?;

    sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
        .bind(user_id.to_string())
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}
```

### Backend Handlers

**File**: `backend/src/main.rs`

Add these handlers:

```rust
async fn change_user_password(
    State(state): State<AppState>,
    auth_context: AuthContext,
    Json(req): Json<auth_models::ChangePasswordRequest>,
) -> Result<Json<auth_models::ChangePasswordResponse>, StatusCode> {
    let user_id = Uuid::parse_str(&auth_context.user_id.to_string())
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let user = state
        .db_repository
        .get_user_by_id(&user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let is_valid = state
        .auth_service
        .verify_password(&req.current_password, &user.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !is_valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let new_hash = state
        .auth_service
        .hash_password(&req.new_password)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    state
        .db_repository
        .update_user_password(&user_id, &new_hash)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Err(e) = state
        .cache_service
        .invalidate_pattern(&format!("{}_*", auth_context.jwt_id))
        .await
    {
        tracing::warn!(
            "Failed to invalidate JWT cache for user {} after password change: {}",
            user_id,
            e
        );
    }

    Ok(Json(auth_models::ChangePasswordResponse {
        message: "Password changed successfully. Please log in again.".to_string(),
        requires_reauth: true,
    }))
}

async fn delete_user_account(
    State(state): State<AppState>,
    auth_context: AuthContext,
) -> Result<Json<auth_models::DeleteAccountResponse>, StatusCode> {
    let user_id = Uuid::parse_str(&auth_context.user_id.to_string())
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let connections = state
        .db_repository
        .get_all_provider_connections_by_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get connections for user {}: {}", user_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut deleted_connections = 0;
    let mut deleted_transactions = 0;
    let mut deleted_accounts = 0;

    for connection in connections {
        match state
            .connection_service
            .disconnect_connection_by_id(&connection.id, &user_id, &auth_context.jwt_id)
            .await
        {
            Ok(result) => {
                if result.success {
                    deleted_connections += 1;
                    deleted_transactions += result.data_cleared.transactions;
                    deleted_accounts += result.data_cleared.accounts;
                }
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to disconnect connection {} for user {}: {}",
                    connection.id,
                    user_id,
                    e
                );
            }
        }
    }

    let budgets = state
        .db_repository
        .get_budgets_for_user(user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let deleted_budgets = budgets.len() as i32;

    state
        .db_repository
        .delete_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete user {}: {}", user_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if let Err(e) = state
        .cache_service
        .invalidate_pattern(&format!("{}_*", auth_context.jwt_id))
        .await
    {
        tracing::warn!(
            "Failed to invalidate cache for deleted user {}: {}",
            user_id,
            e
        );
    }

    Ok(Json(auth_models::DeleteAccountResponse {
        message: "Account deleted successfully".to_string(),
        deleted_items: auth_models::DeletedItemsSummary {
            connections: deleted_connections,
            transactions: deleted_transactions,
            accounts: deleted_accounts,
            budgets: deleted_budgets,
        },
    }))
}
```

Add to `protected_routes`:

```rust
.route("/api/auth/change-password", put(change_user_password))
.route("/api/auth/account", delete(delete_user_account))
```

### Frontend Service

**File**: `frontend/src/services/SettingsService.ts`

```typescript
import { ApiClient } from './ApiClient'

interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

interface ChangePasswordResponse {
  message: string
  requires_reauth: boolean
}

interface DeletedItemsSummary {
  connections: number
  transactions: number
  accounts: number
  budgets: number
}

interface DeleteAccountResponse {
  message: string
  deleted_items: DeletedItemsSummary
}

export class SettingsService {
  static async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResponse> {
    return ApiClient.put<ChangePasswordResponse>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  }

  static async deleteAccount(): Promise<DeleteAccountResponse> {
    return ApiClient.delete<DeleteAccountResponse>('/auth/account')
  }
}
```

### Frontend Component

**File**: `frontend/src/pages/SettingsPage.tsx`

```typescript
import { useState } from 'react'
import { GlassCard, Button, Input, FormLabel, Modal } from '@/ui/primitives'
import { cn } from '@/ui/primitives'
import { SettingsService } from '../services/SettingsService'
import { AuthService } from '../services/AuthService'

interface SettingsPageProps {
  onLogout?: () => void
}

export default function SettingsPage({ onLogout }: SettingsPageProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setIsChangingPassword(true)

    try {
      const response = await SettingsService.changePassword(currentPassword, newPassword)
      setPasswordSuccess(response.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        AuthService.clearToken()
        if (onLogout) onLogout()
      }, 2000)
    } catch (error) {
      if (error instanceof Error) {
        setPasswordError(error.message)
      } else {
        setPasswordError('Failed to change password')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await SettingsService.deleteAccount()
      AuthService.clearToken()
      if (onLogout) onLogout()
    } catch (error) {
      if (error instanceof Error) {
        setDeleteError(error.message)
      } else {
        setDeleteError('Failed to delete account')
      }
      setIsDeleting(false)
    }
  }

  return (
    <div className={cn('max-w-2xl', 'mx-auto')}>
      <div className={cn('mb-6')}>
        <h1 className={cn('text-2xl', 'font-semibold', 'text-slate-900', 'dark:text-slate-100')}>
          Settings
        </h1>
        <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-400', 'mt-1')}>
          Manage your account preferences
        </p>
      </div>

      <div className={cn('flex', 'flex-col', 'gap-6')}>
        <GlassCard variant="default" padding="lg">
          <h2 className={cn('text-lg', 'font-semibold', 'mb-4', 'text-slate-900', 'dark:text-slate-100')}>
            Change Password
          </h2>

          {passwordSuccess && (
            <div className={cn('mb-4', 'p-3', 'rounded-lg', 'bg-green-50', 'dark:bg-green-900/20')}>
              <p className={cn('text-sm', 'text-green-600', 'dark:text-green-400')}>
                {passwordSuccess}
              </p>
            </div>
          )}

          {passwordError && (
            <div className={cn('mb-4', 'p-3', 'rounded-lg', 'bg-red-50', 'dark:bg-red-900/20')}>
              <p className={cn('text-sm', 'text-red-600', 'dark:text-red-400')}>
                {passwordError}
              </p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className={cn('space-y-4')}>
            <div>
              <FormLabel htmlFor="current-password">Current Password</FormLabel>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={isChangingPassword}
                variant="default"
              />
            </div>

            <div>
              <FormLabel htmlFor="new-password">New Password</FormLabel>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isChangingPassword}
                variant="default"
              />
              <p className={cn('mt-1', 'text-xs', 'text-slate-500', 'dark:text-slate-400')}>
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <FormLabel htmlFor="confirm-password">Confirm New Password</FormLabel>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isChangingPassword}
                variant="default"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className={cn('w-full')}
            >
              {isChangingPassword ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </GlassCard>

        <GlassCard
          variant="default"
          padding="lg"
          className={cn('border-red-200', 'dark:border-red-800')}
        >
          <h2 className={cn('text-lg', 'font-semibold', 'mb-2', 'text-red-600', 'dark:text-red-400')}>
            Danger Zone
          </h2>
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-400', 'mb-4')}>
            Once you delete your account, there is no going back. This action cannot be undone.
          </p>

          <Button
            type="button"
            variant="danger"
            onClick={() => setShowDeleteModal(true)}
            className={cn('w-full')}
          >
            Delete Account
          </Button>
        </GlassCard>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setConfirmText('')
          setDeleteError(null)
        }}
        size="md"
        preventCloseOnBackdrop={isDeleting}
      >
        <GlassCard variant="auth" padding="lg">
          <h2 className={cn('text-xl', 'font-semibold', 'mb-4', 'text-slate-900', 'dark:text-slate-100')}>
            Delete Account?
          </h2>

          <div className={cn('mb-6', 'p-4', 'rounded-lg', 'bg-red-50', 'dark:bg-red-900/20')}>
            <p className={cn('text-sm', 'font-medium', 'text-red-600', 'dark:text-red-400', 'mb-2')}>
              This will permanently delete:
            </p>
            <ul className={cn('space-y-1', 'text-xs', 'text-red-600', 'dark:text-red-400')}>
              <li>• All bank connections (Plaid/Teller)</li>
              <li>• All transactions and accounts</li>
              <li>• All budgets and settings</li>
              <li>• Your user account and login credentials</li>
            </ul>
          </div>

          {deleteError && (
            <div className={cn('mb-4', 'p-3', 'rounded-lg', 'bg-red-50', 'dark:bg-red-900/20')}>
              <p className={cn('text-sm', 'text-red-600', 'dark:text-red-400')}>
                {deleteError}
              </p>
            </div>
          )}

          <div className={cn('mb-6')}>
            <FormLabel htmlFor="confirm-delete">
              Type <span className={cn('font-mono', 'font-bold')}>DELETE</span> to confirm
            </FormLabel>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={isDeleting}
              variant={confirmText && confirmText !== 'DELETE' ? 'invalid' : 'default'}
            />
          </div>

          <div className={cn('flex', 'gap-3')}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowDeleteModal(false)
                setConfirmText('')
                setDeleteError(null)
              }}
              disabled={isDeleting}
              className={cn('flex-1')}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={confirmText !== 'DELETE' || isDeleting}
              className={cn('flex-1')}
            >
              {isDeleting ? 'Deleting...' : 'Delete Forever'}
            </Button>
          </div>
        </GlassCard>
      </Modal>
    </div>
  )
}
```

### Routing Updates

**File**: `frontend/src/components/AuthenticatedApp.tsx`

```typescript
type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings'

import SettingsPage from '../pages/SettingsPage'

{tab === 'settings' && <SettingsPage onLogout={onLogout} />}
```

**File**: `frontend/src/ui/primitives/AppTitleBar.tsx`

```typescript
type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'settings', label: 'Settings' },
]
```

**File**: `frontend/src/layouts/AppLayout.tsx`

```typescript
type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings'
```

---

## Notes

- Password validation can be extended (uppercase, numbers, symbols) in future
- Consider adding email confirmation for account deletion in production
- Consider adding password reset via email flow separately
- Settings page could be extended with: email changes, notification preferences, export data, etc.
- All primitives support light/dark mode automatically via Tailwind classes
