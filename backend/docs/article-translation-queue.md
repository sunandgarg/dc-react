# Article translation queue

Publishing a DekhoCampus English original through Articles, review approval, Blog Studio or the existing agent save path records nine translation requests in the same database transaction. Targets are Hindi, Tamil, Telugu, Kannada, Malayalam, Gujarati, Marathi, Bengali and Punjabi (Gurmukhi). English publication does not wait for translations.

This release implements **queuing only**. There is no translation worker, provider call or API spending. Connecting an engine and implementing validated translation publication are still required before automatic translated pages can go live. The production Auto Blog Agent and LinkedIn settings are unchanged.

## Deployment

Run the existing `npm --prefix backend run db:setup:runtime` deployment step before reloading the API. It creates `article_translation_queue` idempotently. The table is private and deliberately absent from generic REST schema metadata. No backfill runs and no existing article is changed. A queue write failure rolls back publication instead of silently losing translation requests.

The primary key is `(english_article_id, language_code)`. Repeated saves and republication do not duplicate requests or reset request dates. Editing an already published English article does not enrol the older library. Existing language records are joined at read time: published active versions are complete, other existing records can be resumed manually, and missing versions wait for an engine. Unpublishing the English original pauses missing versions. Deleting an original makes its requests inaccessible; a future worker must join against existing, published English parents before processing.

The editor reads `POST /v1/functions/article-translation-queue` with `article_id` and `site_scope: "dekhocampus"`. Access requires an authenticated article editor. Writers cannot inspect another writer's unpublished original through this endpoint. The response contains queue status, IDs and timestamps, not article content. Existing language-version controls remain available for manual work.

## Engine connection requirements

Use a free/self-hosted engine only after it is connected and validated for all nine languages. The queue stores intent, not frozen article text: load the latest English body, dedicated FAQs, metadata, official links and evidence images when processing. Recheck the source and language slot inside the article write lock before saving; preserve existing slugs, drafts and published versions. Never overwrite a manual translation or publish English placeholders. Use the existing publication policy, dedicated FAQ storage and linked-language fields, with factual and native-language quality checks before publishing. Source edits during generation must invalidate that generated result. Failed or incomplete translations must remain unpublished. No processing or retry loop is included in this queue-only release.
