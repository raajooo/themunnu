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

const app = express();
app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Munnu API is running" });
});

// --- AUTH ROUTES ---

// 1. Send OTP via Fast2SMS
app.post("/api/auth/send-otp", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: "Phone number is required" });

  const cleanedPhone = phoneNumber.replace(/\D/g, "").slice(-10);
  if (cleanedPhone.length !== 10) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  try {
    // Fast2SMS system removed. OTP is mocked for development.
    console.log(`[MOCK] OTP ${otp} to ${cleanedPhone}`);

    const otpToken = jwt.sign({ phoneNumber: cleanedPhone, otp }, JWT_SECRET, { expiresIn: "5m" });
    res.json({ success: true, otpToken, message: "OTP sent successfully (Mocked)" });
  } catch (error: any) {
    console.error("OTP Error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// 2. Register User
app.post("/api/auth/register", async (req, res) => {
  const { phoneNumber: rawPhone, fullName, password, email } = req.body;
  const phoneNumber = rawPhone.replace(/\D/g, "").slice(-10);

  try {
    // Check if phone number already exists
    const phoneSnap = await firestore.collection("users").where("phoneNumber", "==", phoneNumber).get();
    if (!phoneSnap.empty) {
      return res.status(400).json({ error: "Phone number already registered" });
    }

    // Check if email already exists (if provided)
    if (email) {
      const emailSnap = await firestore.collection("users").where("email", "==", email.toLowerCase()).get();
      if (!emailSnap.empty) {
        return res.status(400).json({ error: "Email already registered" });
      }
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
      email: email ? email.toLowerCase() : "",
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
  const phoneNumber = rawPhone.replace(/\D/g, "").slice(-10);

  try {
    const decoded = jwt.verify(otpToken, JWT_SECRET) as { phoneNumber: string, otp: string };
    if (decoded.phoneNumber !== phoneNumber || decoded.otp !== otp) {
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
