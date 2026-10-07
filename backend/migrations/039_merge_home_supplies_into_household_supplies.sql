-- Migration 039: Merge Home Supplies into Household Supplies

UPDATE transactions
SET category_detailed = 'Household Supplies'
WHERE category_detailed ILIKE '%home%supplies%';

UPDATE transaction_category_overrides
SET subcategory_name = 'Household Supplies'
WHERE subcategory_name ILIKE '%home%supplies%';

UPDATE category_rules
SET subcategory_name = 'Household Supplies'
WHERE subcategory_name ILIKE '%home%supplies%';

DELETE FROM user_categories
WHERE name ILIKE '%home%supplies%';

