import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { createRequire } from "module";

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
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;

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
    if (FAST2SMS_API_KEY && FAST2SMS_API_KEY.trim()) {
      const response = await axios({
        method: 'post',
        url: 'https://www.fast2sms.com/dev/bulkV2',
        headers: {
          'authorization': FAST2SMS_API_KEY.trim(),
          'Content-Type': 'application/json'
        },
        data: {
          route: 'otp',
          variables_values: otp,
          numbers: cleanedPhone
        }
      });
      
      if (response.data.return === false) {
        return res.status(400).json({ error: response.data.message || "SMS provider error" });
      }
    } else {
      console.log(`[MOCK] OTP ${otp} to ${cleanedPhone}`);
    }

    const otpToken = jwt.sign({ phoneNumber: cleanedPhone, otp }, JWT_SECRET, { expiresIn: "5m" });
    res.json({ success: true, otpToken, message: "OTP sent successfully" });
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
    const userSnap = await firestore.collection("users").where("phoneNumber", "==", phoneNumber).get();
    if (!userSnap.empty) {
      return res.status(400).json({ error: "User already registered" });
    }

    const isAdminNumber = phoneNumber === "9193731911" || phoneNumber === "93731911";
    const finalPassword = isAdminNumber ? "Thakur.Asmit" : password;
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const userDoc = {
      uid: phoneNumber,
      phoneNumber,
      displayName: fullName,
      email: email || "",
      password: hashedPassword,
      role: isAdminNumber ? "admin" : "user",
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
  const { phoneNumber: rawPhone, password } = req.body;
  const phoneNumber = rawPhone.replace(/\D/g, "").slice(-10);

  try {
    const userDoc = await firestore.collection("users").doc(phoneNumber).get();
    if (!userDoc.exists) {
      return res.status(400).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    const adminPassword = "Thakur.Asmit";
    const isAdminNumber = phoneNumber === "9193731911" || phoneNumber === "93731911";
    
    let isPasswordValid = await bcrypt.compare(password, userData?.password);
    
    if (!isPasswordValid && isAdminNumber && password === adminPassword) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Wrong password" });
    }

    if (isAdminNumber) {
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

// Payment and Shipping Placeholders
app.post("/api/payment/create-order", async (req, res) => {
  res.json({ success: true, orderId: `order_${Math.random().toString(36).slice(2)}` });
});

app.get("/api/shipping/track/:id", async (req, res) => {
  res.json({ success: true, status: "In Transit" });
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
