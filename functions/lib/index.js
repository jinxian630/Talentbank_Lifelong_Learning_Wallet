"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpiredEvents = exports.getSuiSalt = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const crypto = __importStar(require("crypto"));
(0, app_1.initializeApp)();
/**
 * Returns a deterministic salt for the authenticated user.
 * Generated once and stored permanently — same Google account always
 * produces the same Sui address via jwtToAddress(jwt, salt).
 */
exports.getSuiSalt = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const saltRef = db.collection('userSalts').doc(uid);
    const snap = await saltRef.get();
    if (snap.exists) {
        return { salt: snap.data().salt };
    }
    // BigInt decimal string — compatible with Sui SDK's jwtToAddress()
    const salt = BigInt('0x' + crypto.randomBytes(16).toString('hex')).toString();
    await saltRef.set({ salt, createdAt: new Date() });
    return { salt };
});
exports.deleteExpiredEvents = (0, scheduler_1.onSchedule)('every 24 hours', async () => {
    const db = (0, firestore_1.getFirestore)();
    const now = firestore_1.Timestamp.now();
    const expired = await db.collection('events')
        .where('endAt', '<', now)
        .get();
    if (expired.empty)
        return;
    // Firestore batch limit is 500 writes per commit
    const batches = [];
    let batch = db.batch();
    let count = 0;
    for (const doc of expired.docs) {
        batch.delete(doc.ref);
        count++;
        if (count === 500) {
            batches.push(batch);
            batch = db.batch();
            count = 0;
        }
    }
    if (count > 0)
        batches.push(batch);
    await Promise.all(batches.map(b => b.commit()));
});
//# sourceMappingURL=index.js.map