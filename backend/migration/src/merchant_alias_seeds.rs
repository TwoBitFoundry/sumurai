use entity::merchant_aliases;
use sea_orm_migration::sea_orm::{ActiveModelTrait, ConnectionTrait, DbErr, Set};
use uuid::Uuid;

pub struct MerchantAliasSeed {
    pub match_type: &'static str,
    pub match_key: &'static str,
    pub canonical_name: &'static str,
    pub priority: i32,
}

pub const MERCHANT_ALIAS_SEEDS: &[MerchantAliasSeed] = &[
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "COSTCO WHSE",
        canonical_name: "Costco",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "COSTCO",
        canonical_name: "Costco",
        priority: 5,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "WINCO",
        canonical_name: "WinCo",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "BOKF",
        canonical_name: "BOKF",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "exact",
        match_key: "BOKF",
        canonical_name: "BOKF",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "INSTACART",
        canonical_name: "Instacart",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "TESLA MOTORS",
        canonical_name: "Tesla Motors",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "TESLA",
        canonical_name: "Tesla",
        priority: 5,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "OK NATURAL GAS",
        canonical_name: "Oklahoma Natural Gas",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "CITY OF TULSA",
        canonical_name: "City of Tulsa",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "WALMART",
        canonical_name: "Walmart",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "WAL-MART",
        canonical_name: "Walmart",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "TARGET",
        canonical_name: "Target",
        priority: 5,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "AMAZON",
        canonical_name: "Amazon",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "AMZN",
        canonical_name: "Amazon",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "WHOLE FOODS",
        canonical_name: "Whole Foods",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "TRADER JOES",
        canonical_name: "Trader Joe's",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "TRADER JOE",
        canonical_name: "Trader Joe's",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "KROGER",
        canonical_name: "Kroger",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "SAFEWAY",
        canonical_name: "Safeway",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "WALGREENS",
        canonical_name: "Walgreens",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "CVS",
        canonical_name: "CVS",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "STARBUCKS",
        canonical_name: "Starbucks",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "MCDONALDS",
        canonical_name: "McDonald's",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "MCDONALD",
        canonical_name: "McDonald's",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "CHIPOTLE",
        canonical_name: "Chipotle",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "CHICK-FIL-A",
        canonical_name: "Chick-fil-A",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "CHICK FIL A",
        canonical_name: "Chick-fil-A",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "NETFLIX",
        canonical_name: "Netflix",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "SPOTIFY",
        canonical_name: "Spotify",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "APPLECARD",
        canonical_name: "Apple Card",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "APPLE",
        canonical_name: "Apple",
        priority: 5,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "GOOGLE",
        canonical_name: "Google",
        priority: 5,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "MICROSOFT",
        canonical_name: "Microsoft",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "ADOBE",
        canonical_name: "Adobe",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "UBER EATS",
        canonical_name: "Uber Eats",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "DOORDASH",
        canonical_name: "DoorDash",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "GRUBHUB",
        canonical_name: "Grubhub",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "VENMO",
        canonical_name: "Venmo",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "PAYPAL",
        canonical_name: "PayPal",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "ZELLE",
        canonical_name: "Zelle",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "CASH APP",
        canonical_name: "Cash App",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "SHELL",
        canonical_name: "Shell",
        priority: 5,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "CHEVRON",
        canonical_name: "Chevron",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "EXXON",
        canonical_name: "Exxon",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "BP",
        canonical_name: "BP",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "MARATHON",
        canonical_name: "Marathon",
        priority: 5,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "HOME DEPOT",
        canonical_name: "Home Depot",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "LOWES",
        canonical_name: "Lowe's",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "LOWE'S",
        canonical_name: "Lowe's",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "BEST BUY",
        canonical_name: "Best Buy",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "7-ELEVEN",
        canonical_name: "7-Eleven",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "7 ELEVEN",
        canonical_name: "7-Eleven",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "DOLLAR GENERAL",
        canonical_name: "Dollar General",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "DOLLAR TREE",
        canonical_name: "Dollar Tree",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "FAMILY DOLLAR",
        canonical_name: "Family Dollar",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "ALDI",
        canonical_name: "Aldi",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "PUBLIX",
        canonical_name: "Publix",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "MEIJER",
        canonical_name: "Meijer",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "HEB",
        canonical_name: "H-E-B",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "H-E-B",
        canonical_name: "H-E-B",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "T-MOBILE",
        canonical_name: "T-Mobile",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "TMOBILE",
        canonical_name: "T-Mobile",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "VERIZON",
        canonical_name: "Verizon",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "ATT",
        canonical_name: "AT&T",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "AT&T",
        canonical_name: "AT&T",
        priority: 10,
    },
];

pub const MERCHANT_ALIAS_SEEDS_V2: &[MerchantAliasSeed] = &[
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "PLAYSTATION",
        canonical_name: "PlayStation",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "BURGER KING",
        canonical_name: "Burger King",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "OPENAI",
        canonical_name: "OpenAI",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "CURSOR AI POWERED IDE",
        canonical_name: "Cursor",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "QT",
        canonical_name: "QuikTrip",
        priority: 5,
    },
];

pub async fn insert_merchant_alias_seeds<C>(db: &C) -> Result<(), DbErr>
where
    C: ConnectionTrait,
{
    let now = chrono::Utc::now().fixed_offset();

    for seed in MERCHANT_ALIAS_SEEDS {
        merchant_aliases::ActiveModel {
            id: Set(Uuid::new_v4()),
            match_type: Set(seed.match_type.to_string()),
            match_key: Set(seed.match_key.to_string()),
            canonical_name: Set(seed.canonical_name.to_string()),
            priority: Set(seed.priority),
            is_active: Set(true),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(db)
        .await?;
    }

    Ok(())
}

pub const MERCHANT_ALIAS_SEEDS_V3: &[MerchantAliasSeed] = &[
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "TURBOTAX",
        canonical_name: "TurboTax",
        priority: 10,
    },
    MerchantAliasSeed {
        match_type: "contains",
        match_key: "BRAUMS",
        canonical_name: "Braums",
        priority: 10,
    },
];
