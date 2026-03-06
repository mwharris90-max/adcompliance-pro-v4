"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Loader2,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Lightbulb,
  Monitor,
  Tag,
  BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Quiz {
  id: string;
  question: string;
  adCopy: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  article: { slug: string; title: string } | null;
  platform: { name: string } | null;
  category: { name: string } | null;
}

interface CheckResult {
  score: number;
  total: number;
  results: { term: string; found: boolean; explanation: string }[];
  falsePositives: string[];
}

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HARD: "bg-red-100 text-red-700",
};

export default function QuizPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);

  useEffect(() => {
    fetch("/api/learn/quizzes")
      .then((r) => r.json())
      .then((data) => setQuizzes(data.quizzes ?? []))
      .finally(() => setLoading(false));
  }, []);

  function startQuiz(quiz: Quiz, index: number) {
    setActiveQuiz(quiz);
    setQuizIndex(index);
    setSelectedWords(new Set());
    setResult(null);
  }

  function toggleWord(word: string) {
    if (result) return; // locked after submit
    setSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  }

  async function submitAnswers() {
    if (!activeQuiz || selectedWords.size === 0) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/learn/quizzes/${activeQuiz.id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedTerms: Array.from(selectedWords) }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setChecking(false);
    }
  }

  function nextQuiz() {
    if (quizIndex < quizzes.length - 1) {
      startQuiz(quizzes[quizIndex + 1], quizIndex + 1);
    }
  }

  function retryQuiz() {
    if (activeQuiz) {
      setSelectedWords(new Set());
      setResult(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Quiz list view
  if (!activeQuiz) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/app/learn"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Policy Library
        </Link>

        <div className="border-l-[3px] border-amber-500 pl-3">
          <h1 className="text-xl font-semibold text-slate-900">Policy Quizzes</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Test your knowledge of advertising compliance. Read the ad copy and
            identify the non-compliant terms.
          </p>
        </div>

        {quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <HelpCircle className="h-10 w-10 text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium mb-1">No quizzes available yet</p>
            <p className="text-sm text-slate-400">
              Quizzes will appear here once they are published by an admin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz, i) => (
              <Card
                key={quiz.id}
                className="border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
                onClick={() => startQuiz(quiz, i)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={cn("text-[10px]", DIFFICULTY_COLORS[quiz.difficulty])}>
                          {quiz.difficulty}
                        </Badge>
                        {quiz.platform && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Monitor className="h-2.5 w-2.5" />
                            {quiz.platform.name}
                          </Badge>
                        )}
                        {quiz.category && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Tag className="h-2.5 w-2.5" />
                            {quiz.category.name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#1A56DB] transition-colors">
                        {quiz.question}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {quiz.adCopy.slice(0, 100)}...
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#1A56DB] transition-colors mt-1 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Active quiz view
  const words = tokeniseAdCopy(activeQuiz.adCopy);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => setActiveQuiz(null)}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to quizzes
      </button>

      {/* Quiz header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge className={cn("text-xs", DIFFICULTY_COLORS[activeQuiz.difficulty])}>
            {activeQuiz.difficulty}
          </Badge>
          <span className="text-xs text-slate-400">
            Quiz {quizIndex + 1} of {quizzes.length}
          </span>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{activeQuiz.question}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Click on the words or phrases you think are non-compliant, then submit
          your answer.
        </p>
      </div>

      {/* Ad copy with clickable words */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Ad Copy
          </p>
          <div className="leading-relaxed text-base select-none">
            {words.map((token, i) => {
              if (token.type === "space") {
                return <span key={i}>{token.text}</span>;
              }

              const isSelected = selectedWords.has(token.text);
              let highlightClass = "";

              if (result) {
                // After submit — show correct/incorrect
                const isCorrect = result.results.some(
                  (r) =>
                    r.found &&
                    (token.text.toLowerCase().includes(r.term.toLowerCase()) ||
                      r.term.toLowerCase().includes(token.text.toLowerCase()))
                );
                const isMissed = result.results.some(
                  (r) =>
                    !r.found &&
                    (token.text.toLowerCase().includes(r.term.toLowerCase()) ||
                      r.term.toLowerCase().includes(token.text.toLowerCase()))
                );

                if (isSelected && isCorrect) {
                  highlightClass = "bg-green-200 text-green-900 ring-2 ring-green-400";
                } else if (isSelected && !isCorrect) {
                  highlightClass = "bg-red-200 text-red-900 ring-2 ring-red-400 line-through";
                } else if (isMissed) {
                  highlightClass = "bg-amber-200 text-amber-900 ring-2 ring-amber-400";
                }
              } else if (isSelected) {
                highlightClass = "bg-[#1A56DB]/20 text-[#1A56DB] ring-2 ring-[#1A56DB]/40";
              }

              return (
                <span
                  key={i}
                  onClick={() => toggleWord(token.text)}
                  className={cn(
                    "rounded px-0.5 py-0.5 transition-all",
                    result
                      ? highlightClass
                      : cn(
                          "cursor-pointer hover:bg-slate-100",
                          highlightClass
                        )
                  )}
                >
                  {token.text}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {!result ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {selectedWords.size === 0
              ? "Click on words to select them"
              : `${selectedWords.size} word${selectedWords.size !== 1 ? "s" : ""} selected`}
          </p>
          <Button
            onClick={submitAnswers}
            disabled={checking || selectedWords.size === 0}
          >
            {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Answer
          </Button>
        </div>
      ) : (
        <>
          {/* Score */}
          <Card
            className={cn(
              "border shadow-sm",
              result.score === result.total
                ? "border-green-200 bg-green-50"
                : result.score > 0
                ? "border-amber-200 bg-amber-50"
                : "border-red-200 bg-red-50"
            )}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                {result.score === result.total ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-amber-500" />
                )}
                <div>
                  <p className="text-lg font-bold text-slate-900">
                    {result.score} / {result.total} correct
                  </p>
                  <p className="text-sm text-slate-600">
                    {result.score === result.total
                      ? "Perfect score! You identified all non-compliant terms."
                      : result.score > 0
                      ? "Good effort! Review the explanations below."
                      : "Keep learning! Check the explanations below to improve."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Explanations */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Explanations</h2>
            {result.results.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3 p-3 rounded-lg border",
                  r.found
                    ? "bg-green-50 border-green-200"
                    : "bg-amber-50 border-amber-200"
                )}
              >
                {r.found ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    &ldquo;{r.term}&rdquo;{" "}
                    {r.found ? (
                      <span className="text-green-600 text-xs font-normal">
                        — You found this!
                      </span>
                    ) : (
                      <span className="text-amber-600 text-xs font-normal">
                        — Missed
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">{r.explanation}</p>
                </div>
              </div>
            ))}
            {result.falsePositives.length > 0 && (
              <div className="flex gap-3 p-3 rounded-lg border bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">False positives</p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    You selected{" "}
                    {result.falsePositives.map((fp, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        &ldquo;{fp}&rdquo;
                      </span>
                    ))}{" "}
                    — these are actually compliant.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Related article link */}
          {activeQuiz.article && (
            <Link
              href={`/app/learn/${activeQuiz.article.slug}`}
              className="flex items-center gap-2 text-sm text-[#1A56DB] hover:underline"
            >
              <BookOpen className="h-4 w-4" />
              Learn more: {activeQuiz.article.title}
            </Link>
          )}

          {/* Next / Retry buttons */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={retryQuiz} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
            {quizIndex < quizzes.length - 1 && (
              <Button onClick={nextQuiz} className="gap-2">
                Next Quiz
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" onClick={() => setActiveQuiz(null)}>
              All Quizzes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Split ad copy into word and space tokens for clickable rendering */
function tokeniseAdCopy(text: string): { type: "word" | "space"; text: string }[] {
  const tokens: { type: "word" | "space"; text: string }[] = [];
  const regex = /(\S+|\s+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const t = match[1];
    tokens.push({
      type: t.trim() ? "word" : "space",
      text: t,
    });
  }
  return tokens;
}
