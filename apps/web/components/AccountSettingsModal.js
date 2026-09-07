'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { adminApi } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';

export function AccountSettingsModal({ open, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function handleClose() {
    setCurrentPassword('');
    setNewPassword('');
    setError('');
    setMessage('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await adminApi.patch('/api/admin/auth/password', { currentPassword, newPassword });
      setMessage('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Account settings">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <Input id="newPassword" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <FieldError>{error}</FieldError>
        {message ? <p className="text-sm text-verdigris-dark">{message}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Update password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
