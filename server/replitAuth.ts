import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { setupLocalAuth } from "./localAuth";
import type { User } from "@shared/schema";

const isReplitEnvironment = !!process.env.REPLIT_DOMAINS;

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: 'auto',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Check if this is Gavin Green's OAuth account and assign superuser role
  const roles = claims["email"] === "gavin@gasco.digital" ? "superuser" : undefined;
  
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    roles,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  let oidcConfig: Awaited<ReturnType<typeof getOidcConfig>> | null = null;

  if (isReplitEnvironment) {
    oidcConfig = await getOidcConfig();

    const verify: VerifyFunction = async (
      tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
      verified: passport.AuthenticateCallback
    ) => {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      verified(null, user);
    };

    for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
      const strategy = new Strategy(
        {
          name: `replitauth:${domain}`,
          config: oidcConfig,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
    }
  }

  // Setup local authentication strategy
  await setupLocalAuth();

  // Update serialization to handle both OAuth and local users
  passport.serializeUser((user: Express.User, cb) => {
    const userData = user as any;
    if (userData.id) {
      cb(null, { type: 'local', id: userData.id });
    } else {
      cb(null, { type: 'oauth', data: user });
    }
  });

  passport.deserializeUser(async (serialized: any, cb) => {
    try {
      if (serialized && serialized.type === 'local') {
        const user = await storage.getUser(serialized.id);
        if (!user) {
          return cb(null, false);
        }
        cb(null, user);
      } else if (serialized && serialized.type === 'oauth') {
        cb(null, serialized.data);
      } else {
        cb(null, serialized);
      }
    } catch (error) {
      cb(null, false);
    }
  });

  // Local username/password login
  app.post("/api/login/local", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) {
        console.error("Authentication error (full):", JSON.stringify({ message: err?.message, stack: err?.stack, code: err?.code }));
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        console.log("Authentication failed:", info?.message);
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Login session error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        console.log("[auth] Login successful");
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "Session error" });
          }
          return res.json({ 
            success: true, 
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              roles: user.roles,
            }
          });
        });
      });
    })(req, res, next);
  });

  // Replit OAuth login (only available in Replit environment)
  if (isReplitEnvironment) {
    app.get("/api/login/replit", (req, res, next) => {
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });

    app.get("/api/callback", (req, res, next) => {
      passport.authenticate(`replitauth:${req.hostname}`, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/",
      })(req, res, next);
    });
  }

  // Universal logout
  app.post("/api/logout", (req, res) => {
    const user = req.user as any;
    const isOAuthUser = user && user.access_token && oidcConfig;
    
    req.logout(() => {
      if (isOAuthUser && oidcConfig) {
        res.json({ 
          redirectUrl: client.buildEndSessionUrl(oidcConfig, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        });
      } else {
        res.json({ success: true });
      }
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;

  if (!user.expires_at) {
    return next();
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
