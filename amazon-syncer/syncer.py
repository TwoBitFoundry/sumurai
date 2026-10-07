#!/usr/bin/env python3
"""
Sumurai Amazon Transaction Syncer
=================================
Connects to Gmail via IMAP, fetches Amazon order and shipment confirmation emails,
extracts item details and charged amounts, uses local Ollama (Llama 3.2 / Qwen 2.5)
to classify the purchase into Sumurai's category taxonomy, and matches transactions
in PostgreSQL to apply category overrides.
"""

import email
import email.header
import email.utils
import imaplib
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from bs4 import BeautifulSoup
from dateutil import parser as date_parser
import psycopg2
from psycopg2.extras import RealDictCursor
import requests

# ── Logging Setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("amazon-syncer")

# ── Configuration ─────────────────────────────────────────────────────────────
GMAIL_USER = os.getenv("GMAIL_USER", "").strip()
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "").strip()
GMAIL_FOLDER = os.getenv("GMAIL_FOLDER", "INBOX").strip()
IMAP_SERVER = os.getenv("IMAP_SERVER", "imap.gmail.com").strip()
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@postgres:5432/accounting",
).strip()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:latest").strip()

SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", "3600"))
LOOKBACK_DAYS = int(os.getenv("LOOKBACK_DAYS", "30"))

# Sumurai Category Taxonomy
SUMURAI_TAXONOMY = {
    "Bills & Utilities": [
        "AI",
        "Internet",
        "Phone",
        "Television",
        "Utilities",
        "Water",
    ],
    "Childcare": [
        "Baby Supplies",
        "Babysitter & Daycare",
        "Child Support",
        "Kids Activities",
        "Toys",
    ],
    "Education": ["Books & Supplies", "Tuition"],
    "Entertainment": [
        "Amusement",
        "Arts",
        "Movies & DVDs",
        "Music",
        "Newspaper & Magazines",
        "Subscription",
    ],
    "Food & Dining": [
        "Alcohol & Bars",
        "Cafes & Bakeries",
        "Coffee Shops",
        "Fast Food",
        "Restaurants",
    ],
    "Gifts & Donations": ["Charity", "Children Allowance", "Gifts"],
    "Groceries": ["Groceries"],
    "Health & Fitness": ["Gym", "Sports"],
    "Home Improvement": [
        "Furnishings",
        "Household Supplies",
        "Lawn & Garden",
        "Plants & Needs",
    ],
    "Home Management": ["Home Insurance", "Home Services", "Mortgage"],
    "Insurance": [
        "Auto Insurance",
        "Car Insurance",
        "Health Insurance",
        "Life Insurance",
    ],
    "Medical": ["Dentist", "Doctor", "Eyecare", "Labs", "Mental Health", "Pharmacy"],
    "Pets": ["Boarding", "Insurance"],
    "Shopping": [
        "Books",
        "Clothing",
        "Decor",
        "Electronics",
        "Hair",
        "Hobbies",
        "Home",
        "Kitchen",
        "Laundry",
        "Personal Care",
        "Spa & Massage",
        "Toys",
    ],
    "Transportation": [
        "Auto Payment",
        "Car Insurance",
        "Car Maintainance",
        "Car Registration",
        "Gas",
        "Parking",
        "Public Transport",
        "Toll",
        "Traffic Ticket",
    ],
}


