const CANONICAL_HOST = "dekhocampus.com";

export default {
  fetch(request) {
    const canonicalUrl = new URL(request.url);
    canonicalUrl.protocol = "https:";
    canonicalUrl.hostname = CANONICAL_HOST;
    canonicalUrl.port = "";

    return Response.redirect(canonicalUrl.toString(), 308);
  },
};
