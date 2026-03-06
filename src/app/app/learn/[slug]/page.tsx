"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Loader2,
  Monitor,
  Tag,
  Globe,
  ArrowLeft,
  ChevronRight,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Example {
  good?: string;
  bad?: string;
  explanation: string;
}

interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  examples: Example[] | null;
  videoUrl: string | null;
  videoTitle: string | null;
  tags: string[];
  platform: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  country: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface RelatedArticle {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  platform: { name: string } | null;
  category: { name: string } | null;
}

/** Convert a YouTube URL to an embeddable URL */
function toEmbedUrl(url: string): string {
  // Handle youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/
  );
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
}

/** Simple markdown-to-HTML for article content */
function renderMarkdown(md: string): string {
  return md
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-slate-900 mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-slate-900 mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-900 mt-8 mb-3">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#1A56DB] hover:underline">$1</a>'
    )
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-slate-600 mb-1">$1</li>')
    // Paragraphs (lines that aren't already wrapped)
    .replace(/^(?!<[hla-z])((?!<li).+)$/gm, '<p class="text-sm text-slate-600 mb-3 leading-relaxed">$1</p>')
    // Line breaks
    .replace(/\n\n/g, "");
}

export default function ArticlePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<RelatedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/learn/${slug}`)
      .then((r) => {
        if (!r.ok) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setArticle(data.article);
          setRelated(data.related ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          Article not found
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          This policy guide may have been removed or is not yet published.
        </p>
        <Link href="/app/learn">
          <Button variant="outline">Back to Policy Library</Button>
        </Link>
      </div>
    );
  }

  const examples = (article.examples ?? []) as Example[];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href="/app/learn"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Policy Library
      </Link>

      {/* Article header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {article.platform && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Monitor className="h-3 w-3" />
              {article.platform.name}
            </Badge>
          )}
          {article.category && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Tag className="h-3 w-3" />
              {article.category.name}
            </Badge>
          )}
          {article.country && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Globe className="h-3 w-3" />
              {article.country.name}
            </Badge>
          )}
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {article.title}
        </h1>
        <p className="text-slate-500">{article.summary}</p>

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-slate-100 text-slate-500 rounded-full px-2.5 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Video section */}
      {article.videoUrl && (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="aspect-video bg-black">
            <iframe
              src={toEmbedUrl(article.videoUrl)}
              title={article.videoTitle ?? article.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {article.videoTitle && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm font-medium text-slate-700">
                  {article.videoTitle}
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Article content */}
      <div
        className="prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
      />

      {/* Examples section */}
      {examples.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500">
              <Lightbulb className="h-3.5 w-3.5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Examples</h2>
          </div>

          {examples.map((ex, i) => (
            <Card
              key={i}
              className="border-slate-200 shadow-sm overflow-hidden"
            >
              <CardContent className="pt-4 pb-4 space-y-3">
                {/* Good example */}
                {ex.good && (
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                        Good Example
                      </p>
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                        <p className="text-sm text-green-900 italic">
                          &ldquo;{ex.good}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bad example */}
                {ex.bad && (
                  <div className="flex gap-3">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
                        Bad Example
                      </p>
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-sm text-red-900 italic">
                          &ldquo;{ex.bad}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Explanation */}
                <div className="flex gap-3">
                  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                      Why?
                    </p>
                    <p className="text-sm text-slate-600">{ex.explanation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Related articles */}
      {related.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Related Guides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {related.map((r) => (
              <Link key={r.slug} href={`/app/learn/${r.slug}`}>
                <Card className="border-slate-200 hover:shadow-md transition-all hover:-translate-y-0.5 h-full group">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      {r.platform && (
                        <Badge variant="secondary" className="text-[10px]">
                          {r.platform.name}
                        </Badge>
                      )}
                      {r.category && (
                        <Badge variant="secondary" className="text-[10px]">
                          {r.category.name}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#1A56DB] transition-colors mb-1">
                      {r.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {r.summary}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-[#1A56DB] font-medium">
                      Read guide
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Last updated */}
      <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
        Last updated:{" "}
        {new Date(article.updatedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