# ── Database Initialization ───────────────────────────────────────────────────
def get_db_connection():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    logger.info("Verifying database schema and tables...")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS amazon_receipts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID,
                    order_id VARCHAR(50) NOT NULL,
                    email_message_id VARCHAR(255),
                    order_date DATE NOT NULL,
                    amount NUMERIC(12, 2) NOT NULL,
                    items JSONB NOT NULL DEFAULT '[]'::jsonb,
                    category VARCHAR(100) NOT NULL,
                    subcategory VARCHAR(100),
                    matched_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
                    raw_subject TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    matched_at TIMESTAMPTZ,
                    CONSTRAINT unique_amazon_order_amount UNIQUE (order_id, amount)
                );

                CREATE INDEX IF NOT EXISTS idx_amazon_receipts_matched 
                    ON amazon_receipts(matched_transaction_id);
                CREATE INDEX IF NOT EXISTS idx_amazon_receipts_date 
                    ON amazon_receipts(order_date);

                CREATE TABLE IF NOT EXISTS amazon_syncer_state (
                    key VARCHAR(50) PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
        conn.commit()
    logger.info("Database tables initialized successfully.")


def get_default_user_id() -> Optional[str]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users ORDER BY created_at ASC LIMIT 1;")
                row = cur.fetchone()
                return str(row[0]) if row else None
    except Exception as e:
        logger.warning(f"Could not fetch default user_id: {e}")
        return None


# ── Email Parsing ─────────────────────────────────────────────────────────────
def decode_mime_header(header_val: Optional[str]) -> str:
    if not header_val:
        return ""
    decoded_fragments = email.header.decode_header(header_val)
    parts = []
    for frag, enc in decoded_fragments:
        if isinstance(frag, bytes):
            enc = enc or "utf-8"
            try:
                parts.append(frag.decode(enc, errors="replace"))
            except Exception:
                parts.append(frag.decode("latin1", errors="replace"))
        else:
            parts.append(str(frag))
    return "".join(parts)


def extract_order_id(subject: str, body: str) -> Optional[str]:
    # Look for standard Amazon order number: 3 digits - 7 digits - 7 digits
    match = re.search(r"\b(\d{3}-\d{7}-\d{7})\b", subject)
    if match:
        return match.group(1)
    match = re.search(r"\b(\d{3}-\d{7}-\d{7})\b", body)
    if match:
        return match.group(1)
    return None


def extract_amounts(html_body: str, text_body: str) -> List[Decimal]:
    """
    Extracts charged amounts from Amazon order or shipment notification.
    Amazon uses terms like 'Shipment total', 'Order Total', 'Total Before Tax', 'Charged to'.
    """
    amounts = []
    combined = (text_body + "\n" + html_body).replace("&nbsp;", " ")

    patterns = [
        # Explicit shipment or charged total
        r"(?:Shipment total|Shipment Total|Order total|Order Total|Charged to|Total charged|Grand Total)[:\s]*\$?\s*([0-9]+\.[0-9]{2})",
        # Generic Total at end of receipt table
        r"(?:Total for this shipment|Total for This Shipment)[:\s]*\$?\s*([0-9]+\.[0-9]{2})",
        # Fallback to Total: $XX.XX
        r"(?:Total)[:\s]+\$([0-9]+\.[0-9]{2})\b",
    ]

    for pat in patterns:
        matches = re.findall(pat, combined, flags=re.IGNORECASE)
        for m in matches:
            try:
                val = Decimal(m)
                if val > Decimal("0.00") and val not in amounts:
                    amounts.append(val)
            except Exception:
                pass

    return amounts


def extract_items_from_subject(subject: str) -> List[str]:
    m = re.search(
        r"(?:Ordered|Shipped|Delivered) \d+ items?: (.*)", subject, re.IGNORECASE
    )
    if m:
        return [part.strip() for part in m.group(1).split(",") if part.strip()]
    m2 = re.search(r"order of (.*)(?: has shipped|\.\.\.)?", subject, re.IGNORECASE)
    if m2:
        return [m2.group(1).strip()]
    return []


def extract_items_from_html(html: str) -> List[str]:
    items = []
    soup = BeautifulSoup(html, "html.parser")

    # 1. Product links: hrefs pointing to /dp/ or /gp/product/
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/dp/" in href or "/gp/product/" in href or "asin" in href.lower():
            text = a.get_text(strip=True)
            # Filter non-product boilerplate links
            if (
                text
                and len(text) > 4
                and not re.search(
                    r"^(track|return|view|buy again|your order|review|leave seller|contact|amazon|conditions|privacy)",
                    text,
                    re.IGNORECASE,
                )
            ):
                if text not in items:
                    items.append(text)

    # 2. Product images with alt text
    for img in soup.find_all("img", alt=True):
        alt = img["alt"].strip()
        if (
            alt
            and len(alt) > 3
            and not re.search(
                r"^(completed|pending|ordered|shipped|delivered|out for delivery|arriving|amazon|prime|star|star rating|shopping cart|logo|box|package|check mark)",
                alt,
                re.IGNORECASE,
            )
        ):
            if alt not in items:
                items.append(alt)

    # 3. Clean up and remove duplicates / near-duplicates
    cleaned = []
    for item in items:
        clean_text = " ".join(item.split())
        if len(clean_text) > 2 and clean_text not in cleaned:
            cleaned.append(clean_text)

    return cleaned[:10]


# ── LLM Categorization with Ollama ────────────────────────────────────────────
def build_taxonomy_text() -> str:
    lines = []
    for major, subs in SUMURAI_TAXONOMY.items():
        sub_str = ", ".join(subs)
        lines.append(f"- {major}: {sub_str}")
    return "\n".join(lines)


def categorize_with_ollama(
    items: List[str], order_id: str
) -> Tuple[str, Optional[str]]:
    """
    Calls local Ollama instance with format='json' to classify items.
    Returns (Category, Subcategory).
    """
    if not items:
        return ("Shopping", None)

    items_list_str = "\n".join(f"- {item}" for item in items)
    taxonomy_str = build_taxonomy_text()

    prompt = f"""You are a personal finance categorization assistant.
Classify the following Amazon order items into the SINGLE best Major Category and Subcategory from the allowed taxonomy.

ALLOWED TAXONOMY:
{taxonomy_str}

GUIDELINES:
- Always choose an exact Subcategory from the allowed list if any subcategory reasonably fits the item.
- Cleaning supplies, laundry detergents, dishwasher soap, paper towels, trash bags, batteries, hardware -> Category: "Home Improvement", Subcategory: "Household Supplies".
- Food, pantry, snacks, beverages -> Category: "Groceries", Subcategory: "Groceries".
- Cables, electronics, tech accessories -> Category: "Shopping", Subcategory: "Electronics".
- Apparel, shoes, shirts -> Category: "Shopping", Subcategory: "Clothing".
- Pet food, pet toys -> Category: "Pets", Subcategory: "Boarding" or null.

PURCHASED ITEMS:
{items_list_str}

Respond STRICTLY with valid JSON in this format:
{{"category": "<Major Category Name>", "subcategory": "<Subcategory Name or null>"}}
"""

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "format": "json",
        "stream": False,
    }

    try:
        resp = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        raw_response = data.get("response", "{}")
        parsed = json.loads(raw_response)

        category = parsed.get("category", "").strip()
        subcategory = parsed.get("subcategory")
        if subcategory:
            subcategory = subcategory.strip()
            if subcategory.lower() in ("null", "none", ""):
                subcategory = None

        # Validate against taxonomy
        matched_major = None
        for major in SUMURAI_TAXONOMY.keys():
            if major.lower() == category.lower():
                matched_major = major
                break

        if not matched_major:
            # Fallback check: maybe the model put a subcategory as category
            for major, subs in SUMURAI_TAXONOMY.items():
                if any(sub.lower() == category.lower() for sub in subs):
                    matched_major = major
                    subcategory = category
                    break

        if not matched_major:
            matched_major = "Shopping"

        # Validate subcategory
        if subcategory:
            allowed_subs = SUMURAI_TAXONOMY.get(matched_major, [])
            matched_sub = next(
                (s for s in allowed_subs if s.lower() == subcategory.lower()), None
            )
            subcategory = matched_sub

        logger.info(
            f"Ollama categorized order {order_id} ({items[:1]}...): "
            f"{matched_major} • {subcategory}"
        )
        return (matched_major, subcategory)

    except Exception as e:
        logger.error(f"Error calling Ollama: {e}. Defaulting to Shopping.")
        return ("Shopping", None)


