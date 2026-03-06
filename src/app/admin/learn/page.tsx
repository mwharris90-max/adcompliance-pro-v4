"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Plus,
  Search,
  Loader2,
  Trash2,
  X,
  BookOpen,
  HelpCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────

interface RefData {
  id: string;
  name: string;
}

interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  examples: { good?: string; bad?: string; explanation: string }[] | null;
  videoUrl: string | null;
  videoTitle: string | null;
  platformId: string | null;
  categoryId: string | null;
  countryId: string | null;
  tags: string[];
  sortOrder: number;
  published: boolean;
  platform: { name: string } | null;
  category: { name: string } | null;
  country: { name: string } | null;
}

interface ProblemTerm {
  term: string;
  explanation: string;
}

interface Quiz {
  id: string;
  question: string;
  adCopy: string;
  problemTerms: ProblemTerm[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
  articleId: string | null;
  platformId: string | null;
  categoryId: string | null;
  tags: string[];
  sortOrder: number;
  published: boolean;
  article: { title: string; slug: string } | null;
  platform: RefData | null;
  category: RefData | null;
}

type Tab = "articles" | "quizzes";

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HARD: "bg-red-100 text-red-800 border-red-200",
};

// ─── Page ────────────────────────────────────────────────────

export default function AdminLearnPage() {
  const [tab, setTab] = useState<Tab>("articles");
  const [platforms, setPlatforms] = useState<RefData[]>([]);
  const [categories, setCategories] = useState<RefData[]>([]);
  const [countries, setCountries] = useState<(RefData & { code: string })[]>([]);
  const [articlesList, setArticlesList] = useState<Article[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/platform-rules?status=all").then((r) => r.json()),
      fetch("/api/admin/countries").then((r) => r.json()),
      fetch("/api/admin/learn").then((r) => r.json()),
    ]).then(([catJson, rulesJson, countryJson, articlesJson]) => {
      if (catJson.success) setCategories(catJson.data);
      if (rulesJson.success) {
        const ps = new Map<string, RefData>();
        rulesJson.data.forEach((r: { platform: RefData }) => ps.set(r.platform.id, r.platform));
        setPlatforms(Array.from(ps.values()));
      }
      if (countryJson.success) setCountries(countryJson.data);
      if (articlesJson.articles) setArticlesList(articlesJson.articles);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Resources Manager</h1>
        <p className="text-slate-500 mt-1">
          Manage policy articles and interactive quizzes for the learning centre.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab("articles")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "articles"
              ? "border-[#1A56DB] text-[#1A56DB]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Articles
        </button>
        <button
          onClick={() => setTab("quizzes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "quizzes"
              ? "border-[#1A56DB] text-[#1A56DB]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          Quizzes
        </button>
      </div>

      {tab === "articles" ? (
        <ArticlesTab
          platforms={platforms}
          categories={categories}
          countries={countries}
        />
      ) : (
        <QuizzesTab
          platforms={platforms}
          categories={categories}
          articles={articlesList}
        />
      )}
    </div>
  );
}

// ─── Articles Tab ────────────────────────────────────────────

function ArticlesTab({
  platforms,
  categories,
  countries,
}: {
  platforms: RefData[];
  categories: RefData[];
  countries: (RefData & { code: string })[];
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [form, setForm] = useState(emptyArticleForm());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchArticles = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/learn")
      .then((r) => r.json())
      .then((json) => setArticles(json.articles ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const filtered = articles.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  function openCreate() {
    setForm(emptyArticleForm());
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(a: Article) {
    setEditArticle(a);
    setForm({
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      content: a.content,
      examples: (a.examples ?? []) as { good?: string; bad?: string; explanation: string }[],
      videoUrl: a.videoUrl ?? "",
      videoTitle: a.videoTitle ?? "",
      platformId: a.platformId ?? "",
      categoryId: a.categoryId ?? "",
      countryId: a.countryId ?? "",
      tags: a.tags.join(", "),
      sortOrder: a.sortOrder,
      published: a.published,
    });
    setError(null);
    setSheetOpen(true);
  }

  function buildPayload() {
    return {
      title: form.title,
      slug: form.slug,
      summary: form.summary,
      content: form.content,
      examples: form.examples.length > 0 ? form.examples : undefined,
      videoUrl: form.videoUrl || undefined,
      videoTitle: form.videoTitle || undefined,
      platformId: form.platformId || undefined,
      categoryId: form.categoryId || undefined,
      countryId: form.countryId || undefined,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sortOrder: form.sortOrder,
      published: form.published,
    };
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (res.ok) {
        setCreateOpen(false);
        fetchArticles();
      } else {
        setError(json.error ?? "Create failed");
      }
    });
  }

  function handleSave() {
    if (!editArticle) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/learn/${editArticle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (res.ok) {
        setSheetOpen(false);
        setEditArticle(null);
        fetchArticles();
      } else {
        setError(json.error ?? "Save failed");
      }
    });
  }

  async function togglePublished(a: Article) {
    await fetch(`/api/admin/learn/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !a.published }),
    });
    fetchArticles();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/learn/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (sheetOpen && editArticle?.id === deleteTarget.id) {
      setSheetOpen(false);
      setEditArticle(null);
    }
    fetchArticles();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search articles..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Article
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-slate-400" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  No articles found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-noedit]")) return;
                    openEdit(a);
                  }}
                >
                  <TableCell className="font-medium text-sm max-w-xs">
                    <p className="truncate">{a.title}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{a.slug}</p>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    <div className="flex flex-wrap gap-1">
                      {a.platform && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{a.platform.name}</span>}
                      {a.category && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{a.category.name}</span>}
                      {a.country && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{a.country.name}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    <div className="flex flex-wrap gap-1">
                      {a.tags.slice(0, 3).map((t) => (
                        <span key={t} className="bg-slate-100 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                      {a.tags.length > 3 && <span className="text-slate-400">+{a.tags.length - 3}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{a.sortOrder}</TableCell>
                  <TableCell data-noedit>
                    <Switch checked={a.published} onCheckedChange={() => togglePublished(a)} />
                  </TableCell>
                  <TableCell data-noedit className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(a); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Article</DialogTitle></DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <ArticleForm form={form} setForm={setForm} platforms={platforms} categories={categories} countries={countries} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending || !form.title || !form.slug || !form.content}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditArticle(null); }}>
        <SheetContent className="w-[580px] sm:w-[640px] overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Article</SheetTitle></SheetHeader>
          {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="mt-6">
            <ArticleForm form={form} setForm={setForm} platforms={platforms} categories={categories} countries={countries} />
          </div>
          <SheetFooter className="mt-8 flex-col gap-2 sm:flex-col">
            <Button variant="destructive" className="w-full gap-2" onClick={() => editArticle && setDeleteTarget(editArticle)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button className="w-full" onClick={handleSave} disabled={isPending || !form.title || !form.slug || !form.content}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Article</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            Permanently delete &ldquo;{deleteTarget?.title}&rdquo;? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Article Form ────────────────────────────────────────────

function emptyArticleForm() {
  return {
    title: "",
    slug: "",
    summary: "",
    content: "",
    examples: [] as { good?: string; bad?: string; explanation: string }[],
    videoUrl: "",
    videoTitle: "",
    platformId: "",
    categoryId: "",
    countryId: "",
    tags: "",
    sortOrder: 0,
    published: true,
  };
}

function ArticleForm({
  form,
  setForm,
  platforms,
  categories,
  countries,
}: {
  form: ReturnType<typeof emptyArticleForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyArticleForm>>>;
  platforms: RefData[];
  categories: RefData[];
  countries: (RefData & { code: string })[];
}) {
  function autoSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Title *</Label>
          <Input
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              setForm((f) => ({ ...f, title, slug: f.slug || autoSlug(title) }));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Slug *</Label>
          <Input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="auto-generated-from-title"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Summary *</Label>
        <Textarea rows={2} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Content (Markdown) *</Label>
        <Textarea rows={10} className="font-mono text-xs" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
      </div>

      {/* Examples */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Examples</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setForm((f) => ({ ...f, examples: [...f.examples, { good: "", bad: "", explanation: "" }] }))}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Example
          </Button>
        </div>
        {form.examples.map((ex, i) => (
          <div key={i} className="border border-slate-200 rounded-md p-3 space-y-2 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Example {i + 1}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                onClick={() => setForm((f) => ({ ...f, examples: f.examples.filter((_, idx) => idx !== i) }))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              placeholder="Good example"
              value={ex.good ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, examples: f.examples.map((x, idx) => idx === i ? { ...x, good: e.target.value } : x) }))}
            />
            <Input
              placeholder="Bad example"
              value={ex.bad ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, examples: f.examples.map((x, idx) => idx === i ? { ...x, bad: e.target.value } : x) }))}
            />
            <Textarea
              rows={2}
              placeholder="Explanation"
              value={ex.explanation}
              onChange={(e) => setForm((f) => ({ ...f, examples: f.examples.map((x, idx) => idx === i ? { ...x, explanation: e.target.value } : x) }))}
            />
          </div>
        ))}
      </div>

      {/* Video */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">YouTube URL</Label>
          <Input type="url" value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Video Title</Label>
          <Input value={form.videoTitle} onChange={(e) => setForm((f) => ({ ...f, videoTitle: e.target.value }))} />
        </div>
      </div>

      {/* Scope */}
      <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Scope (optional)</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Platform</Label>
            <Select value={form.platformId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, platformId: v === "none" ? "" : v }))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any</SelectItem>
                {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={form.categoryId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === "none" ? "" : v }))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Country</Label>
            <Select value={form.countryId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, countryId: v === "none" ? "" : v }))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any</SelectItem>
                {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tags, order, published */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Tags (comma-separated)</Label>
          <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="alcohol, meta, age-gate" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Sort Order</Label>
          <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} />
        <Label className="text-sm">Published</Label>
      </div>
    </div>
  );
}

// ─── Quizzes Tab ─────────────────────────────────────────────

function QuizzesTab({
  platforms,
  categories,
  articles,
}: {
  platforms: RefData[];
  categories: RefData[];
  articles: Article[];
}) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Quiz | null>(null);
  const [form, setForm] = useState(emptyQuizForm());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchQuizzes = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/learn/quizzes")
      .then((r) => r.json())
      .then((json) => setQuizzes(json.quizzes ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  function openCreate() {
    setForm(emptyQuizForm());
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(q: Quiz) {
    setEditQuiz(q);
    setForm({
      question: q.question,
      adCopy: q.adCopy,
      problemTerms: q.problemTerms,
      difficulty: q.difficulty,
      articleId: q.articleId ?? "",
      platformId: q.platformId ?? "",
      categoryId: q.categoryId ?? "",
      tags: q.tags.join(", "),
      sortOrder: q.sortOrder,
      published: q.published,
    });
    setError(null);
    setSheetOpen(true);
  }

  function buildPayload() {
    return {
      question: form.question,
      adCopy: form.adCopy,
      problemTerms: form.problemTerms.filter((pt) => pt.term.trim()),
      difficulty: form.difficulty,
      articleId: form.articleId || undefined,
      platformId: form.platformId || undefined,
      categoryId: form.categoryId || undefined,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sortOrder: form.sortOrder,
      published: form.published,
    };
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/learn/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (res.ok) {
        setCreateOpen(false);
        fetchQuizzes();
      } else {
        setError(json.error ?? "Create failed");
      }
    });
  }

  function handleSave() {
    if (!editQuiz) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/learn/quizzes/${editQuiz.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (res.ok) {
        setSheetOpen(false);
        setEditQuiz(null);
        fetchQuizzes();
      } else {
        setError(json.error ?? "Save failed");
      }
    });
  }

  async function togglePublished(q: Quiz) {
    await fetch(`/api/admin/learn/quizzes/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !q.published }),
    });
    fetchQuizzes();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/learn/quizzes/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (sheetOpen && editQuiz?.id === deleteTarget.id) {
      setSheetOpen(false);
      setEditQuiz(null);
    }
    fetchQuizzes();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""}</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Quiz
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead>Article</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-slate-400" />
                </TableCell>
              </TableRow>
            ) : quizzes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  No quizzes yet. Create one to test user knowledge.
                </TableCell>
              </TableRow>
            ) : (
              quizzes.map((q) => (
                <TableRow
                  key={q.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-noedit]")) return;
                    openEdit(q);
                  }}
                >
                  <TableCell className="font-medium text-sm max-w-xs">
                    <p className="truncate">{q.question}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{q.adCopy.slice(0, 60)}...</p>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${DIFFICULTY_COLORS[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{q.problemTerms.length}</TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-[140px] truncate">
                    {q.article?.title ?? "—"}
                  </TableCell>
                  <TableCell data-noedit>
                    <Switch checked={q.published} onCheckedChange={() => togglePublished(q)} />
                  </TableCell>
                  <TableCell data-noedit className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(q); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Quiz</DialogTitle></DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <QuizForm form={form} setForm={setForm} platforms={platforms} categories={categories} articles={articles} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending || !form.question || !form.adCopy || form.problemTerms.filter((pt) => pt.term.trim()).length === 0}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditQuiz(null); }}>
        <SheetContent className="w-[580px] sm:w-[640px] overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Quiz</SheetTitle></SheetHeader>
          {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="mt-6">
            <QuizForm form={form} setForm={setForm} platforms={platforms} categories={categories} articles={articles} />
          </div>
          <SheetFooter className="mt-8 flex-col gap-2 sm:flex-col">
            <Button variant="destructive" className="w-full gap-2" onClick={() => editQuiz && setDeleteTarget(editQuiz)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button className="w-full" onClick={handleSave} disabled={isPending || !form.question || !form.adCopy}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Quiz</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Permanently delete this quiz? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Quiz Form ───────────────────────────────────────────────

function emptyQuizForm() {
  return {
    question: "Identify the non-compliant terms in this ad copy:",
    adCopy: "",
    problemTerms: [{ term: "", explanation: "" }] as ProblemTerm[],
    difficulty: "MEDIUM" as "EASY" | "MEDIUM" | "HARD",
    articleId: "",
    platformId: "",
    categoryId: "",
    tags: "",
    sortOrder: 0,
    published: true,
  };
}

function QuizForm({
  form,
  setForm,
  platforms,
  categories,
  articles,
}: {
  form: ReturnType<typeof emptyQuizForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyQuizForm>>>;
  platforms: RefData[];
  categories: RefData[];
  articles: Article[];
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Question *</Label>
        <Input value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Ad Copy *</Label>
        <Textarea
          rows={4}
          placeholder="Paste the ad copy that the user must analyse..."
          value={form.adCopy}
          onChange={(e) => setForm((f) => ({ ...f, adCopy: e.target.value }))}
        />
        <p className="text-xs text-slate-400">The user will see this text and click on the words they think are non-compliant.</p>
      </div>

      {/* Difficulty */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Difficulty</Label>
        <div className="flex gap-2">
          {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setForm((f) => ({ ...f, difficulty: d }))}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-all ${
                form.difficulty === d
                  ? DIFFICULTY_COLORS[d] + " ring-2 ring-offset-1 ring-current"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Problem Terms */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Problem Terms *</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setForm((f) => ({ ...f, problemTerms: [...f.problemTerms, { term: "", explanation: "" }] }))}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Term
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          Each term is a word or phrase in the ad copy that the user should identify as non-compliant.
        </p>
        {form.problemTerms.map((pt, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="Problem term (e.g. 'guaranteed results')"
                value={pt.term}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    problemTerms: f.problemTerms.map((x, idx) => (idx === i ? { ...x, term: e.target.value } : x)),
                  }))
                }
              />
              <Input
                placeholder="Why is this non-compliant?"
                value={pt.explanation}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    problemTerms: f.problemTerms.map((x, idx) => (idx === i ? { ...x, explanation: e.target.value } : x)),
                  }))
                }
              />
            </div>
            {form.problemTerms.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 mt-1"
                onClick={() => setForm((f) => ({ ...f, problemTerms: f.problemTerms.filter((_, idx) => idx !== i) }))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Linked article */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Linked Article</Label>
        <Select value={form.articleId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, articleId: v === "none" ? "" : v }))}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {articles.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-400">Link to a policy article for &ldquo;Learn more&rdquo; after the quiz.</p>
      </div>

      {/* Scope */}
      <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Scope (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Platform</Label>
            <Select value={form.platformId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, platformId: v === "none" ? "" : v }))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any</SelectItem>
                {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={form.categoryId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === "none" ? "" : v }))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tags, order, published */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Tags</Label>
          <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="alcohol, gambling" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Sort Order</Label>
          <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} />
        <Label className="text-sm">Published</Label>
      </div>
    </div>
  );
}
