"use client";

import { FormEvent, useState } from "react";
import { updateProfile, changePassword } from "@/lib/boardApi";

type ProfileSettingsProps = {
  displayName: string;
  username: string;
  onClose: () => void;
  onDisplayNameChange: (newName: string) => void;
};

export const ProfileSettings = ({
  displayName,
  username,
  onClose,
  onDisplayNameChange,
}: ProfileSettingsProps) => {
  const [newDisplayName, setNewDisplayName] = useState(displayName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleUpdateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newDisplayName.trim()) return;

    setIsSavingProfile(true);
    setProfileMsg("");

    try {
      const result = await updateProfile(newDisplayName.trim());
      onDisplayNameChange(result.display_name);
      setProfileMsg("Display name updated.");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPassword || !newPassword) return;

    setIsSavingPassword(true);
    setPasswordMsg("");

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg("Password changed.");
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
            Profile Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-xs text-[var(--gray-text)]">
          Username: <span className="font-semibold text-[var(--navy-dark)]">{username}</span>
        </p>

        <form onSubmit={handleUpdateProfile} className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--navy-dark)]">Display Name</h3>
          <input
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
            required
            minLength={1}
            maxLength={100}
            aria-label="Display name"
          />
          {profileMsg && (
            <p className="text-xs font-medium text-[var(--gray-text)]">{profileMsg}</p>
          )}
          <button
            type="submit"
            disabled={isSavingProfile}
            className="rounded-full bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-70"
          >
            {isSavingProfile ? "Saving..." : "Update Name"}
          </button>
        </form>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--navy-dark)]">Change Password</h3>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
            required
            minLength={1}
            autoComplete="current-password"
            aria-label="Current password"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
            required
            minLength={4}
            autoComplete="new-password"
            aria-label="New password"
          />
          {passwordMsg && (
            <p className="text-xs font-medium text-[var(--gray-text)]">{passwordMsg}</p>
          )}
          <button
            type="submit"
            disabled={isSavingPassword}
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-70"
          >
            {isSavingPassword ? "Saving..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
};
