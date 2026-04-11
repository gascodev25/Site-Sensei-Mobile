import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export async function setupLocalAuth() {
  const localStrategy = new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        console.log("[localAuth] Looking up user:", email);
        const user = await storage.getUserByEmail(email);
        
        if (!user) {
          console.log("[localAuth] User not found:", email);
          return done(null, false, { message: "Invalid credentials" });
        }

        if (!user.passwordHash) {
          console.log("[localAuth] User has no password hash:", email);
          return done(null, false, { message: "Invalid credentials" });
        }

        console.log("[localAuth] Comparing password for:", email);
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        
        if (!isValidPassword) {
          console.log("[localAuth] Invalid password for:", email);
          return done(null, false, { message: "Invalid credentials" });
        }

        console.log("[localAuth] Login success for:", email);
        return done(null, user);
      } catch (error: any) {
        console.error("[localAuth] Strategy error:", JSON.stringify({ message: error?.message, code: error?.code, stack: error?.stack }));
        return done(error);
      }
    }
  );

  passport.use("local", localStrategy);
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function createPasswordUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  roles: string = "user"
): Promise<User> {
  const passwordHash = await hashPassword(password);
  
  return await storage.createPasswordUser({
    email,
    passwordHash,
    firstName,
    lastName,
    roles,
  });
}
