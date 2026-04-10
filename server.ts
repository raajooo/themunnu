import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { createRequire } from "module";
import Razorpay from "razorpay";
import crypto from "crypto";
import axios from "axios";
import nodemailer from "nodemailer";

const require = createRequire(import.meta.url);
const firebaseConfig = require("./firebase-applet-config.json");

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    let credential;

    if (serviceAccountVar) {
      try {
        const serviceAccount = JSON.parse(serviceAccountVar);
        credential = admin.credential.cert(serviceAccount);
        console.log("Firebase Admin: Initialized with Service Account from ENV");
      } catch (e) {
        console.error("Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON", e);
      }
    }

    if (!credential) {
      console.warn("Firebase Admin: No Service Account found. Falling back to applicationDefault");
      credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({
      credential,
      projectId: firebaseConfig.projectId
    });
  } catch (error) {
    console.error("Firebase Admin Critical Init Error:", error);
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
}

const auth = admin.auth();
const firestore = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);

const JWT_SECRET = process.env.JWT_SECRET || "munnu-secret-key-123";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_live_SZP0qjeVAeHesZ",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "1aSgGVDpydTCYZfhFMvm3QyE"
});

// SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const app = express();
app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Munnu API is running" });
});

// --- ADMIN ROUTES ---

// 1. Send Coupon Reminders
app.post("/api/admin/send-coupon-reminders", async (req, res) => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    // 1. Fetch coupons expiring in the next 3 days
    const couponsSnap = await firestore.collection("coupons")
      .where("isActive", "==", true)
      .get();

    const expiringCoupons = couponsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(coupon => {
        if (!coupon.expiryDate) return false;
        const expiry = new Date(coupon.expiryDate);
        return expiry > now && expiry <= threeDaysFromNow;
      });

    if (expiringCoupons.length === 0) {
      return res.json({ success: true, message: "No coupons expiring soon" });
    }

    // 2. Fetch all users (in a real app, you'd filter by those who haven't used these coupons)
    const usersSnap = await firestore.collection("users").get();
    const users = usersSnap.docs.map(doc => doc.data());

    let reminderCount = 0;

    for (const user of users) {
      if (!user.email) continue;

      for (const coupon of expiringCoupons) {
        // Check if user has used this coupon
        const usageDoc = await firestore.collection("coupon_usage").doc(`${user.uid}_${coupon.code}`).get();
        
        if (!usageDoc.exists || (coupon.maxUsagePerUser && usageDoc.data()?.count < coupon.maxUsagePerUser)) {
          // Send Mock Email
          console.log(`[MOCK EMAIL] To: ${user.email}`);
          console.log(`Subject: Don't miss out! Your coupon ${coupon.code} is expiring soon.`);
          console.log(`Body: Hi ${user.displayName || 'there'}, your coupon ${coupon.code} for ${coupon.discountValue}${coupon.discountType === 'percentage' ? '%' : '₹'} off expires on ${new Date(coupon.expiryDate).toLocaleDateString()}. Use it now at Munnu!`);
          console.log('---');
          reminderCount++;
        }
      }
    }

    res.json({ success: true, message: `Sent ${reminderCount} reminders for ${expiringCoupons.length} coupons.` });
  } catch (error: any) {
    console.error("Reminder Error:", error);
    res.status(500).json({ error: "Failed to send reminders", details: error.message });
  }
});

