"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getDoc,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AuthUser, FirestoreUser, UserRole } from "@/lib/types";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user details from Firestore
  const fetchUserDetails = async (
    firebaseUser: FirebaseUser,
  ): Promise<FirestoreUser | null> => {
    if (!db) {
      console.warn(
        "[Auth] Firestore not initialized - returning null from fetchUserDetails",
      );
      return null;
    }

    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        console.warn(
          `[Auth] User document not found for UID: ${firebaseUser.uid}`,
        );
        return null;
      }

      return userDoc.data() as FirestoreUser;
    } catch (err: any) {
      console.error("[Auth] Error fetching user details:", err);
      return null;
    }
  };

  // Convert Firestore user to Auth context user
  const createAuthUser = (firestoreUser: FirestoreUser): AuthUser => ({
    ...firestoreUser,
    isLoading: false,
    error: null,
  });

  // Initialize auth listener
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let unsubscribeProfile: (() => void) | null = null;
    let lastLoginUpdated = false;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous profile listener if user changes
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      lastLoginUpdated = false;
      if (firebaseUser) {
        setError(null);

        if (db) {
          const userDocRef = doc(db!, "users", firebaseUser.uid);

          // Use a real-time listener. This is resilient to offline states.
          unsubscribeProfile = onSnapshot(
            userDocRef,
            (userDoc) => {
              const data = userDoc.data();
              if (userDoc.exists() && data && "role" in data) {
                setUser(createAuthUser(data as FirestoreUser));
                setError(null);

                // Update last login (once per session)
                if (!lastLoginUpdated) {
                  lastLoginUpdated = true;
                  setDoc(
                    userDocRef,
                    { lastLogin: serverTimestamp() },
                    { merge: true },
                  ).catch((err) =>
                    console.warn("[Auth] lastLogin update failed:", err),
                  );
                }
              } else if (!userDoc.exists()) {
                setError("User profile not found.");
                setUser(null);
              }
              setLoading(false);
            },
            (err) => {
              console.error("[Auth] Profile listener error:", err);
              if (err.code !== "unavailable") setError(err.message);
              setError(null);
              setLoading(false);
            },
          );
        } else {
          // No Firestore available — use minimal Auth-derived profile
          const fallback: FirestoreUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "User",
            role: "customer_service",
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setUser(createAuthUser(fallback));
        }

        setLoading(false);
      } else {
        // User is signed out
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    console.log("[Auth] Auth state changed:", {
      user,
      loading,
      error,
    });
  }, [user, loading, error]);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      const credential = await signInWithEmailAndPassword(
        auth!,
        email,
        password,
      );

      // Fetch fresh user profile immediately after sign-in
      const firebaseUser = credential.user || auth!.currentUser;
      if (firebaseUser) {
        const userDetails = await fetchUserDetails(firebaseUser);

        if (userDetails) {
          setUser(createAuthUser(userDetails));
        } else {
          // If no Firestore profile, clear user and inform
          setUser(null);
          setError("User profile not found. Please contact administrator.");
          await firebaseSignOut(auth!);
          throw new Error("User profile not found");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
  ) => {
    if (!db) {
      throw new Error("Database not initialized");
    }

    try {
      setError(null);
      setLoading(true);

      // Create Firebase Auth account
      const credential = await createUserWithEmailAndPassword(
        auth!,
        email,
        password,
      );

      // Create Firestore user document
      const now = new Date().toISOString();
      const userDocument: FirestoreUser = {
        uid: credential.user.uid,
        email,
        displayName,
        role,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db!, "users", credential.user.uid), userDocument);

      setUser(createAuthUser(userDocument));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await firebaseSignOut(auth!);
      setUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed";
      setError(message);
      throw err;
    }
  };

  const refreshUser = async () => {
    try {
      if (!auth!.currentUser) {
        setUser(null);
        return;
      }

      const userDetails = await fetchUserDetails(auth!.currentUser);
      if (userDetails) {
        setUser(createAuthUser(userDetails));
      }
    } catch (err) {
      console.error("[Auth] Error refreshing user:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh user");
    }
  };

  const hasRole = (roleOrRoles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        refreshUser,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
