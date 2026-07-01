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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = require("express-rate-limit");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// ─── Security headers ─────────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
// ─── CORS ─────────────────────────────────────────────────────────────────────
// CLIENT_URL can be a comma-separated list of allowed origins, e.g.:
//   https://wc2026-betting-one.vercel.app,https://preview-xyz.vercel.app
// In development (no CLIENT_URL set) all origins are allowed.
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(s => s.trim())
    : null;
app.use((0, cors_1.default)({
    origin: allowedOrigins
        ? (origin, cb) => {
            // Allow server-to-server requests (no origin) and listed origins
            if (!origin || allowedOrigins.includes(origin)) {
                cb(null, true);
            }
            else {
                cb(new Error(`CORS: origin ${origin} not allowed`));
            }
        }
        : (_origin, cb) => cb(null, true),
    credentials: true,
}));
// Body parser — cap at 20 KB to block oversized-payload floods
app.use(express_1.default.json({ limit: '20kb' }));
// ─── Rate limiting ────────────────────────────────────────────────────────────
// General limiter: 150 requests per 15 minutes per IP for all routes
const generalLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    limit: 150,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});
app.use(generalLimiter);
// Auth limiter: 10 requests per 15 minutes per IP (brute-force protection)
const authLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many login attempts, please try again in 15 minutes.' },
});
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', auth_1.default);
const matches_1 = __importDefault(require("./routes/matches"));
app.use('/api/matches', matches_1.default);
const bets_1 = __importDefault(require("./routes/bets"));
app.use('/api/bets', bets_1.default);
const leaderboard_1 = __importDefault(require("./routes/leaderboard"));
app.use('/api/leaderboard', leaderboard_1.default);
const admin_1 = __importDefault(require("./routes/admin"));
app.use('/api/admin', admin_1.default);
const push_1 = __importDefault(require("./routes/push"));
app.use('/api/push', push_1.default);
// Initialise VAPID push before starting (non-fatal if keys are absent)
const pushService_1 = require("./services/pushService");
(0, pushService_1.initWebPush)();
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    // Start the live-data background poller after server is ready
    Promise.resolve().then(() => __importStar(require('./services/poller'))).then(({ startPoller }) => startPoller());
    // Start hourly DB backups
    Promise.resolve().then(() => __importStar(require('./services/backupService'))).then(({ startBackupScheduler }) => startBackupScheduler());
});
exports.default = app;
//# sourceMappingURL=index.js.map