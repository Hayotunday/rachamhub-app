"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AuthUser, UserProfile, UserRole } from "@/lib/types";

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

  // Fetch user details from Supabase `users` table
  const fetchUserDetails = async (
    supaUserId: string,
  ): Promise<UserProfile | null> => {
    if (!supabase) {
      console.warn("[Auth] Supabase client is not initialized.");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, display_name, role, is_active, is_deleted, created_at, updated_at, last_login")
        .eq("id", supaUserId)
        .maybeSingle();

      if (error) {
        console.error("[Auth] Error fetching user details:", error);
        return null;
      }

      if (!data) return null;

      // Map Supabase row to UserProfile shape
      const row = data as any;
      const mapped: UserProfile = {
        uid: row.id,
        email: row.email || "",
        displayName: row.display_name || row.displayName || "User",
        role: row.role || ("customer_service" as UserRole),
        isActive: typeof row.is_active === "boolean" ? row.is_active : true,
        isDeleted: typeof row.is_deleted === "boolean" ? row.is_deleted : false,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
        lastLogin: row.last_login || undefined,
      };

      return mapped;
    } catch (err: any) {
      console.error("[Auth] Error fetching user details:", err);
      return null;
    }
  };

  // Convert Firestore user to Auth context user
  const createAuthUser = (UserProfile: UserProfile): AuthUser => ({
    ...UserProfile,
    isLoading: false,
    error: null,
  });

  // Initialize auth listener
  useEffect(() => {
    let profileSubscription: any = null;

    const init = async () => {
      setLoading(true);
      if (!supabase) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user ?? null;

      if (!currentUser) {
        setUser(null);
        setLoading(false);
      } else {
        setError(null);
        const profile = await fetchUserDetails(currentUser.id);
        if (profile) setUser(createAuthUser(profile));

        // subscribe to realtime changes for this user's row
        try {
          profileSubscription = supabase
            .channel(`user-profile-${currentUser.id}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "users",
                filter: `id=eq.${currentUser.id}`,
              },
              (payload) => {
                if (payload.eventType === "DELETE") {
                  setUser(null);
                } else if (
                  payload.eventType === "INSERT" ||
                  payload.eventType === "UPDATE"
                ) {
                  const newData = payload.new as any;
                  if (newData)
                    setUser(
                      createAuthUser({
                        uid: newData.id,
                        email: newData.email || "",
                        displayName:
                          newData.display_name || newData.displayName || "User",
                        role: newData.role || ("customer_service" as UserRole),
                        isActive:
                          typeof newData.is_active === "boolean"
                            ? newData.is_active
                            : true,
                        createdAt:
                          newData.created_at || new Date().toISOString(),
                        updatedAt:
                          newData.updated_at || new Date().toISOString(),
                        lastLogin: newData.last_login || undefined,
                      } as UserProfile),
                    );
                }
                setLoading(false);
              },
            )
            .subscribe();
        } catch (err) {
          console.warn("[Auth] Could not subscribe to profile realtime", err);
        }

        setLoading(false);
      }
    };

    init();

    let authListener: any = null;
    if (supabase) {
      authListener = supabase.auth.onAuthStateChange((event, session) => {
        const supaUser = session?.user ?? null;

        if (!supaUser) {
          setUser(null);
          setLoading(false);
        } else {
          // fetch profile and let realtime subscription callback update it
          fetchUserDetails(supaUser.id).then((profile) => {
            if (profile) setUser(createAuthUser(profile));
          });
        }
      });
    }

    return () => {
      // cleanup auth listener and profile subscription
      authListener?.subscription?.unsubscribe?.();
      if (profileSubscription && supabase)
        supabase.removeChannel(profileSubscription);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      if (!supabase) throw new Error("Supabase client is not initialized.");
      setError(null);
      setLoading(true);

      // Check if user is active before attempting sign-in
      const { data: activeCheck } = await supabase
        .from("users")
        .select("is_active")
        .eq("email", email)
        .maybeSingle();

      if (activeCheck && activeCheck.is_active === false) {
        throw new Error(
          "Your account is inactive. Please contact administrator.",
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const supaUser = data.user;
      if (supaUser) {
        const userDetails = await fetchUserDetails(supaUser.id);
        if (userDetails) {
          if (!userDetails.isActive) {
            await supabase.auth.signOut();
            throw new Error(
              "Your account is inactive. Please contact administrator.",
            );
          }
          setUser(createAuthUser(userDetails));
        } else {
          setUser(null);
          setError("User profile not found. Please contact administrator.");
          await supabase.auth.signOut();
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
    try {
      if (!supabase) throw new Error("Supabase client is not initialized.");
      setError(null);
      setLoading(true);
      // Create Supabase Auth user
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      const supaUser = data.user;
      // Create profile row in `users` table
      const now = new Date().toISOString();
      const userDocument: any = {
        id: supaUser?.id || undefined,
        email,
        display_name: displayName,
        role,
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      if (supaUser?.id) {
        const { error: insertErr } = await supabase
          .from("users")
          .insert([userDocument]);
        if (insertErr) throw insertErr;
      }

      if (supaUser) {
        const mapped: UserProfile = {
          uid: supaUser.id,
          email,
          displayName,
          role,
          isActive: true,
          isDeleted: true,
          createdAt: now,
          updatedAt: now,
        };
        setUser(createAuthUser(mapped));
      }
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
      if (!supabase) throw new Error("Supabase client is not initialized.");
      setError(null);
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed";
      setError(message);
      throw err;
    }
  };

  const refreshUser = async () => {
    try {
      if (!supabase) {
        setUser(null);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const supaUser = sessionData?.session?.user ?? null;
      if (!supaUser) {
        setUser(null);
        return;
      }

      const userDetails = await fetchUserDetails(supaUser.id);
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
