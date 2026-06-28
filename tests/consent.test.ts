import { describe, expect, it } from "vitest";
import { requireCheckedConsent, validateConsentProof } from "../src/lib/consent";

describe("consent validation", () => {
  it("rejects unchecked public consent", () => {
    const result = requireCheckedConsent(false, "I agree to be contacted by email, phone, or WhatsApp.");
    expect(result.ok).toBe(false);
  });

  it("accepts checked consent with exact text", () => {
    const result = requireCheckedConsent(true, "I agree to be contacted by a Dubai real estate advisor.");
    expect(result.ok).toBe(true);
  });

  it("requires at least one contact channel in consent proof", () => {
    const result = validateConsentProof({
      consentText: "I agree to be contacted by a Dubai real estate advisor.",
      consentChannel: "landing",
      consentTimestamp: new Date(),
      canContactEmail: false,
      canContactPhone: false,
      canContactWhatsapp: false,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts complete consent proof", () => {
    const result = validateConsentProof({
      consentText: "I agree to be contacted by a Dubai real estate advisor.",
      consentChannel: "landing",
      consentSourceUrl: "https://example.com/landing",
      consentTimestamp: new Date(),
      canContactEmail: true,
      canContactPhone: false,
      canContactWhatsapp: false,
    });
    expect(result.ok).toBe(true);
  });
});
