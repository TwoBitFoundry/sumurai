# Product Requirement Document (PRD)

## Feature Name: Contextual Transaction Analytics Bar (Interactive)

- **Date:** June 5, 2026
- **Author:** Product & Design Collaboration
- **Status:** Ready for Review
- **Target Release:** Q3 2026
- **Reference Artifact:** Dia 2026-06-05 17.39.57.jpg

## 1. Executive Summary & Objective

The Transactions page currently features three top-level summary cards (Total Shown, Average Size, Largest Size), as visualized in **Dia 2026-06-05 17.39.57.jpg**. While functional, these static metrics are easily skewed by outlier transactions (such as the shown $\$9,979.45$ savings transfer) and do not provide actionable behavioral insights.

The objective of this feature is to transform this area into a dynamic **Contextual Analytics Bar**. By leveraging our auto-categorization and upcoming merchant normalization engines, these three cards will automatically morph to surface granular, hyper-targeted behavioral insights based on the user's active filter states (Account, Category, Search, or Mixed).

Additionally, we will implement a "Conversational UX" pattern: clicking any card will reveal the exact human question that specific metric is trying to answer. This turns a dry financial ledger into an interactive, intuitive tool for self-discovery.

## 2. User Problem & Value Proposition

- **The Problem:** Budgeting app users want to understand deep, granular spending behaviors (e.g., *"How often do I go to Costco?"* or *"Which card do I use most for food?"*), but standard dashboards only show high-level aggregates. Digging through lists of transactions manually is tedious.
- **The Value Proposition:** The app surfaces instant, real-time behavioral patterns at the exact level of granularity the user is actively inspecting. By framing complex financial calculations as natural language questions, we lower cognitive load and increase financial literacy.

## 3. Functional Specifications

### 3.1 The 3-Card Layout Structure

The interface must strictly maintain the existing $3$-card layout shown at the top of **Dia 2026-06-05 17.39.57.jpg**:

1. **Card 1 (Left - Green theme):** Focuses on Volume, Sum, and Share metrics.
2. **Card 2 (Middle - Blue theme):** Focuses on Temporal Cadence, Frequency, and typical sizes.
3. **Card 3 (Right - Purple theme):** Focuses on Concentration, Focus areas, and unusual recurring patterns (Mode).

### 3.2 Contextual Filter State Engine

The app must listen to active filter states (Account, Category, Search, or combinations thereof) and dynamically update the titles, data types, calculations, and interactive questions inside the cards.

```
       [ User Action: Applies Filter(s) ]
                       │
                       ▼
        [ State-Machine Matrix Engine ]
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
   [Card 1]        [Card 2]        [Card 3]
  (Volume/Sum)    (Frequency)   (Concentration)
       │               │               │
       ▼               ▼               ▼
 [Interactive Card Flip / Cross-Fade on Tap]
                       │
                       ▼
   [Reveals the Underlying "Human Question"]


```

#### State A: Unfiltered (Global Ledger View)

*Active when the user first lands on the Transactions page and has applied no filters.*

- **Card 1 (Volume):**
  - *Technical Metric:* Total Shown Sum & Count (e.g., $292$ items, $\$52,193.78$).
  - *Human Question:* *"How much money and how many transactions am I currently looking at in this view?"*
- **Card 2 (Frequency):**
  - *Technical Metric:* Median Transaction Size (to ignore skew from massive transfers).
  - *Human Question:* *"What does a typical, everyday purchase look like for me when we ignore huge outliers?"*
- **Card 3 (Concentration):**
  - *Technical Metric:* Fixed vs. Variable Transaction Split (Count of auto-bills/subscriptions vs. discretionary swipes).
  - *Human Question:* *"How much of my recent ledger is automatic recurring bills versus active daily swipes?"*

#### State B: Category Only

*Active when a single category pill (e.g., "Food & Drink") is active.*

- **Card 1 (Volume):**
  - *Technical Metric:* Total Category Spend (Sum and Count).
  - *Human Question:* *"What is my total damage in this specific category for the filtered period?"*
