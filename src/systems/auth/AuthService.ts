export type AuthCharacter = {
  id: string;
  accountId: string;
  name: string;
};

export type AuthSession = {
  token: string;
  accountId: string;
  characterId: string | null;
  expiresAt: number;
};

export type AuthUserProfile = {
  accountId: string;
  username: string;
  character: AuthCharacter | null;
};

export type VerifiedGameSession = {
  accountId: string;
  character: AuthCharacter;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 100_000;
const PASSWORD_KEY_BITS = 256;

export class AuthService {
  constructor(private readonly db: D1Database) {}

  async register(username: string, password: string): Promise<{ ok: true; token: string; profile: AuthUserProfile } | { ok: false; reason: string }> {
    const normalizedUsername = normalizeUsername(username);
    const passwordError = validatePassword(password);
    if (!normalizedUsername) return { ok: false, reason: '계정 ID는 영문, 숫자, 밑줄 3~20자로 입력해주세요.' };
    if (passwordError) return { ok: false, reason: passwordError };

    const existing = await this.findAccountByUsername(normalizedUsername);
    if (existing) return { ok: false, reason: '이미 사용 중인 계정 ID입니다.' };

    const accountId = `acct_${crypto.randomUUID()}`;
    const now = Date.now();
    const passwordSalt = randomTokenBytes(16);
    const passwordHash = await hashPassword(password, passwordSalt);

    await this.db
      .prepare(
        `INSERT INTO accounts (id, username, password_hash, password_salt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(accountId, normalizedUsername, passwordHash, passwordSalt, now, now)
      .run();

    const session = await this.createSession(accountId, null);
    return {
      ok: true,
      token: session.token,
      profile: { accountId, username: normalizedUsername, character: null },
    };
  }

  async login(username: string, password: string): Promise<{ ok: true; token: string; profile: AuthUserProfile } | { ok: false; reason: string }> {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) return { ok: false, reason: '계정 ID 또는 비밀번호가 올바르지 않습니다.' };

    const account = await this.findAccountByUsername(normalizedUsername);
    if (!account) return { ok: false, reason: '계정 ID 또는 비밀번호가 올바르지 않습니다.' };

    const passwordHash = await hashPassword(password, account.password_salt);
    if (!safeEqual(passwordHash, account.password_hash)) {
      return { ok: false, reason: '계정 ID 또는 비밀번호가 올바르지 않습니다.' };
    }

    const character = await this.getCharacterByAccountId(account.id);
    const session = await this.createSession(account.id, character?.id ?? null);
    return {
      ok: true,
      token: session.token,
      profile: {
        accountId: account.id,
        username: account.username,
        character,
      },
    };
  }

  async logout(token: string): Promise<void> {
    if (!isValidToken(token)) return;
    await this.db.prepare(`DELETE FROM auth_sessions WHERE token = ?`).bind(token).run();
  }

  async getProfile(token: string): Promise<AuthUserProfile | null> {
    const session = await this.verifySession(token);
    if (!session) return null;

    const account = await this.db
      .prepare(`SELECT id, username FROM accounts WHERE id = ?`)
      .bind(session.accountId)
      .first<{ id: string; username: string }>();
    if (!account) return null;

    const character = await this.getCharacterByAccountId(account.id);
    return { accountId: account.id, username: account.username, character };
  }

  async createCharacter(token: string, rawName: string): Promise<{ ok: true; token: string; profile: AuthUserProfile } | { ok: false; reason: string }> {
    const session = await this.verifySession(token);
    if (!session) return { ok: false, reason: '로그인이 필요합니다.' };

    const existing = await this.getCharacterByAccountId(session.accountId);
    if (existing) return { ok: false, reason: '이미 생성된 캐릭터가 있습니다.' };

    const name = normalizeCharacterName(rawName);
    if (!name) return { ok: false, reason: '캐릭터 이름은 1~16자로 입력해주세요.' };

    const characterId = `char_${crypto.randomUUID()}`;
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO characters (id, account_id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(characterId, session.accountId, name, now, now)
      .run();

    await this.db
      .prepare(`UPDATE auth_sessions SET character_id = ? WHERE token = ?`)
      .bind(characterId, token)
      .run();

    const account = await this.db
      .prepare(`SELECT id, username FROM accounts WHERE id = ?`)
      .bind(session.accountId)
      .first<{ id: string; username: string }>();
    if (!account) return { ok: false, reason: '계정을 찾을 수 없습니다.' };

    return {
      ok: true,
      token,
      profile: {
        accountId: account.id,
        username: account.username,
        character: { id: characterId, accountId: account.id, name },
      },
    };
  }

  async verifyGameSession(token: string): Promise<VerifiedGameSession | null> {
    const session = await this.verifySession(token);
    if (!session) return null;
    const character = session.characterId
      ? await this.getCharacterById(session.characterId)
      : await this.getCharacterByAccountId(session.accountId);
    if (!character || character.accountId !== session.accountId) return null;
    return { accountId: session.accountId, character };
  }

  async verifySession(token: string): Promise<AuthSession | null> {
    if (!isValidToken(token)) return null;
    const row = await this.db
      .prepare(`SELECT token, account_id, character_id, expires_at FROM auth_sessions WHERE token = ?`)
      .bind(token)
      .first<{ token: string; account_id: string; character_id: string | null; expires_at: number }>();

    if (!row || row.expires_at <= Date.now()) return null;
    return {
      token: row.token,
      accountId: row.account_id,
      characterId: row.character_id,
      expiresAt: row.expires_at,
    };
  }

  async getCharacterByAccountId(accountId: string): Promise<AuthCharacter | null> {
    const row = await this.db
      .prepare(`SELECT id, account_id, name FROM characters WHERE account_id = ?`)
      .bind(accountId)
      .first<{ id: string; account_id: string; name: string }>();
    if (!row) return null;
    return { id: row.id, accountId: row.account_id, name: row.name };
  }

  async getCharacterById(characterId: string): Promise<AuthCharacter | null> {
    const row = await this.db
      .prepare(`SELECT id, account_id, name FROM characters WHERE id = ?`)
      .bind(characterId)
      .first<{ id: string; account_id: string; name: string }>();
    if (!row) return null;
    return { id: row.id, accountId: row.account_id, name: row.name };
  }

  private async createSession(accountId: string, characterId: string | null): Promise<AuthSession> {
    const now = Date.now();
    const token = `sess_${crypto.randomUUID()}_${randomTokenBytes(16)}`;
    const expiresAt = now + SESSION_TTL_MS;

    await this.db
      .prepare(
        `INSERT INTO auth_sessions (token, account_id, character_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(token, accountId, characterId, expiresAt, now)
      .run();

    return { token, accountId, characterId, expiresAt };
  }

  private async findAccountByUsername(username: string): Promise<{ id: string; username: string; password_hash: string; password_salt: string } | null> {
    return await this.db
      .prepare(`SELECT id, username, password_hash, password_salt FROM accounts WHERE username = ?`)
      .bind(username)
      .first<{ id: string; username: string; password_hash: string; password_salt: string }>();
  }
}

function normalizeUsername(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(value)) return null;
  return value;
}

function validatePassword(password: string): string | null {
  if (password.length < 6) return '비밀번호는 6자 이상이어야 합니다.';
  if (password.length > 72) return '비밀번호는 72자 이하로 입력해주세요.';
  return null;
}

function normalizeCharacterName(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length < 1 || value.length > 16) return null;
  return value;
}

async function hashPassword(password: string, saltBase64: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const salt = base64ToBytes(saltBase64);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    PASSWORD_KEY_BITS,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function randomTokenBytes(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isValidToken(token: string): boolean {
  return /^sess_[0-9a-fA-F-]{36}_[A-Za-z0-9+/=]+$/.test(token);
}
