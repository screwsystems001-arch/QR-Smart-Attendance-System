
import { supabase } from "./supabase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;

    return data;
}

export async function registerUser(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    });

    if (error) throw error;

    return data;
}

export async function logoutUser() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
}

export async function getUserProfile() {
    const { data: { session }, error: sessionError } =
        await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session) {
        throw new Error("No active login session.");
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to retrieve user profile.");
    }

    return {
        user_id: result.user.id,
        full_name: result.user.full_name,
        role: result.user.role,
    };
}
