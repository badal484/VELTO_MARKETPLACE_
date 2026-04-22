import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { Order } from '../models/Order';
import { Shop } from '../models/Shop';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { IOrder, IShop, IUser, IProduct } from '@shared/types';

import { uploadImage } from '../utils/imagekit';

export const generateInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Fetch order with all needed associations
    const order = await Order.findById(id)
      .populate('product')
      .populate('shop')
      .populate('buyer')
      .populate('seller');

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Verify ownership (only buyer or seller can download)
    const buyerId = (order.buyer as any)._id?.toString() || order.buyer.toString();
    const sellerId = (order.seller as any)._id?.toString() || order.seller.toString();
    const currentUserId = req.user?._id.toString();

    if (buyerId !== currentUserId && sellerId !== currentUserId) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const castedProduct = order.product as unknown as IProduct;
    const castedShop = order.shop as unknown as IShop;
    const castedBuyer = order.buyer as unknown as IUser;

    // Initialize PDF Document
    const doc = new PDFDocument({ margin: 50 });

    // Collect PDF data in chunks
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Handle end of PDF generation
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // --- PDF LAYOUT ---
    // (Layout code remains the same logically)
    const createdAt = (order as any).createdAt || new Date();
    const d = new Date(createdAt);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

    doc
      .fillColor('#444444')
      .fontSize(20)
      .text('Velto Marketplace', 50, 50)
      .fontSize(10)
      .text('Hyper-Local Commerce Platform', 50, 80)
      .text(`Invoice Date: ${dateStr}`, 50, 95)
      .text(`Invoice #: NB-${order._id.toString().slice(-6).toUpperCase()}`, 50, 110)
      .moveDown();

    doc.moveTo(50, 130).lineTo(550, 130).stroke('#EEEEEE');

    doc
      .fontSize(12)
      .fillColor('#1E3A5F')
      .text('Seller Info:', 50, 150)
      .fontSize(10)
      .fillColor('#000000')
      .text(castedShop.name, 50, 170)
      .text('Verified Local Merchant', 50, 185)
      .moveDown();

    doc
      .fontSize(12)
      .fillColor('#1E3A5F')
      .text('Bill To:', 300, 150)
      .fontSize(10)
      .fillColor('#000000')
      .text(castedBuyer.name || 'Valued Customer', 300, 170)
      .text(`Email: ${castedBuyer.email}`, 300, 185);
    
    if (order.deliveryAddress && (order.deliveryAddress as any).street) {
        doc.text(`${(order.deliveryAddress as any).street || ''}`, 300, 200);
        const city = (order.deliveryAddress as any).city || '';
        const state = (order.deliveryAddress as any).state || '';
        const pincode = (order.deliveryAddress as any).pincode || '';
        doc.text(`${city}${city && state ? ', ' : ''}${state}${pincode ? ' - ' : ''}${pincode}`, 300, 215);
    }

    const tableTop = 260;
    doc
      .fillColor('#F8FAFC')
      .rect(50, tableTop, 500, 25)
      .fill()
      .fillColor('#1E3A5F')
      .fontSize(10)
      .text('Product Item', 60, tableTop + 8)
      .text('Qty', 350, tableTop + 8)
      .text('Unit Price', 400, tableTop + 8)
      .text('Subtotal', 480, tableTop + 8);

    const rowTop = tableTop + 35;
    doc
      .fillColor('#000000')
      .text(castedProduct.title, 60, rowTop)
      .text(order.quantity.toString(), 350, rowTop)
      .text(`INR ${castedProduct.price.toLocaleString()}`, 400, rowTop)
      .text(`INR ${(castedProduct.price * order.quantity).toLocaleString()}`, 480, rowTop);

    doc.moveTo(50, rowTop + 25).lineTo(550, rowTop + 25).stroke('#EEEEEE');

    const totalsTop = rowTop + 50;
    doc
      .fontSize(10)
      .text('Item Subtotal:', 350, totalsTop)
      .text(`INR ${(castedProduct.price * order.quantity).toLocaleString()}`, 480, totalsTop)
      .text('Delivery Fee:', 350, totalsTop + 20)
      .text(`INR ${(order.deliveryCharge || 0).toLocaleString()}`, 480, totalsTop + 20)
      .fontSize(14)
      .fillColor('#1E3A5F')
      .text('Grand Total:', 350, totalsTop + 50)
      .text(`INR ${order.totalPrice.toLocaleString()}`, 460, totalsTop + 50);

    doc
      .fontSize(8)
      .fillColor('#94A3B8')
      .text('Thank you for supporting your local economy with Velto.', 50, 700, { align: 'center' })
      .text('This is a computer generated invoice.', 50, 715, { align: 'center' });

    // End PDF Generation
    doc.end();

    // Await the buffer and upload to cloud
    const pdfBuffer = await pdfPromise;
    const downloadUrl = await uploadImage(pdfBuffer, `invoice-${order._id}.pdf`, '/invoices');

    res.status(200).json({ 
      success: true, 
      data: { url: downloadUrl } 
    });

  } catch (error) {
    console.error('Invoice Generation Error:', error);
    res.status(500).json({ success: false, message: 'Could not generate invoice' });
  }
};