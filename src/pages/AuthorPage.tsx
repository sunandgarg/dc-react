import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { backendClient } from "@/integrations/backend/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Linkedin, Twitter, Globe, Mail, ArrowRight, Newspaper, GraduationCap, BookOpen, FileText, Award, Briefcase, Library } from "lucide-react";
import { RichText } from "@/components/detail/RichText";
import { safeHttpUrl } from "@/lib/safeExternalUrl";
import { AUTHOR_SOURCES, AuthorSource, fetchAuthorContributions } from "@/lib/authorContributions";
import { absoluteSiteUrl } from "@/lib/constant";
import { plainText } from "@/lib/plainText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Author {
  id: string; slug: string; name: string; designation: string; photo: string;
  short_bio: string; bio: string; expertise: string[];
  email: string; linkedin_url: string; twitter_url: string; website_url: string;
}

const ICONS = { articles: Newspaper, colleges: GraduationCap, courses: BookOpen, exams: FileText, scholarships: Award, career_profiles: Briefcase, study_subjects: Library };

function Contributions({ source, author, search, hideEmpty }: { source: AuthorSource; author: Author; search: string; hideEmpty: boolean }) {
  const query = useInfiniteQuery({
    queryKey: ["author-contributions", author.id, author.name, source.table, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchAuthorContributions(source, author, pageParam, search),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    retry: 1,
  });
  const items = query.data?.pages.flatMap((page) => page.rows) || [];
  const total = query.data?.pages[0].count;
  const Icon = ICONS[source.table];
  if (hideEmpty && !query.isPending && !query.isError && !items.length) return null;
  return (
    <section className="mb-8" aria-label={source.label}>
      <h3 className="font-semibold mb-3 flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{source.label}{total != null && ` (${total})`}</h3>
      {query.isPending && <p className="text-sm text-muted-foreground" role="status">Loading {source.label.toLowerCase()}…</p>}
      {query.isError && <div role="alert" className="mb-3 rounded-lg border p-3 text-sm">Could not load {source.label.toLowerCase()}. <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>}
      {!query.isPending && !query.isError && !items.length && <p className="text-sm text-muted-foreground">{search ? "No matching contributions." : `No published ${source.label.toLowerCase()} yet.`}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const image = safeHttpUrl(item.featured_image || item.image || item.cover_image);
          const date = new Date(item.created_at);
          return (
            <Link key={item.id} to={source.href(item)} className="bg-card border border-border rounded-xl p-3 hover:border-primary/40 transition-colors">
              {image && <img src={image} alt="" className="w-full h-32 object-cover rounded-lg mb-2" loading="lazy" />}
              <p className="font-semibold text-sm text-foreground line-clamp-2">{item.title || item.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{plainText(item.description)}</p>
              {!Number.isNaN(date.getTime()) && <time dateTime={item.created_at} className="block text-xs text-muted-foreground mt-2">{date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</time>}
              <p className="text-xs text-primary mt-2 inline-flex items-center gap-1">Read <ArrowRight className="w-3 h-3" /></p>
            </Link>
          );
        })}
      </div>
      {query.hasNextPage && <Button className="mt-4" variant="outline" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : `Load more ${source.label.toLowerCase()}`}</Button>}
    </section>
  );
}

export default function AuthorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search), 300); return () => window.clearTimeout(timer); }, [search]);
  const profile = useQuery({
    queryKey: ["public-author", slug],
    queryFn: async () => {
      const { data, error } = await backendClient.from("authors").select("id,slug,name,designation,photo,short_bio,bio,expertise,email,linkedin_url,twitter_url,website_url").eq("slug", slug).eq("is_active", true).maybeSingle();
      if (error) throw error;
      return data as Author | null;
    },
    retry: 1,
  });
  const author = profile.data;
  if (profile.isPending) return <div className="min-h-screen bg-background"><Navbar /><div className="container py-20 text-center text-muted-foreground">Loading…</div><Footer /></div>;
  if (profile.isError) return <div className="min-h-screen bg-background"><Navbar /><main className="container py-20 text-center"><p role="alert" className="mb-4">Could not load this writer profile.</p><Button onClick={() => void profile.refetch()}>Try again</Button></main><Footer /></div>;
  if (!author) return <div className="min-h-screen bg-background"><Navbar /><div className="container py-20 text-center text-muted-foreground">Author not found.</div><Footer /></div>;

  const ldjson = {
    "@context": "https://schema.org", "@type": "Person",
    name: author.name, jobTitle: author.designation, image: author.photo, description: author.short_bio,
    url: absoluteSiteUrl(`/author/${author.slug}`),
    sameAs: [author.linkedin_url, author.twitter_url, author.website_url].filter(Boolean),
  };
  const linkedInUrl = safeHttpUrl(author.linkedin_url);
  const twitterUrl = safeHttpUrl(author.twitter_url);
  const websiteUrl = safeHttpUrl(author.website_url);

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`${author.name}${author.designation ? ` - ${author.designation}` : ""} | DekhoCampus`} description={author.short_bio || `${author.name} on DekhoCampus`} canonical={`/author/${author.slug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson).replace(/</g, "\\u003c") }} />
      <Navbar />
      <main>
        <section className="bg-gradient-to-br from-primary/5 to-background border-b border-border">
          <div className="container py-10 md:py-14 flex flex-col md:flex-row gap-6 items-center md:items-start">
            {author.photo ? <img src={author.photo} alt={author.name} className="w-28 h-28 md:w-36 md:h-36 rounded-2xl object-cover border border-border" /> : <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl bg-primary/10" />}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl md:text-4xl font-bold text-foreground">{author.name}</h1>
              {author.designation && <p className="text-primary font-medium mt-1">{author.designation}</p>}
              {author.short_bio && <p className="text-muted-foreground mt-2 max-w-2xl">{author.short_bio}</p>}
              {author.expertise?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
                  {author.expertise.map(t => <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>)}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                {linkedInUrl && <a aria-label="LinkedIn profile" href={linkedInUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary"><Linkedin className="w-4 h-4" /></a>}
                {twitterUrl && <a aria-label="Twitter profile" href={twitterUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary"><Twitter className="w-4 h-4" /></a>}
                {websiteUrl && <a aria-label="Writer website" href={websiteUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary"><Globe className="w-4 h-4" /></a>}
                {author.email && <a aria-label="Email writer" href={`mailto:${author.email}`} className="p-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary"><Mail className="w-4 h-4" /></a>}
              </div>
            </div>
          </div>
        </section>

        {author.bio && (
          <section className="container py-8">
            <h2 className="text-lg font-bold text-foreground mb-3">About {author.name.split(" ")[0]}</h2>
            <RichText html={author.bio} className="prose-sm" />
          </section>
        )}

        <section id="contributions" className="container py-6 scroll-mt-24">
          <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">Published contributions</h2>
          <p className="text-sm text-muted-foreground mb-4">Browse recent and older work by {author.name}.</p>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Input aria-label="Search contributions" placeholder="Search by title" value={search} onChange={(event) => setSearch(event.target.value)} className="sm:max-w-sm" />
            <select aria-label="Content type" value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All content</option>
              {AUTHOR_SOURCES.map((source) => <option key={source.table} value={source.table}>{source.label}</option>)}
            </select>
          </div>
          {AUTHOR_SOURCES.filter((source) => type === "all" || type === source.table).map((source) => <Contributions key={`${author.id}:${source.table}`} source={source} author={author} search={debouncedSearch} hideEmpty={type === "all" && source.table !== "articles"} />)}
        </section>
      </main>
      <Footer />
    </div>
  );
}
