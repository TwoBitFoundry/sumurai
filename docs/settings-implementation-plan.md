# Settings Page Implementation Plan

## Overview

This document provides a comprehensive implementation guide for adding a Settings page to Sumaura, featuring account deletion and password change functionality. The implementation follows existing architecture patterns: static services with dependency injection via ApiClient (frontend) and trait-based DI (backend).

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

## Backend Implementation

### 1. Database Migration

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

**Why Needed**: The budgets table currently lacks CASCADE constraint (see migration 008). This ensures complete data cleanup on user deletion.

### 2. Auth Models

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

### 3. Repository Service

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

### 4. Auth Handlers

**File**: `backend/src/main.rs` (add to existing handlers section)

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

### 5. Routes

**File**: `backend/src/main.rs`

Add to `protected_routes`:

```rust
.route("/api/auth/change-password", put(change_user_password))
.route("/api/auth/account", delete(delete_user_account))
```

## Frontend Implementation

### 1. Settings Service

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

### 2. Settings Page Component

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

### 3. Routing Updates

**File**: `frontend/src/components/AuthenticatedApp.tsx`

Update TabKey type:
```typescript
type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings'
```

Import SettingsPage:
```typescript
import SettingsPage from '../pages/SettingsPage'
```

Add route in AnimatePresence:
```typescript
{tab === 'settings' && <SettingsPage onLogout={onLogout} />}
```

**File**: `frontend/src/ui/primitives/AppTitleBar.tsx`

Update TabKey type:
```typescript
type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings'
```

Update TABS array:
```typescript
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'settings', label: 'Settings' },
]
```

**File**: `frontend/src/layouts/AppLayout.tsx`

Update TabKey type:
```typescript
type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings'
```

## Security Considerations

### RLS Impact on Password Changes

**Key Point**: Password changes do NOT affect RLS directly.

- RLS policies use `user_id` (UUID), not password
- Changing password does not change `user_id`
- RLS enforcement continues to work identically

**However, JWT tokens MUST be invalidated:**
- Prevents session hijacking with old password
- Forces re-authentication with new password
- Clears all cached JWT tokens in Redis

### Cache Invalidation Strategy

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

### Data Deletion Flow

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

### CASCADE Constraints Verification

Ensure all tables have CASCADE on `user_id`:
- ✅ `accounts` (migration 007)
- ✅ `transactions` (migration 007)
- ✅ `plaid_connections` (migration 007)
- ✅ `plaid_credentials` (migration 007)
- ⚠️ `budgets` (needs migration 022)

## UI Design Specifications

### Layout Structure

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

### Primitive Usage

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

### Color Scheme

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

### Responsive Design

- Max width: `max-w-2xl` for comfortable reading
- Padding: Inherited from AppLayout
- Full-width buttons on mobile
- Modal adapts to screen size via Modal primitive

### Accessibility

- All inputs have proper `FormLabel` associations
- Buttons have descriptive text
- Modal has proper ARIA attributes (handled by Modal primitive)
- Disabled states for loading scenarios
- Keyboard navigation supported

## File Checklist

### Files to Create (3)

- [ ] `backend/migrations/022_add_budgets_cascade.sql`
- [ ] `frontend/src/services/SettingsService.ts`
- [ ] `frontend/src/pages/SettingsPage.tsx`

### Files to Modify (6)

- [ ] `backend/src/models/auth.rs` - Add request/response types
- [ ] `backend/src/services/repository_service.rs` - Add trait methods + impl
- [ ] `backend/src/main.rs` - Add handlers + routes
- [ ] `frontend/src/ui/primitives/AppTitleBar.tsx` - Update TabKey + TABS
- [ ] `frontend/src/layouts/AppLayout.tsx` - Update TabKey
- [ ] `frontend/src/components/AuthenticatedApp.tsx` - Update TabKey + add route

### Backend Detailed Changes

