-- Migration 038: Remove General Merchandise and Other categories, reclassify to Shopping, and default unknown to Shopping

-- 1. Reclassify transactions where category_primary is General Merchandise
UPDATE transactions
SET 
  category_primary = 'Shopping',
  category_detailed = CASE 
    WHEN category_detailed ILIKE '%ELECTRONICS%' THEN 'Electronics'
    WHEN category_detailed ILIKE '%CLOTHING%' THEN 'Clothing'
    ELSE 'Shopping'
  END
WHERE category_primary ILIKE '%general%merchandise%';

-- 2. Reclassify transactions where category_primary is OTHER or Uncategorized
UPDATE transactions
SET category_primary = 'Earned Income', category_detailed = 'Bonus'
WHERE category_primary ILIKE 'other%' AND (merchant_name ILIKE '%CASH REWARD%' OR merchant_name ILIKE '%CASH BACK%');

UPDATE transactions
SET category_primary = 'Transfer', category_detailed = 'Credit Card Payment'
WHERE category_primary ILIKE 'other%' AND merchant_name ILIKE '%STATEMENT CREDIT%';

UPDATE transactions
SET category_primary = 'Shopping', category_detailed = 'Shopping'
WHERE category_primary ILIKE 'other%' OR category_primary ILIKE 'uncategorized';

-- 3. Cleanup any remaining category_detailed containing OTHER or General Merchandise
UPDATE transactions
SET category_detailed = category_primary
WHERE category_detailed ILIKE 'other%' OR category_detailed ILIKE '%general%merchandise%';

-- 4. Update transaction_category_overrides
UPDATE transaction_category_overrides
SET category_name = 'Shopping'
WHERE category_name ILIKE '%general%merchandise%' 
   OR category_name ILIKE 'other%' 
   OR category_name ILIKE 'uncategorized';

UPDATE transaction_category_overrides
SET subcategory_name = NULL
WHERE subcategory_name ILIKE '%general%merchandise%' 
   OR subcategory_name ILIKE 'other%' 
   OR subcategory_name ILIKE 'uncategorized';

-- 5. Update category_rules
UPDATE category_rules
SET category_name = 'Shopping'
WHERE category_name ILIKE '%general%merchandise%' 
   OR category_name ILIKE 'other%' 
   OR category_name ILIKE 'uncategorized';

UPDATE category_rules
SET subcategory_name = NULL
WHERE subcategory_name ILIKE '%general%merchandise%' 
   OR subcategory_name ILIKE 'other%' 
   OR subcategory_name ILIKE 'uncategorized';

-- 6. Update user_categories
UPDATE user_categories
SET parent_category = 'Shopping'
WHERE parent_category ILIKE '%general%merchandise%' 
   OR parent_category ILIKE 'other%' 
   OR parent_category ILIKE 'uncategorized';

DELETE FROM user_categories
WHERE (name ILIKE '%general%merchandise%' OR name ILIKE 'other%' OR name ILIKE 'uncategorized')
  AND parent_category IS NULL;

-- 7. Update budgets
UPDATE budgets
SET category = 'Shopping'
WHERE category ILIKE '%general%merchandise%' 
   OR category ILIKE 'other%' 
   OR category ILIKE 'uncategorized';
