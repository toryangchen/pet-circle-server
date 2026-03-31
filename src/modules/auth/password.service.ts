import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const PASSWORD_HASH_ALGORITHM = 'scrypt';
const PASSWORD_DERIVED_KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  hash(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(
      password,
      salt,
      PASSWORD_DERIVED_KEY_LENGTH,
    ).toString('hex');

    return `${PASSWORD_HASH_ALGORITHM}$${salt}$${derivedKey}`;
  }

  verify(password: string, storedHash: string): boolean {
    const [algorithm, salt, storedDerivedKey] = storedHash.split('$');
    if (
      algorithm !== PASSWORD_HASH_ALGORITHM ||
      !salt ||
      !storedDerivedKey
    ) {
      return false;
    }

    const derivedKey = scryptSync(
      password,
      salt,
      PASSWORD_DERIVED_KEY_LENGTH,
    ).toString('hex');
    const derivedKeyBuffer = Buffer.from(derivedKey, 'hex');
    const storedDerivedKeyBuffer = Buffer.from(storedDerivedKey, 'hex');

    if (derivedKeyBuffer.length !== storedDerivedKeyBuffer.length) {
      return false;
    }

    return timingSafeEqual(derivedKeyBuffer, storedDerivedKeyBuffer);
  }
}
