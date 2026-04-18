"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Coach } from "@/lib/types/database";

export default function CoachFormDialog({
  clubId,
  coach,
  onClose,
  onSaved,
}: {
  clubId: string;
  coach: Coach | null;
  onClose: () => void;
  onSaved: (c: Coach) => void;
}) {
  const supabase = createClient();
  const [firstName, setFirstName] = useState(coach?.first_name ?? "");
  const [lastName, setLastName] = useState(coach?.last_name ?? "");
  const [email, setEmail] = useState(coach?.email ?? "");
  const [phone, setPhone] = useState(coach?.phone ?? "");
  const [notes, setNotes] = useState(coach?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      club_id: clubId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      is_active: coach?.is_active ?? true,
    };

    const query = coach
      ? supabase.from("coaches").update(payload).eq("id", coach.id).select("*").single()
      : supabase.from("coaches").insert(payload).select("*").single();

    const { data, error } = await query;
    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? "Could not save coach");
      return;
    }
    onSaved(data as Coach);
  }

  async function handleDelete() {
    if (!coach) return;
    if (
      !confirm(
        `Remove ${coach.first_name} ${coach.last_name}? Teams they're assigned to will become unassigned.`
      )
    )
      return;
    setSaving(true);
    const { error } = await supabase.from("coaches").delete().eq("id", coach.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved({ ...coach, is_active: false });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{coach ? "Edit coach" : "Add coach"}</h2>
          <button onClick={onClose} className="btn-ghost w-tap h-tap p-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">First name</label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="input"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Last name</label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="input"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email (optional)</label>
            <input
              type="email"
              value={email ?? ""}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Phone (optional)</label>
            <input
              type="tel"
              value={phone ?? ""}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              className="input py-2 min-h-[60px]"
              placeholder="Availability, preferred age group, etc."
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            {coach && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="btn-danger"
              >
                Delete
              </button>
            )}
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving…" : coach ? "Save changes" : "Add coach"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
