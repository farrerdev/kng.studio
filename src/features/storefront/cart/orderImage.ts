import { getSupabaseImageSrc } from "../../../shared/utils/image";
import { formatMoney, getPriceValue } from "../../../shared/utils/money";
import { IMAGE_WIDTHS } from "../storefrontConstants";
import type { CartItem } from "./cartTypes";
import { formatSelectedSize, getCartTotal, getOrderTotal, getShippingFee } from "./cartUtils";

export function createOrderFileName(date = new Date()) {
  const dateParts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const timeParts = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
  return `kng-order-${dateParts}-${timeParts}.png`;
}

function formatOrderCreatedAt(date: Date) {
  const dateParts = [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
  const timeParts = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":");
  return `${timeParts} ${dateParts}`;
}

function loadOrderImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = getSupabaseImageSrc(src, IMAGE_WIDTHS.orderThumb, 76);
  });
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
      return;
    }
    line = nextLine;
  });
  if (line) context.fillText(line, x, currentY);
  return currentY + lineHeight;
}

export async function createOrderImageBlob(cartItems: CartItem[], createdAt = new Date()) {
  const width = 1080;
  const rowHeight = 188;
  const height = Math.max(900, 420 + cartItems.length * rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#111111";
  context.font = "700 54px Helvetica Neue, Arial, sans-serif";
  context.fillText("KNG.studio", 56, 82);
  context.font = "500 25px Helvetica Neue, Arial, sans-serif";
  context.fillStyle = "#6b6b6b";
  context.fillText(`Thông tin đơn hàng · ${formatOrderCreatedAt(createdAt)}`, 56, 122);
  context.strokeStyle = "#d9d9d9";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(56, 154);
  context.lineTo(width - 56, 154);
  context.stroke();

  let y = 200;
  for (const item of cartItems) {
    const image = await loadOrderImage(item.image.src);
    context.fillStyle = "#f4f4f4";
    context.fillRect(56, y - 36, 132, 132);
    if (image) {
      context.save();
      context.beginPath();
      context.rect(56, y - 36, 132, 132);
      context.clip();
      const scale = Math.max(132 / image.width, 132 / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      context.drawImage(image, 56 + (132 - drawWidth) / 2, y - 36 + (132 - drawHeight) / 2, drawWidth, drawHeight);
      context.restore();
    }

    context.fillStyle = "#111111";
    context.font = "700 28px Helvetica Neue, Arial, sans-serif";
    const titleBottom = wrapCanvasText(context, item.productName, 216, y, 520, 34);
    context.font = "500 24px Helvetica Neue, Arial, sans-serif";
    context.fillStyle = "#4d4d4d";
    context.fillText(`${item.patternName} · ${formatSelectedSize(item.sizeId)}`, 216, titleBottom + 8);
    context.fillText(`Số lượng: ${item.quantity}`, 216, titleBottom + 44);
    context.fillStyle = "#111111";
    context.font = "700 26px Helvetica Neue, Arial, sans-serif";
    context.fillText(formatMoney(getPriceValue(item.price) * item.quantity), width - 260, y + 34);
    context.strokeStyle = "#eeeeee";
    context.beginPath();
    context.moveTo(56, y + 128);
    context.lineTo(width - 56, y + 128);
    context.stroke();
    y += rowHeight;
  }

  const subtotal = getCartTotal(cartItems);
  const shippingFee = getShippingFee(cartItems);
  const total = getOrderTotal(cartItems);
  const summaryTop = height - 190;
  context.font = "500 28px Helvetica Neue, Arial, sans-serif";
  context.fillStyle = "#4d4d4d";
  context.fillText("Tạm tính", 56, summaryTop);
  context.fillText(formatMoney(subtotal), width - 300, summaryTop);
  context.fillText("Phí ship", 56, summaryTop + 48);
  if (shippingFee === 0) {
    context.fillStyle = "#8a8a8a";
    context.fillText("20.000đ", width - 430, summaryTop + 48);
    context.strokeStyle = "#8a8a8a";
    context.beginPath();
    context.moveTo(width - 430, summaryTop + 39);
    context.lineTo(width - 335, summaryTop + 39);
    context.stroke();
    context.fillStyle = "#111111";
    context.fillText("0đ", width - 300, summaryTop + 48);
  } else {
    context.fillText(formatMoney(shippingFee), width - 300, summaryTop + 48);
  }
  context.strokeStyle = "#d9d9d9";
  context.beginPath();
  context.moveTo(56, summaryTop + 82);
  context.lineTo(width - 56, summaryTop + 82);
  context.stroke();
  context.fillStyle = "#111111";
  context.font = "800 38px Helvetica Neue, Arial, sans-serif";
  context.fillText("Tổng", 56, height - 58);
  context.fillText(formatMoney(total), width - 300, height - 58);

  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.94));
}
