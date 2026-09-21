# Exam deduplication batch 001

Checked: 2026-09-21T00:00:00+05:30 (Asia/Kolkata)

This manifest contains 17 confirmed duplicate rows across 15 canonical exam records. It is intentionally a soft-delete plan: merge references first, then set is_active=false. No production mutation was run because this workspace has no production database credentials.

## What stays

- **JEE Main** — keep **jee-mains** (22e4c25a-09e3-435e-a512-bc3d46b5cc54)
- **JEE Advanced** — keep **jee-advanced** (5966ee69-0c74-4a16-83c9-1a20e46463c4)
- **NEET UG** — keep **national-eligibility-cum-entrance-test-neet** (8720f71d-a911-4735-bb5f-ce1181a6fc91)
- **CAT** — keep **common-admission-test** (2307c7a9-a10d-4ed2-aec7-334c0960e4e6)
- **CLAT** — keep **clat** (b7998bdf-a4a9-400a-9446-f4a0bd1ed85b)
- **GATE** — keep **gate** (f24379ee-aad3-4b6d-99dc-e449dfc17045)
- **UCEED** — keep **uceed** (ac281e4e-e526-43bd-9c25-47b408ec2dcf)
- **XAT** — keep **xat** (3b6b2846-b3ad-48f2-81c5-cccea74bef96)
- **BITSAT** — keep **bitsat** (e79ff5cb-aa94-4c8e-b271-1c5be04f4493)
- **COMEDK UGET** — keep **comedk** (54233372-6e90-47a5-a61e-49031ca723eb)
- **WBJEE** — keep **wbjee** (6aee3463-2af7-442d-a3f5-9d2a79e2c560)
- **AP EAPCET** — keep **ap-eamcet** (6e861fe9-beff-4560-b145-df130ae8d77b)
- **CEED** — keep **CEED** (68c8cf19-b7c5-4624-a2c7-21a1df96dd90)
- **BHU PET** — keep **bhu-pet** (0375f25c-63d1-48f7-8515-09344f131150)
- **CUET UG** — keep **cuet-2026** (f31d18ac-0e9c-4648-b979-856b3f24fbfa)

## What is approved for removal

- **JEE Main** — deactivate **jee-main-2026** (7feca44a-63b4-4a3b-a874-7f9ce88c217f); merge into **jee-mains** (22e4c25a-09e3-435e-a512-bc3d46b5cc54). Reason: year-suffixed duplicate.
- **JEE Main (Demo)** — deactivate **dekho-sample-jee-main** (ee645bd6-dfa2-42f2-a125-b2fc175c5c05); merge into **jee-mains** (22e4c25a-09e3-435e-a512-bc3d46b5cc54). Reason: demo duplicate; remove from production catalogue.
- **JEE Advanced** — deactivate **jee-advanced-2026** (4ea0689e-a807-4ad6-b90e-a21ec74d6c1f); merge into **jee-advanced** (5966ee69-0c74-4a16-83c9-1a20e46463c4). Reason: year-suffixed duplicate.
- **NEET UG** — deactivate **neet** (7a986b2e-1b62-4a83-b076-6959b480eb4b); merge into **national-eligibility-cum-entrance-test-neet** (8720f71d-a911-4735-bb5f-ce1181a6fc91). Reason: lower-quality duplicate.
- **NEET UG** — deactivate **neet-ug-2026** (243b6c91-3520-4b1e-9fc1-2288c1c7e456); merge into **national-eligibility-cum-entrance-test-neet** (8720f71d-a911-4735-bb5f-ce1181a6fc91). Reason: year-suffixed duplicate.
- **CAT** — deactivate **cat** (874416d9-1219-4247-8572-2eb08cd82d75); merge into **common-admission-test** (2307c7a9-a10d-4ed2-aec7-334c0960e4e6). Reason: lower-quality duplicate; merge any batch-001 CAT content into canonical row.
- **CLAT** — deactivate **clat-2026** (484a7717-df09-4f59-a2db-34dec8f9edd7); merge into **clat** (b7998bdf-a4a9-400a-9446-f4a0bd1ed85b). Reason: year-suffixed duplicate.
- **GATE** — deactivate **gate-2026** (1bf4b6a1-5575-40f8-85d8-3701d46b3aba); merge into **gate** (f24379ee-aad3-4b6d-99dc-e449dfc17045). Reason: year-suffixed duplicate.
- **UCEED** — deactivate **uceed-2026** (6a368f50-77ff-4b39-b6fa-98f23fe7ccc9); merge into **uceed** (ac281e4e-e526-43bd-9c25-47b408ec2dcf). Reason: year-suffixed duplicate; UCEED remains distinct from CEED.
- **XAT** — deactivate **xat-2026** (6ef5c13b-4606-47a8-aab2-3d6cf0793b12); merge into **xat** (3b6b2846-b3ad-48f2-81c5-cccea74bef96). Reason: year-suffixed duplicate.
- **BITSAT** — deactivate **bitsat-2026** (005b84df-f49d-418c-a207-e0aa1d167f40); merge into **bitsat** (e79ff5cb-aa94-4c8e-b271-1c5be04f4493). Reason: year-suffixed duplicate.
- **COMEDK UGET** — deactivate **comedk-uget** (708b3668-c17d-4ba4-90cf-8f66918c760e); merge into **comedk** (54233372-6e90-47a5-a61e-49031ca723eb). Reason: slug duplicate.
- **WBJEE** — deactivate **west-bengal-joint-entrance-examinations-board** (7da7272a-3b27-4caf-87f1-0ee550c01e9b); merge into **wbjee** (6aee3463-2af7-442d-a3f5-9d2a79e2c560). Reason: long-slug duplicate.
- **AP EAPCET** — deactivate **ap-eapcet** (5e8b29e1-d73b-4550-8981-d9ac7b924806); merge into **ap-eamcet** (6e861fe9-beff-4560-b145-df130ae8d77b). Reason: alternate-name duplicate.
- **CEED** — deactivate **ceed** (5c6ea222-e568-42bd-b6a2-4cd84e1c4da7); merge into **CEED** (68c8cf19-b7c5-4624-a2c7-21a1df96dd90). Reason: case-only slug duplicate; CEED is distinct from UCEED.
- **Banaras Hindu University Postgraduate Entrance Test** — deactivate **banaras-hindu-university-postgraduate-entrance-test** (957a6d86-8938-4af2-8b5d-306d63587965); merge into **bhu-pet** (0375f25c-63d1-48f7-8515-09344f131150). Reason: long-slug duplicate.
- **CUET UG** — deactivate **cuet-ug** (914acdc7-befc-42c0-863e-c04cf9bde4db); merge into **cuet-2026** (f31d18ac-0e9c-4648-b979-856b3f24fbfa). Reason: same NTA CUET UG route; lower-quality duplicate approved for removal.

## Important naming note

- UCEED and CEED are not duplicates of each other. They are separate design entrance exams; only their extra rows are removed.
- CUET UG duplicate approval from the earlier review is included.
- The JEE Main demo row is included because it is not a real production exam listing.

## Apply safely

1. Back up the live exams table.
2. Merge content and references using merge_to_id.
3. Confirm duplicate slugs are not needed by active routes.
4. Set is_active=false for every deletion id in the JSON manifest.
5. Verify /exams, sitemap output and redirects before any hard delete.
