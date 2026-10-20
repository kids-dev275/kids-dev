import { Resend } from "resend";
import { env } from "../config/env";

export interface OrderItemEmailData {
  productName: string;
  sku: string;
  sizeLabel: string;
  colorName: string;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
}

export interface SendNewOrderNotificationParams {
  orderNumber: string;
  recipientEmail: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string;
  customerCity: string;
  customerProvince: string;
  customerPostalCode: string | null;
  customerOrderNotes: string | null;
  paymentMethod: string;
  subtotal: string;
  deliveryCharge: string;
  grandTotal: string;
  items: OrderItemEmailData[];
}

export interface IEmailService {
  sendNewOrderNotification(
    params: SendNewOrderNotificationParams
  ): Promise<{ success: boolean; error?: string }>;
}

export class ResendEmailService implements IEmailService {
  private resend: Resend | null = null;

  constructor() {
    const apiKey = (process.env.RESEND_API_KEY || env.RESEND_API_KEY)?.trim();
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendNewOrderNotification(
    params: SendNewOrderNotificationParams
  ): Promise<{ success: boolean; error?: string }> {
    const apiKey = (process.env.RESEND_API_KEY || env.RESEND_API_KEY)?.trim();
    if (!apiKey) {
      return { success: false, error: "RESEND_API_KEY is not configured" };
    }

    const fromEmail = (process.env.RESEND_FROM_EMAIL || env.RESEND_FROM_EMAIL)?.trim();
    if (!fromEmail) {
      return { success: false, error: "RESEND_FROM_EMAIL is not configured" };
    }

    if (!this.resend) {
      this.resend = new Resend(apiKey);
    }

    const itemListText = params.items
      .map(
        (item) =>
          `- ${item.productName} (${item.sizeLabel} / ${item.colorName}) x ${item.quantity} @ Rs. ${item.unitPrice} = Rs. ${item.lineSubtotal}`
      )
      .join("\n");

    const textContent = `New Order Placed: ${params.orderNumber}

Order Details:
Order Number: ${params.orderNumber}
Payment Method: ${params.paymentMethod}
Subtotal: Rs. ${params.subtotal}
Delivery Charge: Rs. ${params.deliveryCharge}
Grand Total: Rs. ${params.grandTotal}

Customer Shipping Details:
Name: ${params.customerName}
Phone: ${params.customerPhone}
Email: ${params.customerEmail || "N/A"}
Address: ${params.customerAddress}
City: ${params.customerCity}
Province: ${params.customerProvince}
Postal Code: ${params.customerPostalCode || "N/A"}
Order Notes: ${params.customerOrderNotes || "N/A"}

Items:
${itemListText}
`;

    try {
      const { error } = await this.resend.emails.send({
        from: fromEmail,
        to: params.recipientEmail,
        subject: `[Kids Wear] New Order Received: ${params.orderNumber}`,
        text: textContent,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to send email" };
    }
  }
}

let activeEmailService: IEmailService = new ResendEmailService();

export function getEmailService(): IEmailService {
  return activeEmailService;
}

export function setEmailService(service: IEmailService): void {
  activeEmailService = service;
}

export function resetEmailService(): void {
  activeEmailService = new ResendEmailService();
}
