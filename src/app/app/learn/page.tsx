"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Loader2,
  Monitor,
  Tag,
  PlayCircle,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  videoUrl: string | null;
  tags: string[];
  platformId: string | null;
  categoryId: string | null;
  platform: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  country: { id: string; name: string } | null;
}

interface Filters {
  platforms: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  tags: string[];
}

export default function LearnPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(true);

  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (platformFilter) params.set("platform", platformFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (tagFilter) params.set("tag", tagFilter);
    if (search.trim()) params.set("q", search.trim());

    setLoading(true);
    fetch(`/api/learn?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setArticles(data.articles ?? []);
        if (!filters) setFilters(data.filters ?? null);
      })
      .finally(() => setLoading(false));
  }, [platformFilter, categoryFilter, tagFilter, search]);

  const clearFilters = () => {
    setPlatformFilter("");
    setCategoryFilter("");
    setTagFilter("");
    setSearch("");
  };

  const hasFilters = platformFilter || categoryFilter || tagFilter || search;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-l-[3px] border-green-500 pl-3">
        <h1 className="text-xl font-semibold text-slate-900">Policy Library</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Learn about advertising policies, understand the rules, and see
          real-world examples. Each guide includes explanations and video
          resources.
        </p>
      </div>

      {/* Search & filters */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-4 pb-4">
          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search policies..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] transition-colors"
            />
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />

            {/* Platform filter */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
            >
              <option value="">All Platforms</option>
              {filters?.platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Category filter */}
            {(filters?.categories.length ?? 0) > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              >
                <option value="">All Categories</option>
                {filters?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {/* Tag filter */}
            {(filters?.tags.length ?? 0) > 0 && (
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              >
                <option value="">All Tags</option>
                {filters?.tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <BookOpen className="h-10 w-10 text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium mb-1">
            {hasFilters ? "No matching articles" : "No articles yet"}
          </p>
          <p className="text-sm text-slate-400 mb-4">
            {hasFilters
              ? "Try adjusting your filters or search query."
              : "Policy guides will appear here once they are published."}
          </p>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Article grid */}
      {!loading && articles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <Link key={article.id} href={`/app/learn/${article.slug}`}>
              <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 h-full group">
                <CardContent className="pt-5 pb-5 flex flex-col h-full">
                  {/* Platform/category badges */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {article.platform && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] gap-1"
                      >
                        <Monitor className="h-2.5 w-2.5" />
                        {article.platform.name}
                      </Badge>
                    )}
                    {article.category && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] gap-1"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {article.category.name}
                      </Badge>
                    )}
                    {article.videoUrl && (
                      <Badge className="bg-red-50 text-red-600 border-red-100 text-[10px] gap-1">
                        <PlayCircle className="h-2.5 w-2.5" />
                        Video
                      </Badge>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-slate-900 mb-1.5 group-hover:text-[#1A56DB] transition-colors">
                    {article.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-xs text-slate-500 flex-1 line-clamp-3">
                    {article.summary}
                  </p>

                  {/* Tags */}
                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                      {article.tags.length > 3 && (
                        <span className="text-[10px] text-slate-400">
                          +{article.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Read more */}
                  <div className="mt-3 flex items-center gap-1 text-xs text-[#1A56DB] font-medium group-hover:gap-2 transition-all">
                    Read guide
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