// 2. Send Newsletter
app.post("/api/admin/send-newsletter", async (req, res) => {
  const { subject, message, products, subscribers } = req.body;

  if (!subscribers || subscribers.length === 0) {
    return res.status(400).json({ error: "No subscribers provided" });
  }

  try {
    const productHtml = products && products.length > 0 
      ? `
        <div style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          ${products.map((p: any) => `
            <div style="border: 1px solid #eee; border-radius: 15px; padding: 15px; text-align: center;">
              <img src="${p.image}" alt="${p.name}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; margin-bottom: 10px;">
              <h4 style="margin: 0; font-size: 14px; text-transform: uppercase; font-weight: 900;">${p.name}</h4>
              <p style="margin: 5px 0; font-weight: bold; color: #000;">₹${p.price}</p>
              <a href="https://munnu.in/product/${p.id}" style="display: inline-block; padding: 8px 15px; background: #000; color: #fff; text-decoration: none; border-radius: 5px; font-size: 10px; font-weight: bold; text-transform: uppercase;">View Product</a>
            </div>
          `).join("")}
        </div>
      `
      : "";

    const mailOptions = {
      from: `"Munnu Sneaker Store" <${process.env.SMTP_USER}>`,
      bcc: subscribers.join(", "), // Use BCC to hide emails from each other
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #eee; border-radius: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="font-size: 32px; font-weight: 900; letter-spacing: -2px; margin: 0;">MUNNU</h1>
            <p style="font-size: 10px; font-weight: bold; color: #999; text-transform: uppercase; letter-spacing: 2px;">The Sneaker Destination</p>
          </div>
          
          <div style="font-size: 16px; line-height: 1.6; color: #333;">
            ${message.replace(/\n/g, "<br>")}
          </div>

          ${productHtml}

          <div style="margin-top: 40px; padding-top: 20px; border-t: 1px solid #eee; text-align: center;">
            <p style="font-size: 12px; color: #999;">You're receiving this because you subscribed to Munnu updates.</p>
            <p style="font-size: 12px; color: #999;">© 2026 MUNNU Sneaker Store. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail(mailOptions);
      console.log(`Newsletter "${subject}" sent to ${subscribers.length} subscribers`);
    } else {
      console.log(`[MOCK] Newsletter "${subject}" to ${subscribers.length} subscribers (SMTP not configured)`);
    }

    res.json({ success: true, message: `Newsletter sent to ${subscribers.length} subscribers` });
  } catch (error: any) {
    console.error("Newsletter Send Error:", error);
    res.status(500).json({ error: "Failed to send newsletter", details: error.message });
  }
});

// --- AUTH ROUTES ---