# ── Transaction Matching ──────────────────────────────────────────────────────
def match_and_override_transaction(
    order_id: str,
    order_date: datetime.date,
    amount: Decimal,
    category: str,
    subcategory: Optional[str],
    user_id: Optional[str],
    date_window_days: int = 35,
    tolerance: Decimal = Decimal("0.02"),
) -> Optional[str]:
    """
    Searches for an Amazon transaction in Sumurai matching amount and date.
    Looks within [order_date - 2 days, order_date + date_window_days] to account
    for delayed shipments and monthly Subscribe & Save delivery dates.
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT t.id, t.user_id, t.date, t.amount, t.merchant_name, t.duplicate_of_transaction_id
                FROM transactions t
                WHERE (t.merchant_name ILIKE '%%amazon%%' OR t.merchant_name ILIKE '%%amzn%%')
                  AND ABS(t.amount - %s) <= %s
                  AND t.date BETWEEN (%s::date - INTERVAL '2 days') AND (%s::date + (%s || ' days')::interval)
                  AND NOT EXISTS (
                      SELECT 1 FROM amazon_receipts ar
                      WHERE ar.matched_transaction_id = t.id AND ar.order_id <> %s
                  )
                ORDER BY (t.duplicate_of_transaction_id IS NOT NULL) ASC, ABS(t.date - %s::date) ASC, ABS(t.amount - %s) ASC
                LIMIT 1;
                """,
                (
                    amount,
                    tolerance,
                    order_date,
                    order_date,
                    date_window_days,
                    order_id,
                    order_date,
                    amount,
                ),
            )
            row = cur.fetchone()

            if not row:
                return None

            txn_id = str(row.get("duplicate_of_transaction_id") or row["id"])
            txn_user_id = str(row["user_id"]) if row.get("user_id") else user_id

            # Insert or update override
            cur.execute(
                """
                INSERT INTO transaction_category_overrides (
                    transaction_id, user_id, category_name, subcategory_name
                )
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (transaction_id, user_id)
                DO UPDATE SET
                    category_name = EXCLUDED.category_name,
                    subcategory_name = EXCLUDED.subcategory_name;
                """,
                (txn_id, txn_user_id, category, subcategory),
            )
            conn.commit()

            logger.info(
                f"Matched Amazon charge ${row['amount']} on {row['date']} -> "
                f"Transaction {txn_id} overridden to {category} • {subcategory}"
            )
            return txn_id


