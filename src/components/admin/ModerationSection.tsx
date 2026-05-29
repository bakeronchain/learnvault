// src/components/admin/ModerationSection.tsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetchJson } from "../../lib/api";
import { getAuthToken } from "../../util/auth";

interface FlaggedItem {
  id: string;
  contentId: string;
  title: string;
  reason: string;
  reportedBy: string;
  createdAt: string;
}

const fetchFlagged = async (): Promise<FlaggedItem[]> => {
  const token = getAuthToken();
  return apiFetchJson<FlaggedItem[]>("/api/moderation/flags", { auth: true });
};

const actionMutation = async ({ id, action }: { id: string; action: string }) => {
  return apiFetchJson<{ success: boolean }>(`/api/moderation/${id}/${action}`, {
    method: "POST",
    auth: true,
    body: {},
  });
};

export const ModerationSection: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "moderation"],
    queryFn: fetchFlagged,
    staleTime: 60 * 1000,
  });

  const mutation = useMutation(actionMutation, {
    onSuccess: () => {
      void queryClient.invalidateQueries(["admin", "moderation"]);
    },
  });

  const handleAction = (id: string, act: string) => {
    mutation.mutate({ id, action: act });
  };

  if (isLoading) {
    return <div className="py-12 text-center text-white/60 animate-pulse">Loading moderation items…</div>;
  }
  if (error) {
    return (
      <div className="py-12 text-center text-red-400">
        Could not load moderation items.
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-3xl font-semibold text-white mb-6">Content Moderation</h2>
      <div className="overflow-x-auto rounded-2xl border border-white/5 glass">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 text-xs uppercase tracking-widest text-white/40">
              <th className="py-3 px-4 font-medium">Title</th>
              <th className="py-3 px-4 font-medium">Reason</th>
              <th className="py-3 px-4 font-medium">Reported By</th>
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/3">
                <td className="py-3 px-4 text-sm text-white/80">{item.title}</td>
                <td className="py-3 px-4 text-sm text-white/60">{item.reason}</td>
                <td className="py-3 px-4 text-sm text-white/60">{item.reportedBy}</td>
                <td className="py-3 px-4 text-sm text-white/50">{new Date(item.createdAt).toLocaleDateString()}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAction(item.id, "approve")}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(item.id, "deny")}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(item.id, "suspend")}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20"
                    >
                      Suspend
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