**models/auth.rs:**
- Add `ChangePasswordRequest` struct
- Add `ChangePasswordResponse` struct
- Add `DeleteAccountResponse` struct
- Add `DeletedItemsSummary` struct

**services/repository_service.rs:**
- Add `update_user_password` to `DatabaseRepository` trait
- Add `delete_user` to `DatabaseRepository` trait
- Implement both methods in `PostgresRepository`
- Both methods must set RLS context before executing

**main.rs:**
- Add `change_user_password` handler function
- Add `delete_user_account` handler function
- Add `/api/auth/change-password` PUT route to protected_routes
- Add `/api/auth/account` DELETE route to protected_routes

### Frontend Detailed Changes

**services/SettingsService.ts:**
- Static class with two methods
- `changePassword(currentPassword, newPassword)` - PUT request
- `deleteAccount()` - DELETE request
- Use ApiClient for all HTTP requests
- Export TypeScript interfaces

**pages/SettingsPage.tsx:**
- Accept `onLogout` prop (for triggering logout after deletion)
- State management for form inputs and UI states
- Password change form with validation
- Account deletion section with modal
- Success/error message display
- Delegate all API calls to SettingsService

**Routing files:**
- Add 'settings' to TabKey union type
- Add Settings to navigation tabs
- Add SettingsPage route handler

## Testing Strategy

### Backend Tests

**Unit Tests** (`backend/src/tests/`):

```rust
// Test password change
#[tokio::test]
async fn given_valid_current_password_when_changing_password_then_updates_hash() {}

#[tokio::test]
async fn given_invalid_current_password_when_changing_password_then_returns_unauthorized() {}

// Test account deletion
#[tokio::test]
async fn given_user_with_connections_when_deleting_account_then_cleans_up_all_data() {}

#[tokio::test]
async fn given_deleted_user_when_querying_data_then_returns_no_results() {}
```

**Integration Tests**:
- Test CASCADE constraints work correctly
- Verify RLS still functions after password change
- Confirm cache invalidation occurs

### Frontend Tests

**Component Tests** (`frontend/src/pages/__tests__/`):

```typescript
// SettingsPage.test.tsx
describe('SettingsPage', () => {
  it('validates password length', () => {})
  it('validates password confirmation match', () => {})
  it('calls SettingsService.changePassword on submit', () => {})
  it('shows success message after password change', () => {})
  it('requires "DELETE" confirmation for account deletion', () => {})
  it('calls SettingsService.deleteAccount on confirmation', () => {})
  it('triggers onLogout after successful deletion', () => {})
})
```

**Service Tests** (`frontend/src/services/__tests__/`):

```typescript
// SettingsService.test.ts
describe('SettingsService', () => {
  it('sends correct payload for password change', () => {})
  it('handles password change errors', () => {})
  it('sends DELETE request for account deletion', () => {})
})
```

## Implementation Order

1. **Backend Foundation**:
   - Run migration 022 (budgets CASCADE)
   - Add models to auth.rs
   - Add repository methods
   - Add handlers to main.rs
   - Add routes

2. **Backend Testing**:
   - Write and run unit tests
   - Verify CASCADE behavior
   - Test cache invalidation

3. **Frontend Service**:
   - Create SettingsService.ts
   - Write service tests

4. **Frontend UI**:
   - Create SettingsPage.tsx
   - Write component tests
   - Test UI interactions

5. **Frontend Integration**:
   - Update routing files
   - Add Settings tab
   - Test navigation

6. **End-to-End Testing**:
   - Test password change flow
   - Test account deletion flow
   - Verify logout behavior
   - Test with E2E credentials

## API Endpoints Summary

### New Protected Endpoints

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

## Notes

- Password validation can be extended (uppercase, numbers, symbols) in future
- Consider adding email confirmation for account deletion in production
- Consider adding password reset via email flow separately
- Settings page could be extended with: email changes, notification preferences, export data, etc.
- All primitives support light/dark mode automatically via Tailwind classes