def sweep_unmatched_receipts(user_id: Optional[str]):
    """
    Retries matching for previously saved receipts that did not have a matching bank txn yet.
    Looks back up to 35 days to support delayed/monthly delivery orders.
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Repoint any receipts from pending transactions to posted duplicates & transfer overrides
            cur.execute("""
                INSERT INTO transaction_category_overrides (transaction_id, user_id, category_name, subcategory_name, created_at)
                SELECT 
                    t_pending.duplicate_of_transaction_id,
                    tco_pending.user_id,
                    tco_pending.category_name,
                    tco_pending.subcategory_name,
                    tco_pending.created_at
                FROM transactions t_pending
                JOIN transaction_category_overrides tco_pending ON t_pending.id = tco_pending.transaction_id
                LEFT JOIN transaction_category_overrides tco_posted ON t_pending.duplicate_of_transaction_id = tco_posted.transaction_id
                WHERE t_pending.duplicate_of_transaction_id IS NOT NULL
                  AND tco_posted.category_name IS NULL
                ON CONFLICT (transaction_id, user_id) 
                DO UPDATE SET 
                    category_name = EXCLUDED.category_name,
                    subcategory_name = EXCLUDED.subcategory_name;

                UPDATE amazon_receipts ar
                SET matched_transaction_id = t_pending.duplicate_of_transaction_id
                FROM transactions t_pending
                WHERE ar.matched_transaction_id = t_pending.id
                  AND t_pending.duplicate_of_transaction_id IS NOT NULL;
            """)
            conn.commit()

            cur.execute("""
                SELECT id, order_id, order_date, amount, category, subcategory, user_id
                FROM amazon_receipts
                WHERE matched_transaction_id IS NULL
                  AND order_date >= NOW() - INTERVAL '35 days';
                """)
            unmatched = cur.fetchall()

            for r in unmatched:
                txn_id = match_and_override_transaction(
                    order_id=r["order_id"],
                    order_date=r["order_date"],
                    amount=Decimal(r["amount"]),
                    category=r["category"],
                    subcategory=r["subcategory"],
                    user_id=r["user_id"] or user_id,
                    date_window_days=35,
                    tolerance=Decimal("0.02"),
                )
                if txn_id:
                    cur.execute(
                        """
                        UPDATE amazon_receipts
                        SET matched_transaction_id = %s, matched_at = NOW()
                        WHERE id = %s;
                        """,
                        (txn_id, r["id"]),
                    )
            conn.commit()


# ── Subscribe & Save Ingestion ───────────────────────────────────────────────
def extract_subscribe_and_save_items(html: str) -> List[Dict[str, Any]]:
    """
    Parses items and pricing from Amazon Subscribe & Save preview/delivery emails.
    """
    items = []
    soup = BeautifulSoup(html, "html.parser")
    seen_titles = set()

    for tr in soup.find_all("tr"):
        row_text = " ".join(tr.get_text().split())
        if "$" in row_text and (
            "unit every" in row_text or "delivery" in row_text.lower()
        ):
            if "Order details" in row_text or "Arriving by" in row_text:
                continue

            m_title = re.search(
                r"^(?:Price (?:increase|decrease)\s+)?(.*?)(?:\s+\d+\s+unit|\s+Last price|\s+\$)",
                row_text,
            )
            if not m_title:
                continue

            title = m_title.group(1).strip()
            if len(title) < 4 or title in seen_titles:
                continue

            prices = re.findall(r"\$\s*([0-9]+\.[0-9]{2})", row_text)
            if not prices:
                continue

            raw_price = Decimal(prices[-1])
            seen_titles.add(title)

            # Estimate 6% sales tax (Maryland) for taxable items
            taxed_price = Decimal(str(round(float(raw_price) * 1.06, 2)))

            items.append(
                {
                    "title": title,
                    "pre_tax": raw_price,
                    "taxed": taxed_price,
                }
            )

    return items


def process_subscribe_and_save_email(
    msg: email.message.Message,
    html_body: str,
    text_body: str,
    subject: str,
    email_date: datetime.date,
    default_user_id: Optional[str],
) -> bool:
    """
    Processes Subscribe & Save monthly bundle notifications.
    """
    combined = text_body + "\n" + html_body
    items = extract_subscribe_and_save_items(html_body)
    if not items:
        return False

    delivery_date = email_date + timedelta(days=7)
    m_deliv = re.search(
        r"Arriving (?:by )?[A-Za-z]+,?\s+([A-Za-z]{3}\s+\d{1,2})", combined
    )
    if m_deliv:
        try:
            parsed = date_parser.parse(f"{m_deliv.group(1)} {email_date.year}").date()
            delivery_date = parsed
        except Exception:
            pass

    logger.info(
        f"Processing Subscribe & Save email: {len(items)} items for delivery ~{delivery_date}."
    )

    processed_any = False
    for it in items:
        title = it["title"]
        sub_key = re.sub(r"[^a-zA-Z0-9]", "", title[:15])
        order_id = f"SNS-{delivery_date.strftime('%Y%m')}-{sub_key}"

        # Check if already recorded and matched
        existing_sub = None
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT matched_transaction_id, category, subcategory FROM amazon_receipts WHERE order_id = %s;",
                    (order_id,),
                )
                existing_sub = cur.fetchone()

        if existing_sub and existing_sub[0]:
            continue

        if existing_sub and existing_sub[1]:
            category, subcategory = existing_sub[1], existing_sub[2]
        else:
            category, subcategory = categorize_with_ollama([title], order_id)

        # Match either taxed or pre-tax amount
        matched_txn_id = None
        matched_amt = it["taxed"]
        for candidate_amt in (it["taxed"], it["pre_tax"]):
            matched_txn_id = match_and_override_transaction(
                order_id=order_id,
                order_date=email_date,
                amount=candidate_amt,
                category=category,
                subcategory=subcategory,
                user_id=default_user_id,
                date_window_days=14,
                tolerance=Decimal("0.02"),
            )
            if matched_txn_id:
                matched_amt = candidate_amt
                break

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO amazon_receipts (
                        user_id, order_id, email_message_id, order_date, amount,
                        items, category, subcategory, matched_transaction_id,
                        matched_at, raw_subject
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (order_id, amount) DO UPDATE SET
                        matched_transaction_id = COALESCE(EXCLUDED.matched_transaction_id, amazon_receipts.matched_transaction_id),
                        matched_at = CASE WHEN EXCLUDED.matched_transaction_id IS NOT NULL THEN NOW() ELSE amazon_receipts.matched_at END;
                    """,
                    (
                        default_user_id,
                        order_id,
                        msg.get("Message-ID", ""),
                        delivery_date,
                        matched_amt,
                        json.dumps([title]),
                        category,
                        subcategory,
                        matched_txn_id,
                        datetime.now(timezone.utc) if matched_txn_id else None,
                        f"Subscribe & Save: {subject}",
                    ),
                )
            conn.commit()

        processed_any = True

    return processed_any


