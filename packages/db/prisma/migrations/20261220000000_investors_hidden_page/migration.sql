-- The Cap table sidebar page is now Investors: carry a hidden page over.
UPDATE "user" SET "hiddenPages" = array_replace("hiddenPages", 'cap-table', 'investors')
WHERE 'cap-table' = ANY("hiddenPages");
UPDATE "notifications" SET "surface" = 'investors' WHERE "surface" = 'cap-table';
