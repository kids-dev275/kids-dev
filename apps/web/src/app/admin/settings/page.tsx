"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { useTransientFeedback } from "@/lib/use-transient-feedback";
import {
  AdminPageHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
  AdminBadge,
  AdminAlert,
} from "@/components/admin/admin-ui";
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
import { Bell, Truck, Building2, Mail, Save, Info, RefreshCw } from "lucide-react";

export default function AdminSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Announcement state
  const [announcement, setAnnouncement] = useState<AdminAnnouncementSettings>({
    text: "",
    link: "",
    isActive: false,
  });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementMsg, setAnnouncementMsg, announcementFading] = useTransientFeedback<{
    type: "success" | "error";
    text: string;
  }>();

  // Shipping state
  const [shipping, setShipping] = useState<AdminShippingSettings>({
    flatDeliveryCharge: "",
  });
  const [savingShipping, setSavingShipping] = useState(false);
  const [shippingMsg, setShippingMsg, shippingFading] = useTransientFeedback<{
    type: "success" | "error";
    text: string;
  }>();

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
  const [bankMsg, setBankMsg, bankFading] = useTransientFeedback<{
    type: "success" | "error";
    text: string;
  }>();

  // Notifications state
  const [notifications, setNotifications] = useState<AdminNotificationSettings>({
    newOrderEmailEnabled: false,
    newOrderNotificationRecipient: "",
  });
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationsMsg, setNotificationsMsg, notificationsFading] = useTransientFeedback<{
    type: "success" | "error";
    text: string;
  }>();

  const fetchAllSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [annRes, shipRes, bankRes, notifRes] = await Promise.all([
        getAdminAnnouncementSettings(),
        getAdminShippingSettings(),
        getAdminBankTransferSettings(),
        getAdminNotificationSettings(),
      ]);

      if (
        !annRes.success ||
        !annRes.data?.announcement ||
        !shipRes.success ||
        !shipRes.data?.shipping ||
        !bankRes.success ||
        !bankRes.data?.bankTransfer ||
        !notifRes.success ||
        !notifRes.data?.notifications
      ) {
        setLoadError("Some settings could not be loaded. Refresh before editing.");
      }

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
      setLoadError("Settings could not be loaded. Refresh before editing.");
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
        const current = await getAdminAnnouncementSettings();
        if (current.success && current.data?.announcement) {
          setAnnouncement(current.data.announcement);
          setAnnouncementMsg({ type: "success", text: "Announcement bar settings saved." });
        } else {
          setAnnouncementMsg({
            type: "error",
            text: "Saved, but the current announcement could not be reloaded.",
          });
        }
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
        const current = await getAdminShippingSettings();
        if (current.success && current.data?.shipping) {
          setShipping(current.data.shipping);
          setShippingMsg({ type: "success", text: "Shipping delivery charge saved." });
        } else {
          setShippingMsg({
            type: "error",
            text: "Saved, but the current delivery charge could not be reloaded.",
          });
        }
      } else {
        setShippingMsg({
          type: "error",
          text: res.error?.message || "Failed to update shipping.",
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
        const current = await getAdminBankTransferSettings();
        if (current.success && current.data?.bankTransfer) {
          setBankTransfer(current.data.bankTransfer);
          setBankMsg({ type: "success", text: "Manual bank transfer details saved." });
        } else {
          setBankMsg({
            type: "error",
            text: "Saved, but the current bank details could not be reloaded.",
          });
        }
      } else {
        setBankMsg({
          type: "error",
          text: res.error?.message || "Failed to update bank details.",
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
        const current = await getAdminNotificationSettings();
        if (current.success && current.data?.notifications) {
          setNotifications(current.data.notifications);
          setNotificationsMsg({ type: "success", text: "Notification settings saved." });
        } else {
          setNotificationsMsg({
            type: "error",
            text: "Saved, but the current notification setting could not be reloaded.",
          });
        }
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

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <AdminPageHeader
            title="Commerce Settings"
            eyebrow="Configuration"
            description="Manage operational configuration across announcements, delivery, payments, and notifications"
            action={
              <button
                type="button"
                onClick={fetchAllSettings}
                disabled={isLoading}
                className="p-2 border border-brand-border rounded-sm text-brand-muted hover:text-brand-ink bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink disabled:opacity-50"
                title="Refresh all settings"
                aria-label="Refresh settings"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            }
          />

          {loadError && <AdminAlert type="error" message={loadError} />}

          {/* SECTION 1: ANNOUNCEMENT BAR */}
          <AdminCard className="p-6 space-y-4">
            <div className="border-b border-brand-border pb-3 flex items-center space-x-2">
              <Bell className="w-4 h-4 text-brand-ink" />
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                Storefront Announcement Bar
              </h2>
            </div>

            {announcementMsg && (
              <AdminAlert
                type={announcementMsg.type}
                message={announcementMsg.text}
                fading={announcementFading}
                onDismiss={() => setAnnouncementMsg(null)}
              />
            )}

            <form onSubmit={handleSaveAnnouncement} className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="announcement-text"
                  className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                >
                  Announcement Message
                </label>
                <input
                  id="announcement-text"
                  type="text"
                  value={announcement.text || ""}
                  onChange={(e) => setAnnouncement({ ...announcement, text: e.target.value })}
                  placeholder="e.g. Complimentary standard delivery on seasonal collections"
                  className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="announcement-link"
                  className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                >
                  Optional Safe Link
                </label>
                <input
                  id="announcement-link"
                  type="text"
                  value={announcement.link || ""}
                  onChange={(e) => setAnnouncement({ ...announcement, link: e.target.value })}
                  placeholder="e.g. /mini-sprouts/new-arrivals"
                  className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
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
                    className="w-4 h-4 rounded text-brand-ink focus:ring-brand-ink border-brand-border"
                  />
                  <span className="text-xs uppercase tracking-wider font-semibold text-brand-ink">
                    Display Announcement Bar on Storefront
                  </span>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingAnnouncement || isLoading || !!loadError}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-ink text-white rounded-sm text-xs uppercase tracking-wider font-semibold shadow-xs hover:bg-brand-text active:bg-brand-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{savingAnnouncement ? "Saving..." : "Save Announcement"}</span>
                </button>
              </div>
            </form>
          </AdminCard>

          {/* SECTION 2: SHIPPING SETTINGS */}
          <AdminCard className="p-6 space-y-4">
            <div className="border-b border-brand-border pb-3 flex items-center space-x-2">
              <Truck className="w-4 h-4 text-brand-ink" />
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                Shipping &amp; Delivery Charge
              </h2>
            </div>

            {shippingMsg && (
              <AdminAlert
                type={shippingMsg.type}
                message={shippingMsg.text}
                fading={shippingFading}
                onDismiss={() => setShippingMsg(null)}
              />
            )}

            <form onSubmit={handleSaveShipping} className="space-y-4 text-xs">
              <div className="max-w-xs">
                <label
                  htmlFor="flat-delivery-charge"
                  className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                >
                  Flat Delivery Charge (PKR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-muted font-semibold text-xs">
                    PKR
                  </span>
                  <input
                    id="flat-delivery-charge"
                    type="text"
                    required
                    value={shipping.flatDeliveryCharge}
                    onChange={(e) => setShipping({ flatDeliveryCharge: e.target.value })}
                    placeholder="Amount in PKR"
                    className="w-full pl-12 pr-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink font-semibold focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                  />
                </div>
                <span className="text-[10px] text-brand-muted mt-1 block">
                  Applied as a single flat charge per customer order across Pakistan regardless of
                  item count.
                </span>
              </div>

              <div className="p-3.5 bg-brand-surface-soft border border-brand-border rounded-sm text-[11px] text-brand-muted flex items-start space-x-2">
                <Info className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>
                  <strong>Fixed Delivery Terms:</strong> Pakistan-wide delivery is within 10 days.
                  This promise is fixed brand content and not dynamically reconfigured in the
                  operational settings.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingShipping || isLoading || !!loadError}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-ink text-white rounded-sm text-xs uppercase tracking-wider font-semibold shadow-xs hover:bg-brand-text active:bg-brand-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{savingShipping ? "Saving..." : "Save Delivery Charge"}</span>
                </button>
              </div>
            </form>
          </AdminCard>

          {/* SECTION 3: BANK TRANSFER SETTINGS */}
          <AdminCard className="p-6 space-y-4">
            <div className="border-b border-brand-border pb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-brand-ink" />
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                  Manual Bank Transfer Details
                </h2>
              </div>
              <AdminBadge variant={isBankTransferCustomerReady ? "emerald" : "amber"}>
                {isBankTransferCustomerReady
                  ? "Available at Checkout"
                  : "Incomplete (Hidden from Checkout)"}
              </AdminBadge>
            </div>

            {bankMsg && (
              <AdminAlert
                type={bankMsg.type}
                message={bankMsg.text}
                fading={bankFading}
                onDismiss={() => setBankMsg(null)}
              />
            )}

            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-sm text-[11px] text-amber-900 flex items-start space-x-2">
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
                  <label
                    htmlFor="bank-name"
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                  >
                    Bank Name *
                  </label>
                  <input
                    id="bank-name"
                    type="text"
                    value={bankTransfer.bankName || ""}
                    onChange={(e) => setBankTransfer({ ...bankTransfer, bankName: e.target.value })}
                    placeholder="e.g. Meezan Bank Limited"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="bank-account-title"
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                  >
                    Account Title *
                  </label>
                  <input
                    id="bank-account-title"
                    type="text"
                    value={bankTransfer.accountTitle || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, accountTitle: e.target.value })
                    }
                    placeholder="e.g. Kids Wear Private Limited"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="bank-account-or-iban"
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                  >
                    Account Number / IBAN *
                  </label>
                  <input
                    id="bank-account-or-iban"
                    type="text"
                    value={bankTransfer.accountOrIban || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, accountOrIban: e.target.value })
                    }
                    placeholder="Enter account number or IBAN"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink font-mono focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="bank-branch-code"
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                  >
                    Branch Code (Optional)
                  </label>
                  <input
                    id="bank-branch-code"
                    type="text"
                    value={bankTransfer.branchCode || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, branchCode: e.target.value })
                    }
                    placeholder="e.g. 0102"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="bank-branch-location"
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                  >
                    Branch Location (Optional)
                  </label>
                  <input
                    id="bank-branch-location"
                    type="text"
                    value={bankTransfer.branchLocation || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, branchLocation: e.target.value })
                    }
                    placeholder="e.g. DHA Phase 5 Branch, Lahore"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="bank-instructions"
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                  >
                    Customer Instructions *
                  </label>
                  <textarea
                    id="bank-instructions"
                    rows={3}
                    value={bankTransfer.instructions || ""}
                    onChange={(e) =>
                      setBankTransfer({ ...bankTransfer, instructions: e.target.value })
                    }
                    placeholder="Enter payment instructions shown at checkout"
                    className="w-full px-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingBank || isLoading || !!loadError}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-ink text-white rounded-sm text-xs uppercase tracking-wider font-semibold shadow-xs hover:bg-brand-text active:bg-brand-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{savingBank ? "Saving..." : "Save Bank Details"}</span>
                </button>
              </div>
            </form>
          </AdminCard>

          {/* SECTION 4: NOTIFICATIONS SETTINGS */}
          <AdminCard className="p-6 space-y-4">
            <div className="border-b border-brand-border pb-3 flex items-center space-x-2">
              <Mail className="w-4 h-4 text-brand-ink" />
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                Admin Order Notifications
              </h2>
            </div>

            {notificationsMsg && (
              <AdminAlert
                type={notificationsMsg.type}
                message={notificationsMsg.text}
                fading={notificationsFading}
                onDismiss={() => setNotificationsMsg(null)}
              />
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
                    className="w-4 h-4 rounded text-brand-ink focus:ring-brand-ink border-brand-border"
                  />
                  <span className="text-xs uppercase tracking-wider font-semibold text-brand-ink">
                    Send Email Notification When New Orders are Placed
                  </span>
                </label>
              </div>

              <div>
                <label
                  htmlFor="notification-recipient"
                  className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                >
                  Recipient Email Address
                </label>
                <input
                  id="notification-recipient"
                  type="email"
                  value={notifications.newOrderNotificationRecipient || ""}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      newOrderNotificationRecipient: e.target.value,
                    })
                  }
                  placeholder="name@example.com"
                  className="w-full max-w-md px-3 py-2 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                />
                <span className="text-[10px] text-brand-muted mt-0.5 block">
                  Designated operations inbox to receive transaction alerts.
                </span>
              </div>

              <div className="p-3.5 bg-brand-surface-soft border border-brand-border rounded-sm text-[11px] text-brand-muted flex items-start space-x-2">
                <Info className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
                <span>
                  <strong>Security &amp; Deployment Boundary:</strong> Email delivery credentials
                  and sender identities are managed exclusively via server deployment environment
                  variables. They are never exposed, inspected, or configured in the browser UI.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingNotifications || isLoading || !!loadError}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-ink text-white rounded-sm text-xs uppercase tracking-wider font-semibold shadow-xs hover:bg-brand-text active:bg-brand-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{savingNotifications ? "Saving..." : "Save Notification Settings"}</span>
                </button>
              </div>
            </form>
          </AdminCard>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