# ── IMAP Ingestion ────────────────────────────────────────────────────────────
def process_email_message(
    msg: email.message.Message, default_user_id: Optional[str]
) -> bool:
    subject = decode_mime_header(msg.get("Subject"))
    sender = decode_mime_header(msg.get("From"))
    date_str = msg.get("Date")
    msg_id = msg.get("Message-ID", "")

    # Only process Amazon order/shipment/delivery emails
    if not re.search(r"amazon\.(com|ca|co\.uk)", sender, re.IGNORECASE):
        return False

    if not re.search(
        r"(order|shipped|shipment|delivered|delivery|subscribe)", subject, re.IGNORECASE
    ):
        return False

    # Parse date
    order_date = datetime.now(timezone.utc).date()
    if date_str:
        try:
            parsed_dt = email.utils.parsedate_to_datetime(date_str)
            order_date = parsed_dt.date()
        except Exception:
            pass

    # Extract body parts
    html_body = ""
    text_body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            payload = part.get_payload(decode=True)
            if not payload:
                continue
            charset = part.get_content_charset() or "utf-8"
            decoded = payload.decode(charset, errors="replace")
            if ctype == "text/html":
                html_body += decoded
            elif ctype == "text/plain":
                text_body += decoded
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            decoded = payload.decode(charset, errors="replace")
            if msg.get_content_type() == "text/html":
                html_body = decoded
            else:
                text_body = decoded

    # Check for Subscribe & Save upcoming delivery emails
    if (
        "subscribe & save" in subject.lower()
        or "review your upcoming delivery" in subject.lower()
        or "subscribe & save" in sender.lower()
    ):
        if process_subscribe_and_save_email(
            msg, html_body, text_body, subject, order_date, default_user_id
        ):
            return True

    combined_body = text_body + "\n" + html_body
    order_id = extract_order_id(subject, combined_body)
    if not order_id:
        return False

    amounts = extract_amounts(html_body, text_body)
    items = extract_items_from_subject(subject)
    if html_body:
        for it in extract_items_from_html(html_body):
            if it not in items:
                items.append(it)
    dept_match = re.search(r"\b\d+\s+([A-Za-z0-9 &]+?)\s+items?\b", combined_body)
    if dept_match:
        dept = dept_match.group(1).strip()
        if dept and dept not in items:
            items.append(dept)

    if not amounts:
        logger.debug(
            f"Order {order_id} parsed, but no dollar amounts detected. Skipping."
        )
        return False

    # Check if all amounts for this order are already recorded and matched in database
    existing_receipts = {}
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT amount, category, subcategory, matched_transaction_id
                FROM amazon_receipts
                WHERE order_id = %s;
                """,
                (order_id,),
            )
            for r in cur.fetchall():
                existing_receipts[Decimal(r[0])] = {
                    "category": r[1],
                    "subcategory": r[2],
                    "matched": r[3] is not None,
                }

    # If all amounts for this order are already matched to transactions, skip completely
    if amounts and all(
        amt in existing_receipts and existing_receipts[amt]["matched"]
        for amt in amounts
    ):
        return False

    logger.info(
        f"Processing Amazon email: Order {order_id}, Date {order_date}, "
        f"Amounts: {[float(a) for a in amounts]}, Items: {len(items)}"
    )

    # Reuse category if previously classified for this order, otherwise query Ollama
    category, subcategory = None, None
    for ex in existing_receipts.values():
        if ex.get("category"):
            category = ex["category"]
            subcategory = ex.get("subcategory")
            break

    if not category:
        category, subcategory = categorize_with_ollama(items, order_id)

    # For each detected shipment/charge amount
    for amt in amounts:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Check if already recorded
                cur.execute(
                    """
                    SELECT id, matched_transaction_id 
                    FROM amazon_receipts 
                    WHERE order_id = %s AND amount = %s;
                    """,
                    (order_id, amt),
                )
                existing = cur.fetchone()
                if existing:
                    # If already matched, skip
                    if existing[1]:
                        continue
                    receipt_id = existing[0]
                else:
                    # Insert receipt record
                    cur.execute(
                        """
                        INSERT INTO amazon_receipts (
                            user_id, order_id, email_message_id, order_date, amount,
                            items, category, subcategory, raw_subject
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (order_id, amount) DO NOTHING
                        RETURNING id;
                        """,
                        (
                            default_user_id,
                            order_id,
                            msg_id,
                            order_date,
                            amt,
                            json.dumps(items),
                            category,
                            subcategory,
                            subject,
                        ),
                    )
                    row = cur.fetchone()
                    receipt_id = row[0] if row else None
            conn.commit()

        # Attempt to match with existing Sumurai transaction
        txn_id = match_and_override_transaction(
            order_id=order_id,
            order_date=order_date,
            amount=amt,
            category=category,
            subcategory=subcategory,
            user_id=default_user_id,
        )

        if txn_id and receipt_id:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE amazon_receipts
                        SET matched_transaction_id = %s, matched_at = NOW()
                        WHERE id = %s;
                        """,
                        (txn_id, receipt_id),
                    )
                conn.commit()

    return True


