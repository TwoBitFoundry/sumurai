# Sumurai Amazon Syncer

Automates Amazon transaction categorization in Sumurai by connecting to Gmail via IMAP, parsing order/shipment confirmation emails, classifying purchased items using local Ollama (Llama 3.2 / Qwen 2.5), and matching bank charges in PostgreSQL to apply category overrides.

---

## How It Works

1. **IMAP Ingestion**: Scans your Gmail inbox for emails from `auto-confirm@amazon.com` and `shipment-tracking@amazon.com`.
2. **Order & Amount Extraction**: Extracts the Amazon Order ID (`112-xxxxxxx-xxxxxxx`), package charged amounts (`Shipment Total: $XX.XX`), and product titles from the email HTML.
3. **Local AI Classification**: Prompts your local Ollama instance (`llama3.2:latest`) using Sumurai's exact category & subcategory taxonomy to choose the single best category (e.g. *Cascade Detergent* ➔ `Home Improvement • Household Supplies`).
4. **Transaction Matching**: Queries Sumurai's database for Amazon charges with matching amounts and dates ($\pm 2$ to $5$ days).
5. **Auto-Override**: Writes the classification into `transaction_category_overrides` and archives the order in `amazon_receipts`.
6. **Pending Sweeper**: If an email arrives before the bank charge posts, it queues the receipt in `amazon_receipts` and automatically pairs it when the bank transaction syncs!

---

## Setup Instructions

### 1. Generate a Gmail App Password
1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is enabled.
3. Search for **App passwords** (or go to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
4. Create a new app password named `Sumurai Amazon Syncer`.
5. Copy the generated 16-character password (e.g. `abcd efgh ijkl mnop`).

### 2. Configure `amazon-syncer.env`
Edit `/srv/data/docker/sumurai/amazon-syncer/amazon-syncer.env`:
```env
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
GMAIL_FOLDER=INBOX
```

### 3. Start or Restart the Syncer
From `/srv/data/docker/sumurai`:
```bash
# Restart the background container
docker compose restart amazon-syncer

# View live sync logs
docker compose logs -f amazon-syncer
```

### 4. Running a One-Shot Manual Sync
To test or trigger a sync immediately:
```bash
docker compose exec amazon-syncer python syncer.py --once
```
