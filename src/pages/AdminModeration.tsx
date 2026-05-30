import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthToken } from "../util/auth";
import { ModerationSection } from "../components/admin/ModerationSection";

export const AdminModerationPage: React.FC = () => {
  const navigate = useNavigate();
  const authToken = getAuthToken();

  // Redirect unauthenticated users to home
  useEffect(() => {
    if (!authToken) {
      void navigate("/");
    }
  }, [authToken, navigate]);

  if (!authToken) return null;

  return (
    <div className="flex min-h-screen text-white">
      <main className="flex-1 p-10">
        <h1 className="text-3xl font-semibold mb-6">Content Moderation</h1>
        <ModerationSection />
      </main>
    </div>
  );
};
export default AdminModerationPage;