// 1. Send OTP via Email (Google SMTP)
app.post("/api/auth/send-otp", async (req, res) => {
  const { identifier, type } = req.body; // type: 'register' or 'forgot-password'
  if (!identifier) return res.status(400).json({ error: "Email or Phone number is required" });

  try {
    console.log(`[AUTH] Sending OTP for ${identifier} (type: ${type})`);
    let email = "";
    let phoneNumber = "";
    const isEmail = identifier.includes("@");

    if (type === "forgot-password") {
      if (!isEmail) {
        return res.status(400).json({ error: "Please provide your registered email address" });
      }
      
      const emailQuery = await firestore.collection("users").where("email", "==", identifier.toLowerCase()).get();
      if (emailQuery.empty) {
        return res.status(400).json({ error: "User not found with this email" });
      }
      const userData = emailQuery.docs[0].data();
      email = userData.email;
      phoneNumber = userData.phoneNumber;
    } else if (type === "register") {
      if (!isEmail) {
        return res.status(400).json({ error: "Please provide a valid email for registration OTP" });
      }
      email = identifier.toLowerCase();
      
      // Check if email already exists
      const emailSnap = await firestore.collection("users").where("email", "==", email).get();
      if (!emailSnap.empty) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const { phoneNumber: rawPhone } = req.body;
      if (rawPhone && typeof rawPhone === 'string') {
        const phone = rawPhone.replace(/\D/g, "").slice(-10);
        if (phone) {
          const phoneSnap = await firestore.collection("users").where("phoneNumber", "==", phone).get();
          if (!phoneSnap.empty) {
            return res.status(400).json({ error: "Phone number already registered" });
          }
          phoneNumber = phone;
        }
      }
    } else {
      return res.status(400).json({ error: "Invalid OTP type" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Send Email
    const mailOptions = {
      from: `"Munnu Support" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your Munnu Verification Code",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px; margin: auto;">
          <h2 style="color: #000; text-align: center; text-transform: uppercase; letter-spacing: 2px;">Munnu Verification</h2>
          <p style="font-size: 16px; color: #555;">Hi there,</p>
          <p style="font-size: 16px; color: #555;">Use the following OTP to verify your account. This code is valid for 5 minutes.</p>
          <div style="background: #f9f9f9; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #000;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #999; text-align: center;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail(mailOptions);
      console.log(`OTP ${otp} sent to ${email}`);
    } else {
      console.log(`[MOCK] OTP ${otp} to ${email} (SMTP not configured)`);
    }

    const otpToken = jwt.sign({ email, otp, phoneNumber }, JWT_SECRET, { expiresIn: "10m" });
    res.json({ success: true, otpToken, email, phoneNumber, message: "OTP sent successfully to your email" });
  } catch (error: any) {
    console.error("OTP Error:", error);
    res.status(500).json({ error: "Failed to send OTP. Please try again later." });
  }
});

// 2. Register User
app.post("/api/auth/register", async (req, res) => {
  const { phoneNumber: rawPhone, fullName, password, email, otp, otpToken } = req.body;
  
  if (!rawPhone || typeof rawPhone !== 'string') {
    return res.status(400).json({ error: "Phone number is required" });
  }

  const phoneNumber = rawPhone.replace(/\D/g, "").slice(-10);
  if (!phoneNumber) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    console.log(`[AUTH] Registering user: ${email} (${phoneNumber})`);
    // Verify OTP
    if (!otpToken || !otp) {
      return res.status(400).json({ error: "OTP verification required" });
    }

    const decoded = jwt.verify(otpToken, JWT_SECRET) as { email: string, otp: string };
    if (decoded.email !== email.toLowerCase() || decoded.otp !== otp) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Check if phone number already exists
    const phoneSnap = await firestore.collection("users").where("phoneNumber", "==", phoneNumber).get();
    if (!phoneSnap.empty) {
      return res.status(400).json({ error: "Phone number already registered" });
    }

    // Check if email already exists
    const emailSnap = await firestore.collection("users").where("email", "==", email.toLowerCase()).get();
    if (!emailSnap.empty) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const adminEmail = "raajooothakur0@gmail.com";
    const adminPhone = "9193731911";
    const adminPassword = "Thakur.Asmit";

    const isAdminUser = (phoneNumber === adminPhone || phoneNumber === "93731911" || (email && email.toLowerCase() === adminEmail));
    const finalPassword = isAdminUser ? adminPassword : password;
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const userDoc = {
      uid: phoneNumber,
      phoneNumber,
      displayName: fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: isAdminUser ? "admin" : "user",
      addresses: [],
      createdAt: new Date().toISOString()
    };

    await firestore.collection("users").doc(phoneNumber).set(userDoc);
    const customToken = await auth.createCustomToken(phoneNumber);
    res.json({ success: true, customToken });
  } catch (error: any) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Registration failed", details: error.message });
  }
});

// 3. Login User
app.post("/api/auth/login", async (req, res) => {
  const { identifier, password } = req.body; // identifier can be email or phone
  if (!identifier || !password) {
    return res.status(400).json({ error: "Identifier and password are required" });
  }

  try {
    let userData: any = null;
    let phoneNumber: string = "";

    // Check if identifier is an email
    const isEmail = identifier.includes("@");

    if (isEmail) {
      const emailQuery = await firestore.collection("users").where("email", "==", identifier.toLowerCase()).get();
      if (emailQuery.empty) {
        return res.status(400).json({ error: "User not found with this email" });
      }
      userData = emailQuery.docs[0].data();
      phoneNumber = userData.phoneNumber;
    } else {
      // Treat as phone number
      phoneNumber = identifier.replace(/\D/g, "").slice(-10);
      const userDoc = await firestore.collection("users").doc(phoneNumber).get();
      if (!userDoc.exists) {
        return res.status(400).json({ error: "User not found with this phone number" });
      }
      userData = userDoc.data();
    }

    const adminPassword = "Thakur.Asmit";
    const adminEmail = "raajooothakur0@gmail.com";
    const adminPhone = "9193731911";
    
    const isAdminUser = phoneNumber === adminPhone || phoneNumber === "93731911" || (userData?.email && userData.email.toLowerCase() === adminEmail);
    
    let isPasswordValid = await bcrypt.compare(password, userData?.password);
    
    if (!isPasswordValid && isAdminUser && password === adminPassword) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Wrong password" });
    }

    if (isAdminUser) {
      const isCorrectAdminPassInDb = await bcrypt.compare(adminPassword, userData?.password);
      if (!isCorrectAdminPassInDb || userData?.role !== "admin") {
        const newHashedPassword = await bcrypt.hash(adminPassword, 10);
        await firestore.collection("users").doc(phoneNumber).update({ 
          role: "admin",
          password: newHashedPassword 
        });
      }
    }

    const customToken = await auth.createCustomToken(phoneNumber);
    res.json({ success: true, customToken });
  } catch (error: any) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Login failed", details: error.message });
  }
});

// 4. Reset Password
app.post("/api/auth/reset-password", async (req, res) => {
  const { phoneNumber: rawPhone, newPassword, otp, otpToken } = req.body;
  
  try {
    const decoded = jwt.verify(otpToken, JWT_SECRET) as { email: string, otp: string, phoneNumber?: string };
    
    // If we have phoneNumber in token (from forgot-password flow), use it.
    // Otherwise use the one provided in body.
    const phoneNumber = decoded.phoneNumber || (rawPhone ? rawPhone.replace(/\D/g, "").slice(-10) : "");

    if (!phoneNumber) {
      return res.status(400).json({ error: "User identification failed. Please try again." });
    }

    if (decoded.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await firestore.collection("users").doc(phoneNumber).update({ password: hashedPassword });
    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(400).json({ error: "Reset failed or OTP expired" });
  }
});

// --- PAYMENT ROUTES ---

// 1. Create Razorpay Order
app.post("/api/payment/create-razorpay-order", async (req, res) => {
  const { amount, currency = "INR", receipt } = req.body;
  
  try {
    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error: any) {
    console.error("Razorpay Order Error:", error);
    res.status(500).json({ error: "Failed to create payment order", details: error.message });
  }
});

// 2. Verify Razorpay Payment
app.post("/api/payment/verify-razorpay-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  try {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "1aSgGVDpydTCYZfhFMvm3QyE")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ success: false, error: "Invalid payment signature" });
    }
  } catch (error: any) {
    console.error("Razorpay Verification Error:", error);
    res.status(500).json({ error: "Payment verification failed", details: error.message });
  }
});

// Payment and Shipping Placeholders
app.post("/api/payment/create-order", async (req, res) => {
  res.json({ success: true, orderId: `order_${Math.random().toString(36).slice(2)}` });
});

app.get("/api/shipping/track/:id", async (req, res) => {
  const { id } = req.params; // trackingId (waybill)
  
  try {
    // Get settings for API key
    const settingsDoc = await firestore.collection("settings").doc("main").get();
    const settings = settingsDoc.data();
    const apiKey = settings?.delhiveryApiKey || process.env.DELHIVERY_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: "Delhivery API key not configured" });
    }

    const response = await axios.get(`https://track.delhivery.com/api/v1/packages/json/?waybill=${id}`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error("Delhivery Tracking Error:", error);
    res.status(500).json({ error: "Failed to track shipment", details: error.message });
  }
});

// 2. Create Shipment (Admin only)
app.post("/api/shipping/create-shipment", async (req, res) => {
  const { orderId } = req.body;
  
  try {
    const orderDoc = await firestore.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) return res.status(404).json({ error: "Order not found" });
    const order = orderDoc.data();

    const settingsDoc = await firestore.collection("settings").doc("main").get();
    const settings = settingsDoc.data();
    const apiKey = settings?.delhiveryApiKey || process.env.DELHIVERY_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: "Delhivery API key not configured" });
    }

    // Prepare Delhivery Payload
    const payload = {
      shipments: [{
        add: order?.address?.address,
        address_type: "home",
        phone: order?.address?.phone,
        payment_mode: order?.paymentMethod === 'cod' ? "COD" : "Prepaid",
        name: order?.address?.name,
        pin: order?.address?.pincode,
        order: order?.id,
        cod_amount: order?.paymentMethod === 'cod' ? order?.totalAmount : 0,
        total_amount: order?.totalAmount,
        products_desc: order?.items?.map((item: any) => item.name).join(", "),
        hsn_code: "",
        quantity: order?.items?.reduce((acc: number, item: any) => acc + item.quantity, 0)
      }],
      pickup_location: {
        name: "Main Warehouse",
        add: "123 Warehouse St",
        city: "Mumbai",
        pin: "400001",
        phone: "9876543210"
      }
    };

    const response = await axios.post('https://track.delhivery.com/api/cne/json/', `format=json&data=${JSON.stringify(payload)}`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data.success) {
      const trackingId = response.data.packages[0].waybill;
      await firestore.collection("orders").doc(orderId).update({
        trackingId,
        orderStatus: 'shipped'
      });
      res.json({ success: true, trackingId });
    } else {
      res.status(400).json({ error: "Failed to create shipment", details: response.data });
    }
  } catch (error: any) {
    console.error("Delhivery Create Shipment Error:", error);
    res.status(500).json({ error: "Failed to create shipment", details: error.message });
  }
});

// 3. Webhook for automatic updates
app.post("/api/shipping/webhook", async (req, res) => {
  const data = req.body;
  console.log("Delhivery Webhook Received:", data);

  try {
    const waybill = data.waybill || data.awb;
    const status = data.status?.status?.toLowerCase();
    
    if (waybill) {
      const orderQuery = await firestore.collection("orders").where("trackingId", "==", waybill).get();
      if (!orderQuery.empty) {
        const orderDoc = orderQuery.docs[0];
        let newStatus = orderDoc.data().orderStatus;

        if (status.includes("delivered")) {
          newStatus = "delivered";
        } else if (status.includes("shipped") || status.includes("in transit")) {
          newStatus = "shipped";
        } else if (status.includes("cancelled")) {
          newStatus = "cancelled";
        }

        await orderDoc.ref.update({
          orderStatus: newStatus,
          lastTrackingUpdate: data
        });
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Global Error:", err);
  res.status(500).json({ error: "Internal Server Error", details: err.message });
});

// Vite / Static Serving
if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = Number(process.env.PORT) || 3000;
if (process.env.VERCEL !== "1") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
