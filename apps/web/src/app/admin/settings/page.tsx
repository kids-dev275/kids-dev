"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  getAdminAnnouncementSettings,
  updateAdminAnnouncementSettings,
  getAdminShippingSettings,
  updateAdminShippingSettings,
  getAdminBankTransferSettings,
  updateAdminBankTransferSettings,
  getAdminNotificationSettings,
  updateAdminNotificationSettings,
  type AdminAnnouncementSettings,
  type AdminShippingSettings,
  type AdminBankTransferSettings,
  type AdminNotificationSettings,
} from "@/lib/admin-api";
import {
  Bell,
  Truck,
  Building2,
  Mail,
  Save,
  CheckCircle,
  AlertCircle,
  Info,
  RefreshCw,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);

  // Announcement state
  const [announcement, setAnnouncement] = useState<AdminAnnouncementSettings>({
    text: "",
    link: "",
    isActive: false,
  });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Shipping state
  const [shipping, setShipping] = useState<AdminShippingSettings>({
    flatDeliveryCharge: "250.00",
  });
  const [savingShipping, setSavingShipping] = useState(false);
  const [shippingMsg, setShippingMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Bank Transfer state
  const [bankTransfer, setBankTransfer] = useState<AdminBankTransferSettings>({
    bankName: "",
    accountTitle: "",
    accountOrIban: "",
    branchCode: "",
    branchLocation: "",
    instructions: "",
  });
  const [savingBank, setSavingBank] = useState(false);
  const [bankMsg, setBankMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<AdminNotificationSettings>({
    newOrderEmailEnabled: false,
    newOrderNotificationRecipient: "",
  });
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationsMsg, setNotificationsMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchAllSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [annRes, shipRes, bankRes, notifRes] = await Promise.all([
        getAdminAnnouncementSettings(),
        getAdminShippingSettings(),
        getAdminBankTransferSettings(),
        getAdminNotificationSettings(),
      ]);

      if (annRes.success && annRes.data?.announcement) {
        setAnnouncement({
          text: annRes.data.announcement.text || "",
          link: annRes.data.announcement.link || "",
          isActive: annRes.data.announcement.isActive || false,
        });
      }

      if (shipRes.success && shipRes.data?.shipping) {
        setShipping({
          flatDeliveryCharge: shipRes.data.shipping.flatDeliveryCharge,
        });
      }

      if (bankRes.success && bankRes.data?.bankTransfer) {
        setBankTransfer({
          bankName: bankRes.data.bankTransfer.bankName || "",
          accountTitle: bankRes.data.bankTransfer.accountTitle || "",
          accountOrIban: bankRes.data.bankTransfer.accountOrIban || "",
          branchCode: bankRes.data.bankTransfer.branchCode || "",
          branchLocation: bankRes.data.bankTransfer.branchLocation || "",
          instructions: bankRes.data.bankTransfer.instructions || "",
        });
      }

      if (notifRes.success && notifRes.data?.notifications) {
        setNotifications({
          newOrderEmailEnabled: notifRes.data.notifications.newOrderEmailEnabled || false,
          newOrderNotificationRecipient:
            notifRes.data.notifications.newOrderNotificationRecipient || "",
        });
      }
    } catch {
      // Handled silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await fetchAllSettings();
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchAllSettings]);

  // Section 1: Save Announcement
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAnnouncement(true);
    setAnnouncementMsg(null);
    try {
      const res = await updateAdminAnnouncementSettings({
        text: announcement.text?.trim() || null,
        link: announcement.link?.trim() || null,
        isActive: announcement.isActive,
      });
      if (res.success && res.data) {
        setAnnouncementMsg({ type: "success", text: "Announcement bar settings saved." });
      } else {
        setAnnouncementMsg({
          type: "error",
          text: res.error?.message || "Failed to update announcement.",
        });
      }
    } catch {
      setAnnouncementMsg({ type: "error", text: "Network error saving announcement." });
    } finally {
      setSavingAnnouncement(false);
    }
  };

  // Section 2: Save Shipping
  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShipping(true);
    setShippingMsg(null);
    try {
      const res = await updateAdminShippingSettings({
        flatDeliveryCharge: shipping.flatDeliveryCharge.trim(),
      });
      if (res.success && res.data) {
        setShippingMsg({ type: "success", text: "Flat delivery charge saved." });
      } else {
        setShippingMsg({
          type: "error",
          text: res.error?.message || "Failed to update shipping charge.",
        });
      }
    } catch {
      setShippingMsg({ type: "error", text: "Network error saving shipping." });
    } finally {
      setSavingShipping(false);
    }
  };

  // Section 3: Save Bank Transfer
  const handleSaveBankTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    setBankMsg(null);
    try {
      const res = await updateAdminBankTransferSettings({
        bankName: bankTransfer.bankName?.trim() || null,
        accountTitle: bankTransfer.accountTitle?.trim() || null,
        accountOrIban: bankTransfer.accountOrIban?.trim() || null,
        branchCode: bankTransfer.branchCode?.trim() || null,
        branchLocation: bankTransfer.branchLocation?.trim() || null,
        instructions: bankTransfer.instructions?.trim() || null,
      });
      if (res.success && res.data) {
        setBankMsg({ type: "success", text: "Bank transfer settings saved." });
      } else {
        setBankMsg({
          type: "error",
          text: res.error?.message || "Failed to update bank transfer details.",
        });
      }
    } catch {
      setBankMsg({ type: "error", text: "Network error saving bank details." });
    } finally {
      setSavingBank(false);
    }
  };

  // Section 4: Save Notifications
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotifications(true);
    setNotificationsMsg(null);
    try {
      const res = await updateAdminNotificationSettings({
        newOrderEmailEnabled: notifications.newOrderEmailEnabled,
        newOrderNotificationRecipient: notifications.newOrderNotificationRecipient?.trim() || null,
      });
      if (res.success && res.data) {
        setNotificationsMsg({ type: "success", text: "Order notification settings saved." });
      } else {
        setNotificationsMsg({
          type: "error",
          text: res.error?.message || "Failed to update notifications.",
        });
      }
    } catch {
      setNotificationsMsg({ type: "error", text: "Network error saving notifications." });
    } finally {
      setSavingNotifications(false);
    }
  };

  const isBankTransferCustomerReady =
    Boolean(bankTransfer.bankName?.trim()) &&
    Boolean(bankTransfer.accountTitle?.trim()) &&
    Boolean(bankTransfer.accountOrIban?.trim()) &&
    Boolean(bankTransfer.instructions?.trim());

  if (isLoading) {
    return (
      <AdminGuard>
        <AdminShell>
          <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
            Loading settings...
          </div>
        </AdminShell>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-sand pb-4">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-ink uppercase">
                Commerce Settings
              </h1>
              <p className="text-xs uppercase tracking-wider text-brand-muted mt-0.5">
                Manage operational configuration across announcements, delivery, payments, and
                notifications
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAllSettings}
              className="p-2 border border-brand-sand rounded-sm text-brand-muted hover:text-brand-ink bg-white self-start sm:self-auto"
              title="Refresh all settings"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* SECTION 1: ANNOUNCEMENT BAR */}
          <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
            <div className="border-b border-brand-sand pb-3 flex items-center space-x-2">
              <Bell className="w-4 h-4 text-brand-primary" />
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                Storefront Announcement Bar
              </h2>
            </div>

            {announcementMsg && (
              <div
                className={`p-3 rounded-sm text-xs flex items-center space-x-2 ${
                  announcementMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {announcementMsg.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{announcementMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                  Announcement Message
                </label>
                <input
                  type="text"
                  value={announcement.text || ""}
                  onChange={(e) => setAnnouncement({ ...announcement, text: e.target.value })}
                  placeholder="e.g. Complimentary standard delivery on seasonal collections"
                  className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                  Optional Safe Link
                </label>
                <input
                  type="text"
                  value={announcement.link || ""}
                  onChange={(e) => setAnnouncement({ ...announcement, link: e.target.value })}
                  placeholder="e.g. /mini-sprouts/new-arrivals"
                  className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink font-mono text-[11px]"
                />
                <span className="text-[10px] text-brand-muted mt-0.5 block">
                  Must be an application relative path (e.g. /shop) or safe http(s) URL.
                </span>
              </div>

              <div className="pt-1">
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={announcement.isActive}
                    onChange={(e) =>
                      setAnnouncement({ ...announcement, isActive: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary border-brand-sand"
                  />
                  <span className="text-xs uppercase tracking-wider font-semibold text-brand-ink">
                    Display Announcement Bar on Storefront
                  </span>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingAnnouncement}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-primary text-white rounded-sm text-xs uppercase tracking-wider font-semibold shadow-xs hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingAnnouncement ? "Saving..." : "Save Announcement"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 2: SHIPPING SETTINGS */}
          <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
            <div className="border-b border-brand-sand pb-3 flex items-center space-x-2">
              <Truck className="w-4 h-4 text-brand-primary" />
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                Shipping &amp; Delivery Charge
              </h2>
            </div>

            {shippingMsg && (
              <div
                className={`p-3 rounded-sm text-xs flex items-center space-x-2 ${
                  shippingMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {shippingMsg.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{shippingMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveShipping} className="space-y-4 text-xs">
              <div className="max-w-xs">
                <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                  Flat Delivery Charge (PKR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-muted font-semibold text-xs">
                    PKR
                  </span>
                  <input
                    type="text"
                    required
                    value={shipping.flatDeliveryCharge}
                    onChange={(e) => setShipping({ flatDeliveryCharge: e.target.value })}
                    placeholder="250.00"
                    className="w-full pl-12 pr-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink font-semibold"
                  />
                </div>
                <span className="text-[10px] text-brand-muted mt-1 block">
                  Applied as a single flat charge per customer order across Pakistan regardless of
                  item count.
                </span>
              </div>

              <div className="p-3 bg-brand-canvas/40 border border-brand-sand rounded-sm text-[11px] text-brand-muted flex items-start space-x-2">
                <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Fixed Delivery Terms:</strong> Kids Wear operates with a nationwide
                  delivery standard of up to 10 days (made-to-order model). This promise is fixed
                  brand content and not dynamically reconfigured in the operational settings.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingShipping}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-primary text-white rounded-sm text-xs uppercase tracking-wider font-semibold shadow-xs hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingShipping ? "Saving..." : "Save Delivery Charge"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 3: BANK TRANSFER SETTINGS */}
          <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
            <div className="border-b border-brand-sand pb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-brand-primary" />
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                  Manual Bank Transfer Details
                </h2>
              </div>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isBankTransferCustomerReady
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-amber-50 text-amber-800 border-amber-300"
                }`}
              >
                {isBankTransferCustomerReady
                  ? "Available at Checkout"
                  : "Incomplete (Hidden from Checkout)"}
              </span>
            </div>

            {bankMsg && (
              <div
                className={`p-3 rounded-sm text-xs flex items-center space-x-2 ${
                  bankMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {bankMsg.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{bankMsg.text}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-sm text-[11px] text-amber-900 flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Checkout Availability Gate:</strong> Bank Transfer is automatically offered
                to customers during checkout ONLY when Bank Name, Account Title, Account/IBAN, and
                Payment Instructions are all populated. If any required field is empty, the payment
                method is gracefully withheld from checkout.
              </span>
            </div>

            <form onSubmit={handleSaveBankTransfer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    value={bankTransfer.bankName || ""}
                    onChange={(e) => setBankTransfer({ ...bankTransfer, bankName: e.target.value })}
                    placeholder="e.g. Meezan Bank Limited"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Account Title *
                  </label>
                  <input
                    type="text"
                    value={bankTransfer.accountTitle || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, accountTitle: e.target.value })
                    }
                    placeholder="e.g. Kids Wear Private Limited"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Account Number / IBAN *
                  </label>
                  <input
                    type="text"
                    value={bankTransfer.accountOrIban || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, accountOrIban: e.target.value })
                    }
                    placeholder="e.g. PK00MEZN0001234567890123"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Branch Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={bankTransfer.branchCode || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, branchCode: e.target.value })
                    }
                    placeholder="e.g. 0102"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Branch Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={bankTransfer.branchLocation || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, branchLocation: e.target.value })
                    }
                    placeholder="e.g. DHA Phase 5 Branch, Lahore"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Customer Instructions *
                  </label>
                  <textarea
                    rows={3}
                    value={bankTransfer.instructions || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, instructions: e.target.value })
                    }
                    placeholder="e.g. Please share payment receipt via WhatsApp at 0300-1234567 with your Order Number."
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingBank}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-primary text-white rounded-sm text-xs uppercase tracking-wider font-semibold shadow-xs hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingBank ? "Saving..." : "Save Bank Details"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 4: NOTIFICATIONS SETTINGS */}
          <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
            <div className="border-b border-brand-sand pb-3 flex items-center space-x-2">
              <Mail className="w-4 h-4 text-brand-primary" />
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                Admin Order Notifications
              </h2>
            </div>

            {notificationsMsg && (
              <div
                className={`p-3 rounded-sm text-xs flex items-center space-x-2 ${
                  notificationsMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {notificationsMsg.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{notificationsMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveNotifications} className="space-y-4 text-xs">
              <div className="pt-1">
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.newOrderEmailEnabled}
                    onChange={(e) =>
                      setNotifications({
                        ...notifications,
                        newOrderEmailEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary border-brand-sand"
                  />
                  <span className="text-xs uppercase tracking-wider font-semibold text-brand-ink">
                    Send Email Notification When New Orders are Placed
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  value={notifications.newOrderNotificationRecipient || ""}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      newOrderNotificationRecipient: e.target.value,
                    })
                  }
                  placeholder="orders-team@kidswear.local"
                  className="w-full max-w-md px-3 py-2 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                />
                <span className="text-[10px] text-brand-muted mt-0.5 block">
                  Designated operations inbox to receive transaction alerts.
                </span>
              </div>

              <div className="p-3 bg-brand-canvas/40 border border-brand-sand rounded-sm text-[11px] text-brand-muted flex items-start space-x-2">
                <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Security &amp; Deployment Boundary:</strong> Email delivery credentials
                  and sender identities are managed exclusively via server deployment environment
                  variables. They are never exposed, inspected, or configured in the browser UI.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingNotifications}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-primary text-white rounded-sm text-xs uppercase tracking-wider font-semibold shadow-xs hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingNotifications ? "Saving..." : "Save Notification Settings"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
