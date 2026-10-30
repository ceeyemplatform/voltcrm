import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const TOKEN_CACHE_MS = 60 * 1000;

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient | null = null;

  // High-performance in-memory cache to eliminate ~1.1s remote network roundtrips on every request
  private readonly tokenCache = new Map<string, { user: any; expiresAt: number }>();
  private readonly inFlightVerifications = new Map<string, Promise<any>>();

  constructor(private configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL;
    // Checking a user's token only needs the public anon key; the admin (service-role) key is not used
    const supabaseKey =
      this.configService.get<string>('SUPABASE_ANON_KEY') || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.logger.log('Supabase client initialized successfully');
    } else {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_ANON_KEY missing in environment variables. Token verification will fail until they are set.',
      );
    }
  }

  getClient(): SupabaseClient | null {
    return this.supabase;
  }

  async verifyToken(token: string) {
    if (!this.supabase) {
      throw new Error(
        'Supabase client is not configured. Please supply SUPABASE_URL and SUPABASE_ANON_KEY in .env',
      );
    }

    const now = Date.now();

    // 1. Check in-memory cache
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > now) {
      return cached.user;
    }

    // 2. Coalesce in-flight verification requests for the same token
    if (this.inFlightVerifications.has(token)) {
      return this.inFlightVerifications.get(token);
    }

    const verificationPromise = (async () => {
      try {
        const { data, error } = await this.supabase!.auth.getUser(token);
        if (error || !data?.user) {
          this.tokenCache.delete(token);
          throw error || new Error('Invalid user session');
        }

        // Cache a verified token briefly (max 60s or its expiry) so a sign-out takes effect quickly
        let ttlMs = TOKEN_CACHE_MS;
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(
              Buffer.from(parts[1], 'base64url').toString('utf8'),
            );
            if (payload.exp) {
              const expMs = payload.exp * 1000;
              ttlMs = Math.min(expMs - now, TOKEN_CACHE_MS);
            }
          }
        } catch {
          // fall back to the default cache time
        }

        if (ttlMs > 2000) {
          this.tokenCache.set(token, {
            user: data.user,
            expiresAt: now + ttlMs,
          });

          // Prune expired cache items if memory grows
          if (this.tokenCache.size > 200) {
            for (const [k, v] of this.tokenCache.entries()) {
              if (v.expiresAt <= now) {
                this.tokenCache.delete(k);
              }
            }
          }
        }

        return data.user;
      } finally {
        this.inFlightVerifications.delete(token);
      }
    })();

    this.inFlightVerifications.set(token, verificationPromise);
    return verificationPromise;
  }
}
