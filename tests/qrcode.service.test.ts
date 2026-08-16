import { qrCodeService } from "../src/modules/tickets/qrcode.service";

describe("QrCodeService", () => {
  const payload = {
    ticketId: "ticket-123",
    eventId: "event-456",
    userId: "user-789",
  };

  it("generates a QR payload and a base64 image", async () => {
    const result = await qrCodeService.generate(payload);
    expect(result.qrCodeData).toContain(payload.ticketId);
    expect(result.qrCodeImage).toMatch(/^data:image\/png;base64,/);
  });

  it("verifies a correctly signed payload as valid", async () => {
    const { qrCodeData } = await qrCodeService.generate(payload);
    const verification = qrCodeService.verify(qrCodeData);
    expect(verification.valid).toBe(true);
    expect(verification.payload?.ticketId).toBe(payload.ticketId);
  });

  it("rejects a tampered payload", async () => {
    const { qrCodeData } = await qrCodeService.generate(payload);
    const tampered = qrCodeData.replace(payload.eventId, "some-other-event");
    const verification = qrCodeService.verify(tampered);
    expect(verification.valid).toBe(false);
  });

  it("rejects garbage input", () => {
    const verification = qrCodeService.verify("not-json-at-all");
    expect(verification.valid).toBe(false);
  });
});
