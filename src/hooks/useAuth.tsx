import { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "employee" | "owner" | "customer" | "salesman" | "developer" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole;
  roleLoading: boolean;
  signOut: () => Promise<void>;
  refetchRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  roleLoading: true,
  signOut: async () => {},
  refetchRole: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  
  // Use refs to prevent duplicate fetches and track current user
  const fetchingRoleRef = useRef(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const roleCacheRef = useRef<{ userId: string; role: AppRole; timestamp: number } | null>(null);

  const fetchRole = useCallback(async (userId: string, force = false) => {
    // Check cache first (valid for 5 minutes)
    const now = Date.now();
    const cacheValid = roleCacheRef.current && 
      roleCacheRef.current.userId === userId && 
      (now - roleCacheRef.current.timestamp) < 5 * 60 * 1000;
    
    if (!force && cacheValid) {
      console.log("Using cached role:", roleCacheRef.current.role);
      setRole(roleCacheRef.current.role);
      setRoleLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (fetchingRoleRef.current && lastFetchedUserIdRef.current === userId) {
      console.log("Already fetching role, skipping duplicate request");
      return;
    }

    fetchingRoleRef.current = true;
    lastFetchedUserIdRef.current = userId;
    setRoleLoading(true);

    try {
      console.log("Fetching role for user:", userId);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      } else {
        const fetchedRole = (data?.role as AppRole) || null;
        console.log("Role fetched:", fetchedRole);
        setRole(fetchedRole);
        
        // Update cache
        roleCacheRef.current = {
          userId,
          role: fetchedRole,
          timestamp: Date.now()
        };
      }
    } catch (err) {
      console.error("Failed to fetch role:", err);
      setRole(null);
    } finally {
      setRoleLoading(false);
      fetchingRoleRef.current = false;
    }
  }, []);

  const refetchRole = useCallback(async () => {
    if (user) {
      await fetchRole(user.id, true); // Force refetch
    }
  }, [user, fetchRole]);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Fetch role when user signs in
        if (session?.user) {
          fetchRole(session.user.id);
        } else {
          // Clear role on sign out
          setRole(null);
          setRoleLoading(false);
          roleCacheRef.current = null;
          lastFetchedUserIdRef.current = null;
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRoleLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  const signOut = async () => {
    roleCacheRef.current = null;
    lastFetchedUserIdRef.current = null;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, roleLoading, signOut, refetchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
