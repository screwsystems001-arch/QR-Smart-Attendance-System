
import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import { supabase } from "../services/supabase";
import { getUserProfile } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function loadProfile(session) {
            if (!session?.user) {
                if (isMounted) {
                    setUser(null);
                    setProfile(null);
                }
                return;
            }

            try {
                const userProfile = await getUserProfile();

                if (isMounted) {
                    setUser(session.user);
                    setProfile(userProfile);
                }
            } catch (error) {
                console.error("Profile loading failed:", error.message);

                if (isMounted) {
                    setUser(null);
                    setProfile(null);
                }
            }
        }

        async function initializeAuth() {
            try {
                const { data, error } = await supabase.auth.getSession();

                if (error) throw error;

                await loadProfile(data.session);
            } catch (error) {
                console.error("Authentication initialization failed:", error.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        initializeAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "INITIAL_SESSION") return;

            setTimeout(() => {
                if (isMounted) {
                    loadProfile(session).finally(() => {
                        if (isMounted) setLoading(false);
                    });
                }
            }, 0);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider
            value={{ user, profile, loading }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider.");
    }

    return context;
}
