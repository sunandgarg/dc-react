-- Reviewable soft-delete for exam-deduplication-batch-001.
-- Run only after taking a backup and merging references using the JSON manifest.
-- This intentionally deactivates rows instead of hard-deleting them.
START TRANSACTION;

UPDATE exams
SET is_active = 0
WHERE id IN (
  '7feca44a-63b4-4a3b-a874-7f9ce88c217f',
  'ee645bd6-dfa2-42f2-a125-b2fc175c5c05',
  '4ea0689e-a807-4ad6-b90e-a21ec74d6c1f',
  '7a986b2e-1b62-4a83-b076-6959b480eb4b',
  '243b6c91-3520-4b1e-9fc1-2288c1c7e456',
  '874416d9-1219-4247-8572-2eb08cd82d75',
  '484a7717-df09-4f59-a2db-34dec8f9edd7',
  '1bf4b6a1-5575-40f8-85d8-3701d46b3aba',
  '6a368f50-77ff-4b39-b6fa-98f23fe7ccc9',
  '6ef5c13b-4606-47a8-aab2-3d6cf0793b12',
  '005b84df-f49d-418c-a207-e0aa1d167f40',
  '708b3668-c17d-4ba4-90cf-8f66918c760e',
  '7da7272a-3b27-4caf-87f1-0ee550c01e9b',
  '5e8b29e1-d73b-4550-8981-d9ac7b924806',
  '5c6ea222-e568-42bd-b6a2-4cd84e1c4da7',
  '957a6d86-8938-4af2-8b5d-306d63587965',
  '914acdc7-befc-42c0-863e-c04cf9bde4db'
);

COMMIT;
