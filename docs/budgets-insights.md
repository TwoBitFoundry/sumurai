# Product Requirements Document (PRD)

## Feature: Contextual Budget Insights & Demystification

### 1. Document Control

- **Status:** Draft
- **Date:** June 5, 2026
- **Target Release:** Q3 2026
- **Related UI Reference:** `image_3af602.jpg` (Budgets page / "Provision the coffers")

### 2. Product Vision & Objective

The "Provision the coffers" (Budgets) page currently displays high-level static metrics at the top (Days Remaining, Monthly Vows, Annualized Vows, Overages), as referenced in `image_3af602.jpg`.

While clean, these top-level cards do not currently leverage the contextual transaction filtering bar (account-level and month-level filters). Furthermore, raw financial metrics can sometimes feel abstract to everyday users.

**Objectives:**

1. **Dynamic Contextuality:** Transform the top-level insight cards into a live utility panel that recalculates instantly when users apply account or month filters.
2. **The "Human Question" Paradigm:** Allow users to click on any insight card to flip/expand it, revealing the direct, plain-English question the math is attempting to answer.
3. **No Dashboard Overlap:** Avoid high-level historical charts (which live on the Dashboard tab) in favor of forward-looking, highly actionable velocity and allocation guardrails.
4. **Value-Tier Separation:** Keep calculations strictly mathematical (utility tier). Complex predictive behaviors (AI-driven anomaly detection) are reserved for the premium paid tier.

### 3. User Experience & The "Human Question" Interaction

To make budgeting feel intuitive and educational, each insight card operates on a **Double-Sided State**:

- **Front State (The Metric):** Standard clean typographic style (matching the design language in `image_3af602.jpg`).
- **Back State (The Demystifier):** Triggered on-click. The card executes a subtle 3D flip or smooth expansion to display the foundational question it answers, along with a brief explanation of how to act on it.

```
+------------------------------------+          +------------------------------------+
|  DAILY PACING                      |  Click   |  WHAT THIS ANSWERS:                |
|  $12.50 / day remaining            | -------> |  "How much can I spend every day   |
|                                    | <------- |   without blowing my budget?"      |
|  Based on $300.00 over 24 days     |  Close   |                                    |
+------------------------------------+          +------------------------------------+


```

### 4. Functional Specifications & Dynamic Metric Formulas

These metrics must adapt seamlessly to the month and account filters selected in the action bar at the bottom of the page (as seen in `image_3af602.jpg`).

#### Card 1: Pacing & Burn Velocity (Dynamic)

- **Default State (No Filters):** Calculates the velocity across all accounts for the selected month.
- **Filtered State (Account Selected):** Isolates the velocity *specifically* for transactions on that payment method.
- **Calculations:**
  $$\text{Daily Pacing} = \frac{\text{Total Budget} - \text{Total Spent so far in Month}}{\text{Days Remaining in Month}}$$
- **The "Human Question" Interaction (Back of Card):**
  - **Question:** *"How much can I spend every day for the rest of the month without blowing my budget?"*
  - **Contextual Variation:** If filtered to a credit card: *"How fast am I running up a balance on this specific card relative to my budget limits?"*

#### Card 2: Safe-To-Spend Buffer (Dynamic)

- **Default State (No Filters):** Total remaining budget minus unpaid, scheduled commitments ("Vows") for the rest of the calendar month.
- **Filtered State (Account Selected):** Excludes upcoming Vows that are *not* tied to this filtered account.
- **Calculations:**
  $$\text{Safe-To-Spend} = \text{Remaining Budget Balance} - \sum(\text{Upcoming Unpaid Vows in Month})$$
- **The "Human Question" Interaction (Back of Card):**
  - **Question:** *"How much of my current cash is actually mine to spend freely, and how much is already spoken for by upcoming bills?"*

#### Card 3: Exhaustion Projection (Dynamic Runout Date)

- **Default State (No Filters):** Projects the date the user will run out of money based on average daily spending velocity to date.
- **Filtered State (Account Selected):** Projects when the specific account's allocated ceiling will be exhausted at current usage rates.
- **Calculations:**
  $$\text{Daily Burn Average} = \frac{\text{Total Spent in Month to Date}}{\text{Current Day of Month}}$$$$\text{Projected Days to Exhaustion} = \frac{\text{Remaining Budget Balance}}{\text{Daily Burn Average}}$$$$\text{Runout Date} = \text{Current Date} + \text{Projected Days to Exhaustion}$$
- **The "Human Question" Interaction (Back of Card):**
  - **Question:** *"At my current spending speed, on what day of the month will this budget run dry?"*

#### Card 4: Account Funding Burden / Budget Slack (Dynamic)

- **Default State (No Filters - "Budget Slack"):** Shows how much budget capacity remains completely unassigned to any specific Allowance or Vow.
- **Filtered State (Account Selected - "Account Weight"):** Changes to show the percentage of this month's budget activity originating from the selected account.
- **Calculations (Filtered State):**
  $$\text{Account Burden \%} = \left( \frac{\text{Transactions on Selected Account within Budget}}{\text{Total Budget Spent}} \right) \times 100$$
- **The "Human Question" Interaction (Back of Card):**
  - **Question (Filtered):** *"How much weight is this specific card or account carrying for my lifestyle budget this month?"*
  - **Question (Unfiltered):** *"Do I have any leftover, unassigned money in this budget that isn't locked down by an allowance envelope?"*

### 5. Technical Requirements & Performance

- **No Server-Side Latency:** Because these updates are mathematical rather than AI/ML-driven, calculations should occur on the client side instantly upon changing filters in the action bar.
- **Zero Transactions Handling:** If a filtered account has zero transactions associated with the active budget, the cards should gracefully fallback to a state showing: *"No budget activity recorded on this account for [Month] yet."*
- **State Preservation:** If a card is clicked to reveal its "Human Question," it should remain in that flipped state until clicked again or until the user changes active filters, which resets all cards to their primary visual states.

### 6. Scope Boundaries

- **In-Scope (Utility Tier):** Real-time client-side calculation, transition animations for dynamic changes, "flip-to-question" micro-interactions, account-filter triggers.
- **Out-of-Scope (Premium Tier):** Predictive forecasting beyond linear extrapolation (e.g., "Usually your spending spikes on weekends, so you will run out earlier"), merchant-specific hazard alerts, auto-balancing recommendations.

