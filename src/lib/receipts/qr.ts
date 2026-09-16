/**
 * Ported verbatim from zoho-books-clone ("Zeno") src/lib/receipts/qr.ts.
 * See docs/PORTED.md.
 */
import QRCode from "qrcode";

/** PNG data URL of a QR encoding the given URL — for the receipt view page. */
export async function qrPngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" });
}
