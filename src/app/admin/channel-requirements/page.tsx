"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const SPEC_TYPES = [
  "CHARACTER_LIMIT",
  "FILE_SIZE",
  "FILE_FORMAT",
  "DIMENSIONS",
  "DURATION",
  "SAFE_ZONE",
  "OTHER",
] as const;

const SPEC_TYPE_LABELS: Record<string, string> = {
  CHARACTER_LIMIT: "Character Limit",
  FILE_SIZE: "File Size",
  FILE_FORMAT: "File Format",
  DIMENSIONS: "Dimensions",
  DURATION: "Duration",
  SAFE_ZONE: "Safe Zone",
  OTHER: "Other",
};

interface Platform {
  id: string;
  name: string;
  slug: string;
}

interface ChannelRequirement {
  id: string;
  platformId: string;
  specType: string;
  specKey: string;
  value: string;
  notes: string | null;
  platform: Platform;
}

const formSchema = z.object({
  platformId: z.string().min(1),
  specType: z.enum(SPEC_TYPES),
  specKey: z.string().min(1, "Key is required"),
  value: z.string().min(1, "Value is required"),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

const editSchema = z.object({
  specType: z.enum(SPEC_TYPES),
  specKey: z.string().min(1),
  value: z.string().min(1),
  notes: z.string().optional().nullable(),
});
type EditData = z.infer<typeof editSchema>;

export default function ChannelRequirementsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [requirements, setRequirements] = useState<ChannelRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ChannelRequirement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChannelRequirement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fetch platforms and requirements
  useEffect(() => {
    fetch("/api/admin/channel-requirements")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setRequirements(json.data);
          const seen = new Set<string>();
          const ps: Platform[] = [];
          json.data.forEach((r: ChannelRequirement) => {
            if (!seen.has(r.platform.id)) {
              seen.add(r.platform.id);
              ps.push(r.platform);
            }
          });
          setPlatforms(ps);
          if (ps.length > 0 && !activeTab) setActiveTab(ps[0].id);
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = useCallback(() => {
    fetch("/api/admin/channel-requirements")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setRequirements(json.data);
      });
  }, []);

  const {
    register: registerCreate,
    handleSubmit: handleCreate,
    reset: resetCreate,
    setValue: setCreateValue,
    watch: watchCreate,
    formState: { errors: createErrors },
  } = useForm<FormData>({ resolver: zodResolver(formSchema), defaultValues: { specType: "CHARACTER_LIMIT" } });

  const {
    register: registerEdit,
    handleSubmit: handleEdit,
    reset: resetEdit,
    setValue: setEditValue,
    watch: watchEdit,
    formState: { errors: editErrors },
  } = useForm<EditData>({ resolver: zodResolver(editSchema) });

  function openCreate() {
    setEditTarget(null);
    resetCreate({ platformId: activeTab, specType: "CHARACTER_LIMIT", specKey: "", value: "", notes: "" });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(req: ChannelRequirement) {
    setEditTarget(req);
    resetEdit({ specType: req.specType as never, specKey: req.specKey, value: req.value, notes: req.notes ?? "" });
    setError(null);
    setDialogOpen(true);
  }

  const onCreateSubmit = (data: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/channel-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setDialogOpen(false);
        refetch();
      } else {
        setError(json.error?.message ?? "Something went wrong");
      }
    });
  };

  const onEditSubmit = (data: EditData) => {
    if (!editTarget) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/channel-requirements/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setDialogOpen(false);
        refetch();
      } else {
        setError(json.error?.message ?? "Something went wrong");
      }
    });
  };

  function confirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await fetch(`/api/admin/channel-requirements/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      refetch();
    });
  }

  const reqs = requirements.filter((r) => r.platformId === activeTab);
  const grouped = SPEC_TYPES.reduce<Record<string, ChannelRequirement[]>>((acc, type) => {
    acc[type] = reqs.filter((r) => r.specType === type);
    return acc;
  }, {} as Record<string, ChannelRequirement[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Channel Requirements</h1>
          <p className="text-slate-500 mt-1">Platform-specific technical specs: character limits, file sizes, dimensions.</p>
        </div>
        <Button onClick={openCreate} disabled={!activeTab}>
          <Plus className="h-4 w-4 mr-2" /> Add Requirement
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {platforms.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>{p.name}</TabsTrigger>
            ))}
          </TabsList>

          {platforms.map((platform) => (
            <TabsContent key={platform.id} value={platform.id} className="space-y-4 mt-4">
              {SPEC_TYPES.map((type) => {
                const items = grouped[type] ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {SPEC_TYPE_LABELS[type]}
                    </h3>
                    <div className="rounded-md border border-slate-200 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Spec Key</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="w-20" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((req) => (
                            <TableRow key={req.id}>
                              <TableCell className="font-mono text-sm">{req.specKey}</TableCell>
                              <TableCell className="font-medium">{req.value}</TableCell>
                              <TableCell className="text-sm text-slate-500 max-w-xs truncate">
                                {req.notes ?? "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 justify-end">
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(req)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                    onClick={() => setDeleteTarget(req)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
              {reqs.length === 0 && (
                <p className="text-center py-8 text-slate-400 text-sm">No requirements defined for this platform yet.</p>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen && !editTarget} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Requirement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate(onCreateSubmit)} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Spec Type</Label>
              <Select value={watchCreate("specType")} onValueChange={(v) => setCreateValue("specType", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPEC_TYPES.map((t) => <SelectItem key={t} value={t}>{SPEC_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Spec Key</Label>
              <Input {...registerCreate("specKey")} placeholder="e.g. headline_char_limit" className="font-mono text-sm" />
              {createErrors.specKey && <p className="text-xs text-red-500">{createErrors.specKey.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input {...registerCreate("value")} placeholder="e.g. 125" />
              {createErrors.value && <p className="text-xs text-red-500">{createErrors.value.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea {...registerCreate("notes")} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen && !!editTarget} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Requirement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit(onEditSubmit)} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Spec Type</Label>
              <Select value={watchEdit("specType")} onValueChange={(v) => setEditValue("specType", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPEC_TYPES.map((t) => <SelectItem key={t} value={t}>{SPEC_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Spec Key</Label>
              <Input {...registerEdit("specKey")} className="font-mono text-sm" />
              {editErrors.specKey && <p className="text-xs text-red-500">{editErrors.specKey.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input {...registerEdit("value")} />
              {editErrors.value && <p className="text-xs text-red-500">{editErrors.value.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...registerEdit("notes")} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.specKey}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
