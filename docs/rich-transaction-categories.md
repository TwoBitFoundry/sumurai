# Rich Transaction Categories for Teller and Plaid

## Context

Currently, Teller transactions only map 3 category values (`general`, `service`, and a catch-all `OTHER`), discarding the 28 categories Teller actually provides. `category_detailed` and `category_confidence` are left as empty strings. Meanwhile, `Transaction::from_plaid()` reads from the **legacy** `category` array instead of the `personal_finance_category` PFC object, while `plaid_service.rs` correctly reads PFC fields but duplicates all the construction logic inline. This change expands Teller to a full 28-category mapping with inferred detailed categories (using the Plaid PFCv1 taxonomy as the normalized schema), fixes the Plaid path to read PFC fields, and consolidates the duplicated Plaid transaction construction. Forward-only — no migration of existing data.

## Validation Summary

- **Teller**: All 28 `details.category` values confirmed against Teller API docs: `accommodation`, `advertising`, `bar`, `charity`, `clothing`, `dining`, `education`, `electronics`, `entertainment`, `fuel`, `general`, `groceries`, `health`, `home`, `income`, `insurance`, `investment`, `loan`, `office`, `phone`, `service`, `shopping`, `software`, `sport`, `tax`, `transport`, `transportation`, `utilities`. Category is nullable.
- **Plaid PFCv1**: All 16 primary categories and 105 detailed values confirmed against the [PFC taxonomy CSV](https://plaid.com/documents/pfc-taxonomy-all.csv). Confidence levels: `VERY_HIGH`, `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`.
- **All proposed detailed category values are valid PFCv1 entries.**
- **Existing bug**: Test fixture at `test_fixtures.rs:590` uses `FOOD_AND_DRINK_RESTAURANTS` (plural) — correct PFCv1 value is `FOOD_AND_DRINK_RESTAURANT` (singular).

## Default behavior

- Teller `"general"` → `GENERAL_MERCHANDISE` (provider categorized it)
- Teller `null`/missing/unrecognized → `OTHER` / `OTHER` (uncategorized)
- Plaid missing `personal_finance_category` → `OTHER` (uncategorized)
- Plaid present PFC but missing `confidence_level` → default `"MEDIUM"`
- Plaid present PFC but missing `detailed` → falls back to `primary` value

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/models/transaction.rs` | Expand `normalize_teller_category` → full mapping returning `(primary, detailed)`; update `from_teller` to populate `category_detailed`; rewrite `from_plaid` to read PFC fields |
| `backend/src/services/plaid_service.rs` | Replace inline transaction construction with `Transaction::from_plaid()` call |
| `backend/src/tests/teller_model_tests.rs` | Add tests for expanded Teller category mapping |
| `backend/src/tests/plaid_service_tests.rs` | Update tests to reflect `from_plaid()` consolidation |
| `backend/src/tests/test_fixtures.rs` | Fix `FOOD_AND_DRINK_RESTAURANTS` → `FOOD_AND_DRINK_RESTAURANT`; add Teller fixtures for new category values |

No frontend changes needed — `formatCategoryName` (in `frontend/src/utils/categories.ts`) already handles `UPPER_SNAKE_CASE` → title case generically, and `TransactionTransformer` (in `frontend/src/domain/TransactionTransformer.ts`) already passes through `category_detailed` and `category_confidence`.

---

## Phase 1: Expand Teller category mapping

**Goal**: Replace the 3-value `normalize_teller_category` function with a complete 28-category mapping that returns both `category_primary` and `category_detailed`.

**File**: `backend/src/models/transaction.rs`

### What to change

1. **Change the signature** of `normalize_teller_category` (currently at lines 416-423):
   - Old: `fn normalize_teller_category(teller_cat: &str) -> String`
   - New: `fn normalize_teller_category(teller_cat: &str, amount: &Decimal) -> (String, String)`
   - The `amount` parameter is the **raw signed** Decimal (before `.abs()`) — needed for `investment` direction detection.
   - Returns `(category_primary, category_detailed)` as owned `String` values.

2. **Replace the match body** with the full mapping. Every arm returns a `(&str, &str)` tuple that gets converted to `(String, String)`:

```rust
fn normalize_teller_category(teller_cat: &str, amount: &Decimal) -> (String, String) {
    let (primary, detailed) = match teller_cat {
        "accommodation"   => ("TRAVEL",                    "TRAVEL_LODGING"),
        "advertising"     => ("GENERAL_SERVICES",          "GENERAL_SERVICES_CONSULTING_AND_LEGAL"),
        "bar"             => ("ENTERTAINMENT",             "ENTERTAINMENT_OTHER_ENTERTAINMENT"),
        "charity"         => ("GOVERNMENT_AND_NON_PROFIT", "GOVERNMENT_AND_NON_PROFIT_DONATIONS"),
        "clothing"        => ("GENERAL_MERCHANDISE",       "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES"),
        "dining"          => ("FOOD_AND_DRINK",            "FOOD_AND_DRINK_RESTAURANT"),
        "education"       => ("GENERAL_SERVICES",          "GENERAL_SERVICES_EDUCATION"),
        "electronics"     => ("GENERAL_MERCHANDISE",       "GENERAL_MERCHANDISE_ELECTRONICS"),
        "entertainment"   => ("ENTERTAINMENT",             "ENTERTAINMENT_OTHER_ENTERTAINMENT"),
        "fuel"            => ("TRANSPORTATION",            "TRANSPORTATION_GAS"),
        "general"         => ("GENERAL_MERCHANDISE",       "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE"),
        "groceries"       => ("FOOD_AND_DRINK",            "FOOD_AND_DRINK_GROCERIES"),
        "health"          => ("MEDICAL",                   "MEDICAL_OTHER_MEDICAL"),
        "home"            => ("HOME_IMPROVEMENT",          "HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT"),
        "income"          => ("INCOME",                    "INCOME_WAGES"),
        "insurance"       => ("GENERAL_SERVICES",          "GENERAL_SERVICES_INSURANCE"),
        "investment" if !amount.is_sign_negative() => ("TRANSFER_IN",  "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS"),
        "investment"      => ("TRANSFER_OUT",              "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS"),
        "loan"            => ("LOAN_PAYMENTS",             "LOAN_PAYMENTS_OTHER_PAYMENT"),
        "office"          => ("GENERAL_MERCHANDISE",       "GENERAL_MERCHANDISE_OFFICE_SUPPLIES"),
        "phone"           => ("RENT_AND_UTILITIES",        "RENT_AND_UTILITIES_TELEPHONE"),
        "service"         => ("GENERAL_SERVICES",          "GENERAL_SERVICES_OTHER_GENERAL_SERVICES"),
        "shopping"        => ("GENERAL_MERCHANDISE",       "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE"),
        "software"        => ("GENERAL_MERCHANDISE",       "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES"),
        "sport"           => ("PERSONAL_CARE",             "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS"),
        "tax"             => ("GOVERNMENT_AND_NON_PROFIT", "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT"),
        "transport" | "transportation" => ("TRANSPORTATION", "TRANSPORTATION_OTHER_TRANSPORTATION"),
        "utilities"       => ("RENT_AND_UTILITIES",        "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY"),
        _                 => ("OTHER",                     "OTHER"),
    };
    (primary.to_string(), detailed.to_string())
}
```

3. **Update `from_teller`** (currently at lines 313-348) to use the new function:
   - Parse the raw signed amount FIRST: `let raw_amount = Decimal::from_str(amount_str).unwrap_or(Decimal::ZERO);`
   - Extract category: `let category = teller_txn["details"]["category"].as_str().unwrap_or("");` — note: default changes from `"general"` to `""` so missing categories hit the `_` wildcard → `OTHER`
   - Call mapping: `let (category_primary, category_detailed) = Self::normalize_teller_category(category, &raw_amount);`
   - Apply abs AFTER: `let amount = raw_amount.abs();`
   - Set `category_primary` and `category_detailed` from the destructured tuple
   - `category_confidence` stays as `String::new()` (Teller doesn't provide confidence)

### Acceptance criteria

- [x] `normalize_teller_category` accepts `(teller_cat: &str, amount: &Decimal)` and returns `(String, String)`
- [x] All 28 Teller categories are covered by named match arms (count: `accommodation`, `advertising`, `bar`, `charity`, `clothing`, `dining`, `education`, `electronics`, `entertainment`, `fuel`, `general`, `groceries`, `health`, `home`, `income`, `insurance`, `investment` x2, `loan`, `office`, `phone`, `service`, `shopping`, `software`, `sport`, `tax`, `transport|transportation`, `utilities`)
- [x] `_` wildcard returns `("OTHER", "OTHER")`
- [x] `investment` with non-negative amount → `TRANSFER_IN` / `TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS`
- [x] `investment` with negative amount → `TRANSFER_OUT` / `TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS`
- [x] `from_teller` reads raw signed amount before `.abs()` and passes it to the mapping function
- [x] `from_teller` null/missing category defaults to `""` (not `"general"`), hitting the `_` → `OTHER` fallback
- [x] `from_teller` populates both `category_primary` and `category_detailed` from the mapping
- [x] `from_teller` still sets `category_confidence: String::new()` (empty)
- [x] `cargo build` succeeds (ignore test failures — tests updated in Phase 4)

### TDD log

- `cargo test --manifest-path backend/Cargo.toml teller_model_tests -- --nocapture` failed before the implementation change, then passed after the Teller mapper update.
- `cargo build --manifest-path backend/Cargo.toml` passed after the model update.

---

## Phase 2: Fix `from_plaid` to read PFC fields

**Goal**: Rewrite `Transaction::from_plaid()` to read from `personal_finance_category` object instead of the deprecated `category` array. This aligns it with the logic already in `plaid_service.rs`.

**File**: `backend/src/models/transaction.rs`

### What to change

Replace the category extraction block in `from_plaid` (currently lines 382-393) which reads:

```rust
// CURRENT (wrong — reads legacy category array)
let categories = plaid_txn["category"].as_array();
let category_primary = categories
    .and_then(|arr| arr.first())
    .and_then(|v| v.as_str())
    .unwrap_or("OTHER")
    .to_string();
let category_detailed = categories
    .and_then(|arr| arr.get(1))
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
```

With PFC field extraction:

```rust
// NEW (reads personal_finance_category object)
let pfc = plaid_txn.get("personal_finance_category");

let category_primary = pfc
    .and_then(|p| p.get("primary"))
    .and_then(|v| v.as_str())
    .unwrap_or("OTHER")
    .to_string();

let category_detailed = pfc
    .and_then(|p| p.get("detailed"))
    .and_then(|v| v.as_str())
    .unwrap_or(&category_primary)
    .to_string();
```

Also update the `category_confidence` extraction (currently lines 406-409) to default to `"MEDIUM"` instead of empty string when PFC exists:

```rust
// NEW
category_confidence: pfc
    .and_then(|p| p.get("confidence_level"))
    .and_then(|v| v.as_str())
    .unwrap_or("MEDIUM")
    .to_string(),
```

### Acceptance criteria

- [x] `from_plaid` reads `category_primary` from `personal_finance_category.primary` (not `category[0]`)
- [x] `from_plaid` reads `category_detailed` from `personal_finance_category.detailed` (not `category[1]`)
- [x] When `personal_finance_category` is missing entirely: `category_primary = "OTHER"`, `category_detailed = "OTHER"`, `category_confidence = "MEDIUM"`
- [x] When `detailed` is missing but `primary` present: `category_detailed` falls back to `category_primary` value
- [x] When `confidence_level` is missing: defaults to `"MEDIUM"`
- [x] No remaining references to `plaid_txn["category"].as_array()` in the function
- [x] `cargo build` succeeds

### TDD log

- `cargo test --manifest-path backend/Cargo.toml plaid_service_tests -- --nocapture` failed before the implementation change, then passed after the Plaid mapper update.
- `cargo build --manifest-path backend/Cargo.toml` passed after the model update.

---

## Phase 3: Consolidate Plaid transaction construction in `plaid_service.rs`

**Goal**: Replace the duplicated inline transaction construction in `plaid_service.rs` with calls to `Transaction::from_plaid()`, eliminating the code duplication.

**File**: `backend/src/services/plaid_service.rs`

### What to change

The current loop at lines 281-344 manually extracts every field and constructs `Transaction { ... }` inline. Replace this with:

```rust
for t in transactions_array {
    transactions.push(Transaction::from_plaid(t, &Uuid::nil()));
}
```

The `Uuid::nil()` for `account_id` matches the current behavior — the sync service reassigns account IDs later (see `sync_service.rs` lines 74-82 where it maps `provider_account_id` to internal `account_id`).

**Important**: `Transaction::from_plaid()` must handle all the fields that the inline code currently handles. Cross-reference:
- `amount`: `from_plaid` uses `plaid_txn["amount"]` ✓
- `date`: `from_plaid` uses `plaid_txn["date"]` ✓
- `provider_transaction_id`: `from_plaid` uses `plaid_txn["transaction_id"]` ✓
- `provider_account_id`: `from_plaid` uses `plaid_txn["account_id"]` ✓
- `merchant_name`: `from_plaid` calls `merchant_name_from_plaid` ✓
- `payment_channel`: `from_plaid` uses `plaid_txn["payment_channel"]` ✓
- `pending`: `from_plaid` uses `plaid_txn["pending"]` ✓
- Category fields: Now handled by Phase 2 changes ✓

### Acceptance criteria

- [ ] The `for t in transactions_array` loop body is reduced to a single `Transaction::from_plaid()` call
- [ ] No more inline field extraction (amount, date, category, etc.) in plaid_service.rs
- [ ] The `Uuid::nil()` account_id pattern is preserved (sync service reassigns later)
- [ ] Pagination logic (`offset`, `batch_len`, break conditions) is NOT changed — only the inner loop body
- [ ] `cargo build` succeeds

---

## Phase 4: Update tests and fixtures

**Goal**: Fix the existing test fixture bug, add test coverage for new Teller categories, and update Plaid test expectations.

**Files**:
- `backend/src/tests/test_fixtures.rs`
- `backend/src/tests/teller_model_tests.rs`
- `backend/src/tests/plaid_service_tests.rs`

### Step 4a: Fix existing bug in `test_fixtures.rs`

At line 590, change `FOOD_AND_DRINK_RESTAURANTS` → `FOOD_AND_DRINK_RESTAURANT` (singular). This is the PFCv1 canonical value.

### Step 4b: Add Teller transaction fixtures in `test_fixtures.rs`

Add new fixture methods following the existing pattern (see `teller_transaction_coffee_shop()` at line 557 for format). Each fixture is a `pub fn` returning `&'static str` with a JSON string. The JSON structure is:

```json
{"id":"txn_xxx","date":"2024-01-15","amount":"-XX.XX","description":"Desc","status":"posted","details":{"category":"<value>","counterparty":{"type":"merchant","name":"Name"}}}
```

Add fixtures for:
- `teller_transaction_dining()` — `"details":{"category":"dining"}`, amount negative
- `teller_transaction_fuel()` — `"details":{"category":"fuel"}`, amount negative
- `teller_transaction_income()` — `"details":{"category":"income"}`, amount positive (e.g. `"1500.00"`)
- `teller_transaction_investment_inflow()` — `"details":{"category":"investment"}`, amount positive (e.g. `"5000.00"`)
- `teller_transaction_investment_outflow()` — `"details":{"category":"investment"}`, amount negative (e.g. `"-5000.00"`)
- `teller_transaction_utilities()` — `"details":{"category":"utilities"}`, amount negative
- `teller_transaction_null_category()` — `"details":{"category":null}` (JSON null, not missing)

### Step 4c: Update `teller_model_tests.rs`

Update existing tests and add new ones. Follow the existing naming convention: `given_<scenario>_when_from_teller_then_<expectation>`.

**Update existing tests:**

1. Test at line 36 (`given_teller_transaction_json_when_from_teller_then_maps_fields_correctly`):
   - Line 57: `category_primary` assertion stays `"GENERAL_MERCHANDISE"` (unchanged)
   - Line 58: Change `category_detailed` assertion from `""` to `"GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE"`
   - Line 59: `category_confidence` assertion stays `""` (unchanged)

2. Test at line 73 (`given_teller_transaction_with_service_category...`):
   - Line 82: `category_primary` assertion stays `"GENERAL_SERVICES"` (unchanged)
   - Add assertion: `category_detailed == "GENERAL_SERVICES_OTHER_GENERAL_SERVICES"`

3. Test at line 85 (`given_teller_transaction_with_unknown_category...`):
   - Line 93: `category_primary` assertion stays `"OTHER"` (unchanged)
   - Add assertion: `category_detailed == "OTHER"`

**Add new tests:**

4. `given_teller_transaction_with_dining_category_when_from_teller_then_maps_to_food_and_drink`:
   - Uses `teller_transaction_dining()` fixture
   - Assert `category_primary == "FOOD_AND_DRINK"`
   - Assert `category_detailed == "FOOD_AND_DRINK_RESTAURANT"`

5. `given_teller_transaction_with_fuel_category_when_from_teller_then_maps_to_transportation`:
   - Uses `teller_transaction_fuel()` fixture
   - Assert `category_primary == "TRANSPORTATION"`
   - Assert `category_detailed == "TRANSPORTATION_GAS"`

6. `given_teller_transaction_with_income_category_when_from_teller_then_maps_to_income`:
   - Uses `teller_transaction_income()` fixture
   - Assert `category_primary == "INCOME"`
   - Assert `category_detailed == "INCOME_WAGES"`

7. `given_teller_transaction_with_investment_inflow_when_from_teller_then_maps_to_transfer_in`:
   - Uses `teller_transaction_investment_inflow()` fixture (positive amount)
   - Assert `category_primary == "TRANSFER_IN"`
   - Assert `category_detailed == "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS"`

8. `given_teller_transaction_with_investment_outflow_when_from_teller_then_maps_to_transfer_out`:
   - Uses `teller_transaction_investment_outflow()` fixture (negative amount)
   - Assert `category_primary == "TRANSFER_OUT"`
   - Assert `category_detailed == "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS"`

9. `given_teller_transaction_with_utilities_category_when_from_teller_then_maps_to_rent_and_utilities`:
   - Uses `teller_transaction_utilities()` fixture
   - Assert `category_primary == "RENT_AND_UTILITIES"`
   - Assert `category_detailed == "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY"`

10. `given_teller_transaction_with_null_category_when_from_teller_then_maps_to_other`:
    - Uses `teller_transaction_null_category()` fixture
    - Assert `category_primary == "OTHER"`
    - Assert `category_detailed == "OTHER"`

### Step 4d: Update `plaid_service_tests.rs`

Two occurrences of the plural bug in this file:

1. At line 26 (inline fixture JSON): change `"detailed": "FOOD_AND_DRINK_RESTAURANTS"` → `"detailed": "FOOD_AND_DRINK_RESTAURANT"`
2. At line 102 (assertion): change `assert_eq!(category_detailed, "FOOD_AND_DRINK_RESTAURANTS")` → `assert_eq!(category_detailed, "FOOD_AND_DRINK_RESTAURANT")`

### Acceptance criteria

- [ ] `FOOD_AND_DRINK_RESTAURANTS` (plural) no longer appears anywhere in the codebase
- [ ] All 7 new Teller fixture methods are added to `test_fixtures.rs`
- [ ] 3 existing teller_model_tests are updated with `category_detailed` assertions
- [ ] 7 new teller_model_tests are added (dining, fuel, income, investment_inflow, investment_outflow, utilities, null_category)
- [ ] Plaid service test assertion updated to singular `FOOD_AND_DRINK_RESTAURANT`
- [ ] `cargo test` passes — all tests green
- [ ] No remaining references to legacy `plaid_txn["category"].as_array()` in the codebase (run: `grep -rn '"category"].as_array' backend/src/`)

---

## Phase 5: Final verification

**Goal**: Confirm everything compiles, all tests pass, and no legacy code remains.

### Steps

1. `cargo build` — clean compilation, no warnings related to these changes
2. `cargo test` — all tests pass
3. `grep -rn '"category"].as_array' backend/src/` — returns no results (legacy Plaid category reading fully removed)
4. Count match arms in `normalize_teller_category`: should be 29 total (28 named Teller categories + 1 `_` wildcard). The `"investment"` category has 2 arms (with guard), and `"transport" | "transportation"` is a single arm.

### Acceptance criteria

- [ ] `cargo build` — no errors
- [ ] `cargo test` — all tests pass
- [ ] No legacy `category` array references remain in Plaid code path
- [ ] Match arm count verified: 29 arms covering all documented Teller categories
