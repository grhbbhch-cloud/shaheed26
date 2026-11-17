import React from 'react';
import { CustomLoader } from '../../components/CustomLoader';
import { AdminProvider, useAdmin } from '../../context/AdminContext';
import { usePlatform } from '../../context/PlatformContext';
import { AdminDashboardShell } from './AdminDashboardShell';
import { AdminLoginPage } from './AdminLoginPage';

function AdminGateInner() {
  const { checkingAuth, authenticated } = useAdmin();
  const { settings } = usePlatform();

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] text-white">
        <CustomLoader config={settings?.loading?.pageNav} label="جاري التحقق من الجلسة الإدارية..." />
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLoginPage />;
  }

  return <AdminDashboardShell />;
}

export function AdminGate() {
  return (
    <AdminProvider>
      <AdminGateInner />
    </AdminProvider>
  );
}
