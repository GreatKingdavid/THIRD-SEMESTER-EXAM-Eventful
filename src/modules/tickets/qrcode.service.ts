import QRCode from "qrcode";
import crypto from "crypto";
import { env } from "../../config/env";

interface TicketQrPayload {
  ticketId: string;
  eventId: string;
  userId: string;
}

/**
 * We embed a signature (HMAC) inside the QR payload so that, at the gate,
 * we can verify the QR was actually issued by Eventful and not forged/edited.
 */
function sign(payload: TicketQrPayload): string {
  const data = `${payload.ticketId}:${payload.eventId}:${payload.userId}`;
  return crypto.createHmac("sha256", env.jwtSecret).update(data).digest("hex");
}

export class QrCodeService {
  /** Builds the signed JSON string encoded inside the QR image, plus the QR image itself (base64 data URL). */
  async generate(payload: TicketQrPayload): Promise<{ qrCodeData: string; qrCodeImage: string }> {
    const signature = sign(payload);
    const qrCodeData = JSON.stringify({ ...payload, signature });
    const qrCodeImage = await QRCode.toDataURL(qrCodeData);
    return { qrCodeData, qrCodeImage };
  }

  /** Verifies a scanned QR payload's signature matches what we would have generated. */
  verify(qrCodeData: string): { valid: boolean; payload?: TicketQrPayload } {
    try {
      const parsed = JSON.parse(qrCodeData) as TicketQrPayload & { signature: string };
      const expected = sign({
        ticketId: parsed.ticketId,
        eventId: parsed.eventId,
        userId: parsed.userId,
      });
      const valid = crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(parsed.signature || "")
      );
      return valid ? { valid: true, payload: parsed } : { valid: false };
    } catch {
      return { valid: false };
    }
  }
}

export const qrCodeService = new QrCodeService();
