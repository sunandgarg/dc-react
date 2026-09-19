# IndexNow operations

## Configuration

- Endpoint: `https://api.indexnow.org/indexnow`
- Public key location: `https://dekhocampus.com/5ba0c5fbac113b43df29736b4b27dc56.txt`
- Maximum batch size: 10,000 canonical DekhoCampus URLs

## Trigger rules

Queue a URL when a DekhoCampus article is published, materially edited, unpublished or deleted. The sitemap publication job may notify recent News URLs. Do not bulk-submit unchanged historic URLs.

## Safety and retry behavior

The client rejects non-HTTPS and non-DekhoCampus URLs, removes fragments and duplicates, batches submissions and retries transient queue failures without blocking publishing. IndexNow acceptance means the change was received, not that the URL is indexed.

## Verification

1. Fetch the public key and confirm its body equals the filename.
2. Publish or materially update one test article.
3. Confirm an IndexNow `200` or `202` response in application logs.
4. Inspect the URL later in Bing Webmaster Tools.