- **Card 2 (Frequency):**
  - *Technical Metric:* Purchase Cadence (Frequency interval; e.g., "Every $1.5$ days").
  - *Human Question:* *"How often do I actually swipe my card for this type of spending?"*
- **Card 3 (Concentration):**
  - *Technical Metric:* Top Category Merchant (Using normalized merchant names).
  - *Human Question:* *"Which specific store or service swallows up the biggest piece of this category's budget?"*

#### State C: Search / Merchant Only

*Active when the text search contains a normalized merchant string (e.g., "Costco" or "Starbucks").*

- **Card 1 (Volume):**
  - *Technical Metric:* Lifetime Merchant Spend (Aggregate historical spend).
  - *Human Question:* *"How much money have I given this specific merchant since I started tracking my spending?"*
- **Card 2 (Frequency):**
  - *Technical Metric:* Visit Interval (Average days elapsed between visits).
  - *Human Question:* *"How many days do I typically go before making a return trip to this merchant?"*
- **Card 3 (Concentration):**
  - *Technical Metric:* The "Usual" (Statistical Mode; the most common exact transaction dollar amount).
  - *Human Question:* *"What is the exact price of my favorite or most frequent order here?"*

#### State D: Account Only

*Active when filtering transactions down to a single account (e.g., "Personal ...2069").*

- **Card 1 (Volume):**
  - *Technical Metric:* Account-Specific Volume (Total sum and count of transactions on this card).
  - *Human Question:* *"How much transactional activity has gone through this specific card or ledger?"*
- **Card 2 (Frequency):**
  - *Technical Metric:* Swipe Velocity (Transaction count velocity; e.g., "Averages $4$ swipes per day").
  - *Human Question:* *"How aggressively or frequently am I running up charges on this specific piece of plastic?"*
- **Card 3 (Concentration):**
  - *Technical Metric:* Primary Account Category (Top spending category by volume on this card).
  - *Human Question:* *"What type of spending places the absolute highest operational demand on this account?"*

#### State E: Mixed (Account + Category)

*Active when a user filters by a card and a category simultaneously (e.g., "Shared ...1376" + "Food & Drink").*

- **Card 1 (Volume):**
  - *Technical Metric:* Isolated Sub-Total (Total spend for this category *on this card*).
  - *Human Question:* *"How much of this specific category's spending am I routing onto this card?"*
- **Card 2 (Frequency):**
  - *Technical Metric:* Share of Wallet (Percentage of overall category spend hitting this card; e.g., $75\%$).
  - *Human Question:* *"What percentage of my total spending in this category is charged to this specific card?"*
- **Card 3 (Concentration):**
  - *Technical Metric:* Top Merchant in Intersection (Dominant merchant for this specific card-category pair).
  - *Human Question:* *"Where am I shopping the most when using this card for this category?"*

#### State F: Mixed (Account + Search/Merchant)

*Active when a user filters by an account and searches for a specific merchant (e.g., "Personal ...2069" + "Starbucks").*

- **Card 1 (Volume):**
  - *Technical Metric:* Card Loyalty Volume (Dollar total spent at this merchant using this card).
  - *Human Question:* *"How much have I spent at this store using only this specific account?"*
- **Card 2 (Frequency):**
  - *Technical Metric:* Swipe Preference (Percentage ratio of visits to this merchant using this card vs. others).
  - *Human Question:* *"When I go here, how often do I instinctively reach for this specific card over others?"*
- **Card 3 (Concentration):**
  - *Technical Metric:* Median Intersection Size (Typical dollar amount spent at this merchant on *this card* specifically).
  - *Human Question:* *"What is my typical receipt total at this merchant when I pay with this specific card?"*

#### State G: Mixed (Category + Search/Merchant)

*Active when filtering a category and searching a merchant (e.g., "Transport" + "Costco" to isolate Gas).*

- **Card 1 (Volume):**
  - *Technical Metric:* Merchant Category Share (Percentage of the category spend claimed by this merchant).
  - *Human Question:* *"How much of my entire budget for this category is dominated by this single merchant?"*
- **Card 2 (Frequency):**
  - *Technical Metric:* Cross-Category Frequency (Percentage ratio showing how often this merchant is classified here vs. other categories).
  - *Human Question:* *"How often is this store classified under this category versus other categories in my ledger?"*