def run_sync():
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        logger.warning(
            "GMAIL_USER or GMAIL_APP_PASSWORD not set. "
            "Please configure amazon-syncer.env with your Gmail App Password."
        )
        return

    default_user_id = get_default_user_id()
    logger.info(f"Connecting to {IMAP_SERVER}:{IMAP_PORT} as {GMAIL_USER}...")

    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        mail.select(GMAIL_FOLDER, readonly=True)
    except Exception as e:
        logger.error(f"Failed to connect to IMAP server: {e}")
        return

    try:
        # Search for Amazon emails in the past LOOKBACK_DAYS
        since_date = (
            datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
        ).strftime("%d-%b-%Y")
        search_query = f'(FROM "amazon.com" SINCE "{since_date}")'
        logger.info(
            f"Searching IMAP folder '{GMAIL_FOLDER}' with query: {search_query}"
        )

        typ, data = mail.search(None, search_query)
        if typ != "OK":
            logger.warning(f"IMAP search returned non-OK status: {typ}")
            return

        msg_ids = data[0].split()
        logger.info(
            f"Found {len(msg_ids)} Amazon email(s) in the last {LOOKBACK_DAYS} days."
        )

        processed_count = 0
        for num in msg_ids:
            typ, msg_data = mail.fetch(num, "(RFC822)")
            if typ != "OK" or not msg_data or not msg_data[0]:
                continue

            raw_email = msg_data[0][1]
            try:
                msg = email.message_from_bytes(raw_email)
                if process_email_message(msg, default_user_id):
                    processed_count += 1
            except Exception as e:
                logger.error(
                    f"Error parsing message {num.decode()}: {e}", exc_info=True
                )

        logger.info(
            f"Successfully processed {processed_count} Amazon order/shipment emails."
        )

        # Sweep previously unmatched receipts against newly posted bank transactions
        sweep_unmatched_receipts(default_user_id)

    finally:
        try:
            mail.close()
            mail.logout()
        except Exception:
            pass


# ── Main Entrypoint ───────────────────────────────────────────────────────────
def main():
    logger.info("Starting Sumurai Amazon Syncer Service...")
    init_db()

    # If run with --once argument, execute single sync pass and exit
    if "--once" in sys.argv:
        logger.info("Executing one-shot sync...")
        run_sync()
        return

    logger.info(
        f"Entering recurring sync loop (interval: {SYNC_INTERVAL_SECONDS} seconds)..."
    )
    while True:
        try:
            run_sync()
        except Exception as e:
            logger.error(f"Unexpected error during sync cycle: {e}")

        logger.info(f"Sleeping for {SYNC_INTERVAL_SECONDS} seconds until next cycle.")
        time.sleep(SYNC_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
