import { compare, hash } from "bcryptjs";

const BCRYPT_COST = 12;

export const INVALID_PASSWORD_HASH =
  "$2b$12$RpN4jHRoicaWV9ua.q1S4e5Q37RHuysHOS9CpQ0yC7dCTW0OgAeg6";

export function hashPassword(password: string) {
  return hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}