- **Card 3 (Concentration):**
  - *Technical Metric:* Category Variance (Merchant's median spend compared to the category's overall median).
  - *Human Question:* *"Is my typical spend at this store more expensive or cheaper than my overall category average?"*

### 3.3 Fallback Hierarchy (Triple Filter / Extreme Mixed State)

In the event that a user applies **Account + Category + Search/Merchant** simultaneously:

1. **Card 1:** Sum and count of the specific triple intersection.
  - *Question:* *"What is the absolute total of this highly specific subset of transactions?"*
2. **Card 2:** Recency (Days elapsed since this exact intersection last occurred; e.g., *"Last transaction:* $14$ *days ago"*).
  - *Question:* *"How long has it been since I last completed this exact transaction on this card?"*
3. **Card 3:** Behavioral Mode (The most common transaction size for this triple intersection).
  - *Question:* *"When I perform this hyper-specific action, what is the dollar amount I spend most often?"*

## 4. UI/UX Interaction & Animation Design

### 4.1 Card Flip Interaction Pattern

To prevent cluttering the visual hierarchy shown in **Dia 2026-06-05 17.39.57.jpg**, we will hide the natural language questions behind an elegant card interaction.

```
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│  TOTAL SHOWN                         │     │  TOTAL SHOWN                         │
│  292 Items                           │  T  │  "How much money and how many        │
│  $52,193.78                          │  A  │   transactions am I currently        │
│                                      │  P  │   looking at in this view?"          │
│                      [GREEN THEME]   │ ───>│                       [GREEN THEME]  │
└──────────────────────────────────────┘     └──────────────────────────────────────┘
             (Front / Data)                                (Back / Question)


```

- **Interactive Trigger:** Each card must act as an independent toggle button. Clicking/tapping anywhere on an insight card triggers a smooth $180$-degree 3D card-flip or horizontal cross-fade animation.
- **Dismissal Behavior:**
  - Clicking the card again flips it back to the data state.
  - Adjusting any filters on the contextual action bar automatically resets all flipped cards to their "Data" states and displays the recalculated metrics.
- **Affordance & Hover States:**
  - On desktop hover, the card should lift slightly ($y\text{-axis shift by } -2\text{px}$) with a box-shadow increase to indicate interactivity.
  - A subtle, elegant info icon ($\mathbf{\small{i}}$) styled in the card's theme color (Green, Blue, Purple) will live in the top right corner of each card.

## 5. Visual Specifications (Matching Visual Reference)

The design must maintain the exact styling parameters from the original card containers:

- **Card 1 (Left - Volume Focus):** Light mint-green border, background tint, and pill styling. High contrast green font colors.
- **Card 2 (Middle - Cadence Focus):** Cool sky-blue border, background tint, and pill styling.
- **Card 3 (Right - Concentration Focus):** Pastel violet-purple border, background tint, and pill styling.
- **Card Fonts:** Crisp sans-serif matching the current interface. Bold transaction summaries ($24\text{pt}$ equivalent) with smaller subtitle text for secondary indicators.

## 6. Technical & Performance Requirements

- **Performance Budget:** Metric calculations must compute and render in under $150\text{ms}$ upon filter selection or text search query input. Since this runs on the core browsing ledger, queries must not block the main UI thread.
- **Merchant Normalization Fallback:** Metrics depending on normalization (State C, E, F, G) must fall back to basic regex cleaning if a merchant has not yet been processed by the automatic normalization engine (e.g., stripping out raw branch IDs like `*8931078006` or `STORE #120` from the transaction strings shown in **Dia 2026-06-05 17.39.57.jpg**).
- **Explicit Exclusions (Out of Scope):**
  - **No Budget Progress Bars:** To avoid duplication, monthly pacing, variances, and subscription management are strictly restricted to the Budgets tab.
  - **No Predictive Anomalies:** Any calculations relating to predictive spend trends, potential fraud alerts, or predictive scheduling are reserved for the premium paid tier and are explicitly excluded from this standard utility bar.

