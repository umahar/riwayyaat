"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  AdminHadithDetail,
  AdminHadithPayload,
  AdminHadithSummary,
  AdminIdentifierInput,
  AdminLookups,
  AdminNarratorInput,
} from "@/features/admin/types";

type FormState = {
  sourceId: number | null;
  bookId: number | null;
  chapterId: number | null;
  hadithNumber: string;
  displayNumber: string;
  matn: string;
  sanad: string;
  location: string;
  narrationLevelId?: number | null;
  chainTypeId?: number | null;
  attributionTypeId?: number | null;
  narrators: AdminNarratorInput[];
  tags: string;
  identifiers: AdminIdentifierInput[];
  gradeId: number | null;
  scholarId: number | null;
};

const EMPTY_FORM: FormState = {
  sourceId: null,
  bookId: null,
  chapterId: null,
  hadithNumber: "",
  displayNumber: "",
  matn: "",
  sanad: "",
  location: "",
  narrators: [{ name: "", role: "narrator" }],
  tags: "",
  identifiers: [],
  gradeId: null,
  scholarId: null,
};

export function HadithAdminPage() {
  const [lookups, setLookups] = useState<AdminLookups | null>(null);
  const [hadithList, setHadithList] = useState<AdminHadithSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    book: "",
    chapter: "",
    tag: "",
    narrator: "",
    source: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const res = await fetch("/api/admin/lookups");
        if (!res.ok) throw new Error(`Failed to load lookups (${res.status})`);
        const payload = (await res.json()) as { data: AdminLookups };
        setLookups(payload.data);
      } catch (err) {
        console.error(err);
        setError("Unable to load lookup data");
      }
    };
    loadLookups();
  }, []);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filters.book, filters.chapter, filters.tag, filters.narrator, filters.source]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const booksForSource = useMemo(
    () => (formState.sourceId ? lookups?.books.filter((book) => book.sourceId === formState.sourceId) ?? [] : []),
    [lookups, formState.sourceId],
  );
  const chaptersForBook = useMemo(
    () => (formState.bookId ? lookups?.chapters.filter((ch) => ch.bookId === formState.bookId) ?? [] : []),
    [lookups, formState.bookId],
  );

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (filters.book) params.set("book", filters.book);
      if (filters.chapter) params.set("chapter", filters.chapter);
      if (filters.tag) params.set("tag", filters.tag);
      if (filters.narrator) params.set("narrator", filters.narrator);
      if (filters.source) params.set("source", filters.source);
      const res = await fetch(`/api/admin/hadith?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load hadith (${res.status})`);
      const payload = (await res.json()) as { items: AdminHadithSummary[]; total: number };
      setHadithList(payload.items ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      console.error(err);
      setError("Unable to load hadith");
      setHadithList([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(id: number) {
    setFormMode("edit");
    setEditingId(id);
    setFormOpen(true);
    setSaving(false);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/hadith/${id}`);
      if (!res.ok) throw new Error(`Failed to load hadith (${res.status})`);
      const payload = (await res.json()) as { data: AdminHadithDetail };
      setFormState(toFormState(payload.data));
    } catch (err) {
      console.error(err);
      setError("Unable to load hadith for editing");
      setFormOpen(false);
    }
  }

  function handleCreate() {
    setFormMode("create");
    setEditingId(null);
    setFormState(EMPTY_FORM);
    setFormOpen(true);
    setNotification(null);
    setFormError(null);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setNotification(null);
    setFormError(null);
    if (formState.gradeId && !formState.scholarId) {
      setFormError("Select a scholar for the chosen grade or remove the grade.");
      setSaving(false);
      return;
    }
    const payload = toPayload(formState);
    try {
      const res = await fetch(editingId ? `/api/admin/hadith/${editingId}` : "/api/admin/hadith", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const reason = body?.error ?? `Save failed (${res.status})`;
        setFormError(reason);
        throw new Error(reason);
      }
      setNotification(editingId ? "Hadith updated" : "Hadith created");
      setFormOpen(false);
      setFormState(EMPTY_FORM);
      setEditingId(null);
      await loadList();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm("Soft-delete this hadith?");
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/hadith/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setNotification("Hadith deleted");
      await loadList();
    } catch (err) {
      console.error(err);
      setError("Unable to delete hadith");
    }
  }

  const activeFilters = Object.values(filters).some(Boolean) || Boolean(search);

  return (
    <div className="min-h-svh overflow-auto bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <header className="mb-6 flex flex-col gap-2 border-b border-[var(--border-soft)] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-subtle)]">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold">Hadith Manager</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Add, edit, filter, and softly delete hadith records with primary chain + tags.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadList}
            className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--text-primary)]"
          >
            Refresh
          </button>
          <button
            onClick={handleCreate}
            className="rounded-full bg-[var(--accent-emerald)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] shadow-md transition hover:-translate-y-0.5"
          >
            + New Hadith
          </button>
        </div>
      </header>

      <section className="mb-6 grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {total} hadith{total === 1 ? "" : "s"} · page {page} of {totalPages}
            </span>
            {notification && <span className="text-xs text-[var(--accent-emerald)]">{notification}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search matn / source / display number"
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--accent-emerald)] lg:w-72"
            />
            <select
              value={filters.source}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, source: e.target.value }));
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">Source</option>
              {lookups?.sources.map((source) => (
                <option key={source.id} value={source.label}>
                  {source.label}
                </option>
              ))}
            </select>
            <select
              value={filters.book}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, book: e.target.value }));
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">Book</option>
              {lookups?.books.map((book) => (
                <option key={book.id} value={book.label}>
                  {book.label}
                </option>
              ))}
            </select>
            <select
              value={filters.chapter}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, chapter: e.target.value }));
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">Chapter</option>
              {lookups?.chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.label}>
                  {chapter.label}
                </option>
              ))}
            </select>
            <input
              value={filters.narrator}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, narrator: e.target.value }));
                setPage(1);
              }}
              placeholder="Narrator filter"
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--accent-emerald)] lg:w-48"
            />
            <input
              value={filters.tag}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, tag: e.target.value }));
                setPage(1);
              }}
              placeholder="Tag filter"
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--accent-emerald)] lg:w-40"
            />
            {activeFilters && (
              <button
                onClick={() => {
                  setFilters({ book: "", chapter: "", tag: "", narrator: "", source: "" });
                  setSearch("");
                  setPage(1);
                }}
                className="text-sm text-[var(--text-muted)] underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        <div className="grid gap-3">
          {loading && <div className="text-sm text-[var(--text-muted)]">Loading hadith…</div>}
          {!loading && hadithList.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border-soft)] px-4 py-6 text-sm text-[var(--text-muted)]">
              No hadith match the current query.
            </div>
          )}
          {!loading &&
            hadithList.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-card)] p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[var(--text-secondary)]">
                    <span className="rounded-full bg-[var(--chip-bg)] px-3 py-1 text-xs text-[var(--text-primary)]">
                      {item.displayNumber}
                    </span>
                    <span>{item.source}</span>
                    {item.book && <span className="text-[var(--text-muted)]">· {item.book}</span>}
                    {item.chapter && <span className="text-[var(--text-muted)]">· {item.chapter}</span>}
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => handleEdit(item.id)}
                      className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-[var(--text-secondary)] transition hover:border-[var(--text-primary)]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="rounded-full border border-red-500/40 px-3 py-1 text-red-200 transition hover:border-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-muted)]">{item.matnPreview}</p>
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                    {item.tags.map((tag) => (
                      <span key={`${item.id}-${tag}`} className="rounded-full border border-[var(--border-soft)] px-2 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
        </div>
        <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <button
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-full border border-[var(--border-soft)] px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded-full border border-[var(--border-soft)] px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="relative h-[90svh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {formMode === "edit" ? "Edit hadith" : "Create hadith"}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">Fill in source, book/chapter, matn, chain, tags, and identifiers.</p>
              </div>
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-sm text-[var(--text-secondary)]"
              >
                Close
              </button>
            </div>
            {formError && (
              <div className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {formError}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Source" description="Select an existing source (cannot add new here).">
                <select
                  value={formState.sourceId ?? ""}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      sourceId: e.target.value ? Number(e.target.value) : null,
                      bookId: null,
                      chapterId: null,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="">Select source</option>
                  {lookups?.sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Book & chapter">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formState.bookId ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        bookId: e.target.value ? Number(e.target.value) : null,
                        chapterId: null,
                      }))
                    }
                    disabled={!formState.sourceId}
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50"
                  >
                    <option value="">{formState.sourceId ? "Select book (optional)" : "Select a source first"}</option>
                    {booksForSource.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={formState.chapterId ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        chapterId: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    disabled={!formState.bookId}
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50"
                  >
                    <option value="">{formState.bookId ? "Select chapter (optional)" : "Select a book first"}</option>
                    {chaptersForBook.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>

              <Field label="Hadith number & label">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={formState.hadithNumber}
                    onChange={(e) => setFormState((prev) => ({ ...prev, hadithNumber: e.target.value }))}
                    placeholder="Hadith number"
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                  <input
                    value={formState.displayNumber}
                    onChange={(e) => setFormState((prev) => ({ ...prev, displayNumber: e.target.value }))}
                    placeholder="Display number (e.g., 45a)"
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </Field>

              <Field label="Location & Sanad">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={formState.location}
                    onChange={(e) => setFormState((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Location label"
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                  <input
                    value={formState.sanad}
                    onChange={(e) => setFormState((prev) => ({ ...prev, sanad: e.target.value }))}
                    placeholder="Sanad notes"
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </Field>

              <Field label="Matn" description="Primary text in English.">
                <textarea
                  value={formState.matn}
                  onChange={(e) => setFormState((prev) => ({ ...prev, matn: e.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </Field>

              <Field label="Chain metadata">
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={formState.narrationLevelId ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, narrationLevelId: e.target.value ? Number(e.target.value) : null }))
                    }
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Narration level</option>
                    {lookups?.narrationLevels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={formState.chainTypeId ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, chainTypeId: e.target.value ? Number(e.target.value) : null }))
                    }
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Chain type</option>
                    {lookups?.chainTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={formState.attributionTypeId ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, attributionTypeId: e.target.value ? Number(e.target.value) : null }))
                    }
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Attribution type</option>
                    {lookups?.attributionTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>

              <Field label="Narrators" description="Ordered chain (top to bottom).">
                <div className="flex flex-col gap-2">
                  {formState.narrators.map((narrator, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-soft)] p-3">
                      <input
                        value={narrator.name}
                        onChange={(e) => updateNarrator(idx, { ...narrator, name: e.target.value })}
                        placeholder="Name"
                        className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                      <input
                        value={narrator.descriptor ?? ""}
                        onChange={(e) => updateNarrator(idx, { ...narrator, descriptor: e.target.value })}
                        placeholder="Descriptor"
                        className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                      <select
                        value={narrator.role ?? "narrator"}
                        onChange={(e) => updateNarrator(idx, { ...narrator, role: e.target.value as "prophet" | "narrator" })}
                    className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="narrator">Narrator</option>
                    <option value="prophet">Prophet</option>
                  </select>
                  <select
                    value={narrator.classificationId ?? ""}
                    onChange={(e) =>
                      updateNarrator(idx, {
                        ...narrator,
                        classificationId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Narrator tier</option>
                    {lookups?.narratorTiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={narrator.reliabilityId ?? ""}
                    onChange={(e) =>
                      updateNarrator(idx, {
                        ...narrator,
                        reliabilityId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Reliability tier</option>
                    {lookups?.reliabilityTiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={narrator.transmissionMethodId ?? ""}
                    onChange={(e) =>
                      updateNarrator(idx, {
                        ...narrator,
                        transmissionMethodId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">Transmission method</option>
                    {lookups?.transmissionMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeNarrator(idx)}
                    className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs text-[var(--text-secondary)]"
                  >
                    Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addNarrator}
                    className="self-start rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs text-[var(--text-secondary)]"
                  >
                    + Add narrator
                  </button>
                </div>
              </Field>

              <Field label="Tags" description="Comma-separated tags.">
                <input
                  value={formState.tags}
                  onChange={(e) => setFormState((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="e.g. authenticity, fiqh, aqeedah"
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </Field>

              <Field label="Identifiers" description="Scheme + identifier (e.g., legacy_source_number, 45a).">
                <div className="flex flex-col gap-2">
                  {formState.identifiers.map((identifier, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-soft)] p-3">
                      <input
                        value={identifier.schemeKey}
                        onChange={(e) => updateIdentifier(idx, { ...identifier, schemeKey: e.target.value })}
                        placeholder="Scheme key"
                        className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                      <input
                        value={identifier.identifier}
                        onChange={(e) => updateIdentifier(idx, { ...identifier, identifier: e.target.value })}
                        placeholder="Identifier"
                        className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                      <input
                        value={identifier.notes ?? ""}
                        onChange={(e) => updateIdentifier(idx, { ...identifier, notes: e.target.value })}
                        placeholder="Notes"
                        className="flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={Boolean(identifier.isPrimary)}
                          onChange={(e) => updateIdentifier(idx, { ...identifier, isPrimary: e.target.checked })}
                        />
                        Primary
                      </label>
                      <button
                        onClick={() => removeIdentifier(idx)}
                        className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs text-[var(--text-secondary)]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addIdentifier}
                    className="self-start rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs text-[var(--text-secondary)]"
                  >
                    + Add identifier
                  </button>
                </div>
              </Field>

              <Field label="Primary grading" description="Pick existing grade and scholar (optional).">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formState.gradeId ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        gradeId: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">No grade</option>
                    {lookups?.grades.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={formState.scholarId ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        scholarId: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">No scholar</option>
                    {lookups?.scholars.map((scholar) => (
                      <option key={scholar.id} value={scholar.id}>
                        {scholar.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-[var(--border-soft)] pt-4">
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-[var(--accent-emerald)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] shadow-md transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                {saving ? "Saving…" : formMode === "edit" ? "Update hadith" : "Create hadith"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function addNarrator() {
    setFormState((prev) => ({
      ...prev,
      narrators: [...prev.narrators, { name: "", role: "narrator" }],
    }));
  }

  function removeNarrator(index: number) {
    setFormState((prev) => ({
      ...prev,
      narrators: prev.narrators.filter((_, idx) => idx !== index),
    }));
  }

  function updateNarrator(index: number, value: AdminNarratorInput) {
    setFormState((prev) => ({
      ...prev,
      narrators: prev.narrators.map((item, idx) => (idx === index ? value : item)),
    }));
  }

  function addIdentifier() {
    setFormState((prev) => ({
      ...prev,
      identifiers: [...prev.identifiers, { schemeKey: "", identifier: "" }],
    }));
  }

  function removeIdentifier(index: number) {
    setFormState((prev) => ({
      ...prev,
      identifiers: prev.identifiers.filter((_, idx) => idx !== index),
    }));
  }

  function updateIdentifier(index: number, value: AdminIdentifierInput) {
    setFormState((prev) => ({
      ...prev,
      identifiers: prev.identifiers.map((item, idx) => (idx === index ? value : item)),
    }));
  }
}

function toPayload(form: FormState): AdminHadithPayload {
  const narrators = form.narrators
    .map((n) => ({
      ...n,
      name: n.name.trim(),
      descriptor: n.descriptor?.trim() || undefined,
    }))
    .filter((n) => n.name);

  const identifiers = form.identifiers
    .map((id) => ({
      ...id,
      schemeKey: id.schemeKey.trim(),
      identifier: id.identifier.trim(),
      notes: id.notes?.trim() || null,
    }))
    .filter((id) => id.schemeKey && id.identifier);

  return {
    sourceId: form.sourceId ?? 0,
    bookId: form.bookId ?? null,
    chapterId: form.chapterId ?? null,
    hadithNumber: Number(form.hadithNumber) || 0,
    displayNumber: form.displayNumber || null,
    matn: form.matn,
    sanad: form.sanad || null,
    location: form.location || null,
    narrationLevelId: form.narrationLevelId ?? null,
    chainTypeId: form.chainTypeId ?? null,
    attributionTypeId: form.attributionTypeId ?? null,
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    narrators,
    identifiers,
    gradeId: form.gradeId ?? null,
    grades:
      form.gradeId != null
        ? [
            {
              gradeId: form.gradeId ?? undefined,
              scholarId: form.scholarId ?? undefined,
              isPrimary: true,
            },
          ]
        : [],
  };
}

function toFormState(detail: AdminHadithDetail): FormState {
  return {
    sourceId: detail.sourceId,
    bookId: detail.bookId ?? null,
    chapterId: detail.chapterId ?? null,
    hadithNumber: detail.hadithNumber.toString(),
    displayNumber: detail.displayNumber ?? "",
    matn: detail.matn,
    sanad: detail.sanad ?? "",
    location: detail.location ?? "",
    narrationLevelId: detail.narrationLevelId ?? null,
    chainTypeId: detail.chainTypeId ?? null,
    attributionTypeId: detail.attributionTypeId ?? null,
    narrators: detail.narrators ?? [],
    tags: detail.tags.join(", "),
    identifiers: detail.identifiers ?? [],
    gradeId: detail.grades?.[0]?.gradeId ?? null,
    scholarId: detail.grades?.[0]?.scholarId ?? null,
  };
}

function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-card)] p-3">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
        {description && <p className="text-xs text-[var(--text-muted)]">{description}</p>}
      </div>
      {children}
    </div>
  );
}
