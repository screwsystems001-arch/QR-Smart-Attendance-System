import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !publishableKey || !secretKey) {
    throw new Error(
        "Missing Supabase configuration. Check backend/.env"
    );
}

// Used to validate user access tokens with Supabase Auth.
export const authClient = createClient(
    supabaseUrl,
    publishableKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

// Server-only client for trusted database operations.
// Never import this client into frontend code.
export const adminClient = createClient(
    supabaseUrl,
    secretKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);
